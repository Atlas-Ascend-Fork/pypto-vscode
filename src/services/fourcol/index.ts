/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  FourcolCceFileItem,
  FourcolCceLabelItem,
  FourcolCceOpmagicItem,
  FourcolMetaItem,
  FourcolPyImplItem,
  FourcolPySemanticItem,
  getFourcolCceFileStore,
  getFourcolCceLabelStore,
  getFourcolCceOpmagicStore,
  getFourcolMetaStore,
  getFourcolPyImplStore,
  getFourcolPySemanticStore,
} from './store';

interface CceOpmagicSource {
  leafhash: string;
  opmagic: string;
  cce: string;
  line: number[];
}

interface CceLabelSource {
  leafhash: string;
  semanticLabel: string;
  cce: string;
  line: unknown[];
}

interface ProgramOperation {
  opmagic: number;
  subgraphid?: number;
  file?: string;
  line?: number;
  semantic_label?: { filename?: string; lineno?: number; label?: string };
}

interface ProgramFunction {
  hash: string;
  operations?: ProgramOperation[];
}

interface ProgramJson {
  functions?: ProgramFunction[];
  entryhash?: string;
}

export interface FourcolLoadStats {
  programId: string;
  opmagicCount: number;
  labelCount: number;
  opCount: number;
  cceFileCount: number;
  /** 带实现行（op.file/op.line）的 op 数，即 fourcol_py_impl 行数 */
  opImplCount: number;
  /** true 表示数据指纹未变化，跳过了清空重灌 */
  skippedReload: boolean;
}

export interface CceLocation {
  fileName: string;
  lines: number[];
}

export interface CceFileItem {
  fileName: string;
  related: boolean;
}

export interface CceLabelLines {
  label: string;
  lines: number[];
}

export interface OpByCceTree {
  leafHash: string;
  opmagic: string;
  pyFile: string | null;
  pyLine: number | null;
  label: string | null;
}

export interface OpByPyInfo {
  hash: string;
  opmagic: string;
}

export interface PyLocation {
  pyFile: string;
  pyLine: number;
}

export interface PyFileItem {
  path: string;
  exists: boolean;
}

/** 计算图列自高亮所需的落点：py 行 → (leafHash, opmagic, subgraphid, label) 列表（1:N） */
export interface OpSelectionItem {
  leafHash: string;
  opmagic: string;
  subgraphid: number;
  label: string | null;
  pyFile: string | null;
  pyLine: number | null;
}

/** 盘符大小写归一（programId 唯一的规范化步骤，Windows 盘符统一大写） */
export function normalizeProgramPath(p: string): string {
  return p.replace(/^([a-z]):/i, (_match, drive: string) => `${drive.toUpperCase()}:`);
}

/** 取文件名（同时按 / 与 \ 切分）：program.json 内的路径来自编译机，分隔符与运行平台不一定一致，故不用 path.basename */
export function toBaseName(p: string): string {
  return `${p ?? ''}`.split(/[\\/]/).pop() ?? '';
}

/** program.json 全路径 → programId（dataDir 规范化绝对路径），server 侧一步转换 */
export function toProgramId(comPath: string): string {
  return normalizeProgramPath(path.dirname(comPath));
}

/** kernel_src/<name>.py → programId，编辑器/测试侧两步转换（py 必须位于 <data>/kernel_src/ 下） */
export function pyPathToProgramId(pyPath: string): string {
  return normalizeProgramPath(path.dirname(path.dirname(pyPath)));
}

/** 加载指纹的 meta key（per-program，见 ADR 0002） */
function fingerprintKey(programId: string): string {
  return `loadFingerprint:${programId}`;
}

/** 指纹值内嵌五表行数（跳过路径据此自愈校验），格式：`<fingerprint>|rows:a,b,c,d,e` */
function withRecordedCounts(fingerprint: string, counts: number[]): string {
  return `${fingerprint}|rows:${counts.join(',')}`;
}

/** 解析指纹值：拆出指纹本体与记录的五表行数（旧格式无行数或计数不足时 recordedCounts 为 null） */
function parseFingerprintValue(value: string): { base: string; recordedCounts: number[] | null } {
  const separatorIndex = value.indexOf('|rows:');
  if (separatorIndex === -1) {
    return { base: value, recordedCounts: null };
  }
  const counts = value
    .slice(separatorIndex + '|rows:'.length)
    .split(',')
    .map((count) => Number(count));
  return { base: value.slice(0, separatorIndex), recordedCounts: counts.length === 5 ? counts : null };
}

/**
 * 定位四联动数据三件套。入参为 dataDir（= programId）：program.json 与 kernel_aicore/ 位于其下，
 * kernel_src/ 也在其下（pyPath 场景先经 pyPathToProgramId 转换）。
 */
export function locateFourColFiles(dataDir: string) {
  const programId = normalizeProgramPath(dataDir);
  const files = [
    { name: 'program.json', path: path.join(programId, 'program.json') },
    { name: 'cce_opmagic_map.json', path: path.join(programId, 'kernel_aicore', 'cce_opmagic_map.json') },
    { name: 'cce_semantic_label.json', path: path.join(programId, 'kernel_aicore', 'cce_semantic_label.json') },
  ];
  return {
    dataDir: programId,
    programId,
    programPath: files[0].path,
    opmagicMapPath: files[1].path,
    semanticLabelPath: files[2].path,
    missing: files.filter((file) => !fs.existsSync(file.path)),
  };
}

/**
 * 读取源数据入库（行全部携带 programId）。数据指纹（programId + 各源文件 mtime/size）未变化时
 * 跳过重灌；变化时只清空并重灌该 programId 的行，其他 program 的数据原封不动（幂等）。
 *
 * 源文件分两级：计算图文件（graphPath，缺省为 programId/program.json）**必选**——三个 py 反查
 * 接口（getOpsByPyInfo / getPyLocationByOps / getPyFileList）只依赖它；CCE 两件 JSON **可选**
 * （缺失时对应表为空，CCE 相关接口返回空，四栏模式天然齐备、三栏联动不受影响）。
 */
export async function loadFourColData(programId: string, graphPath?: string): Promise<FourcolLoadStats> {
  programId = normalizeProgramPath(programId);
  const graphFile = graphPath ?? path.join(programId, 'program.json');
  if (!fs.existsSync(graphFile)) {
    throw new Error(`缺少计算图文件: ${graphFile}`);
  }
  const opmagicMapPath = path.join(programId, 'kernel_aicore', 'cce_opmagic_map.json');
  const semanticLabelPath = path.join(programId, 'kernel_aicore', 'cce_semantic_label.json');
  const hasOpmagicMap = fs.existsSync(opmagicMapPath);
  const hasSemanticLabel = fs.existsSync(semanticLabelPath);
  const fingerprint = await computeLoadFingerprint(programId, [
    graphFile,
    ...(hasOpmagicMap ? [opmagicMapPath] : []),
    ...(hasSemanticLabel ? [semanticLabelPath] : []),
  ]);
  const metaStore = getFourcolMetaStore();
  const [savedFingerprint] = await metaStore.query().filter({ key: fingerprintKey(programId) }).exec();
  if (savedFingerprint) {
    const { base, recordedCounts } = parseFingerprintValue(savedFingerprint.value);
    if (base === fingerprint) {
      const [opmagicCount, labelCount, opCount, cceFileCount, opImplCount] = await Promise.all([
        getFourcolCceOpmagicStore().query().filter({ programId }).count(),
        getFourcolCceLabelStore().query().filter({ programId }).count(),
        getFourcolPySemanticStore().query().filter({ programId }).count(),
        getFourcolCceFileStore().query().filter({ programId }).count(),
        getFourcolPyImplStore().query().filter({ programId }).count(),
      ]);
      const actualCounts = [opmagicCount, labelCount, opCount, cceFileCount, opImplCount];
      // 行数与指纹记录一致才跳过；无记录（旧格式）或不一致（如进程退出时 SQLite 防抖落盘丢行）则全量重灌自愈
      if (recordedCounts && recordedCounts.every((count, index) => count === actualCounts[index])) {
        return { programId, opmagicCount, labelCount, opCount, cceFileCount, opImplCount, skippedReload: true };
      }
    }
  }
  const [opmagicMap, semanticLabel, program] = (await Promise.all([
    hasOpmagicMap ? readJsonFile(opmagicMapPath) : Promise.resolve([]),
    hasSemanticLabel ? readJsonFile(semanticLabelPath) : Promise.resolve([]),
    readJsonFile(graphFile),
  ])) as [CceOpmagicSource[], CceLabelSource[], ProgramJson];

  // fourcol_cce_opmagic：非 _main 的 .cpp 排前，保证“首条匹配”即 .cpp
  const cceOpmagicItems: FourcolCceOpmagicItem[] = [];
  for (const entry of opmagicMap) {
    for (const line of entry.line) {
      cceOpmagicItems.push({ programId, leafhash: entry.leafhash, opmagic: String(entry.opmagic), cce: entry.cce, line });
    }
  }
  cceOpmagicItems.sort((a, b) => Number(a.cce.endsWith('_main.cpp')) - Number(b.cce.endsWith('_main.cpp')));

  // fourcol_cce_label：行区间原样入库，查询时再展开
  const labelItems: FourcolCceLabelItem[] = semanticLabel.map((entry) => ({
    programId,
    leafhash: entry.leafhash,
    label: entry.semanticLabel,
    cce: entry.cce,
    line: entry.line,
  }));

  // fourcol_py_semantic：semantic_label 带 py 落点的 op（声明行锚，块级）
  const opItems: FourcolPySemanticItem[] = [];
  // fourcol_py_impl：op.file 为 py 的 op（实现行锚，行级，与 semantic_label 无关）
  const pyImplItems: FourcolPyImplItem[] = [];
  for (const func of program.functions || []) {
    for (const op of func.operations || []) {
      const sl = op.semantic_label;
      if (sl && sl.filename && sl.lineno != null && sl.filename.endsWith('.py')) {
        opItems.push({
          programId,
          leafhash: func.hash,
          opmagic: String(op.opmagic),
          pyFile: sl.filename,
          pyBasename: path.basename(sl.filename),
          pyLine: sl.lineno,
          label: sl.label ?? '',
          subgraphid: op.subgraphid ?? -1,
        });
      }
      if (op.file && String(op.file).endsWith('.py') && typeof op.line === 'number') {
        const pyFile = normalizeProgramPath(String(op.file));
        pyImplItems.push({
          programId,
          leafhash: func.hash,
          opmagic: String(op.opmagic),
          pyFile,
          pyBasename: path.basename(pyFile),
          pyLine: op.line,
          label: op.semantic_label?.label ?? '',
          subgraphid: op.subgraphid ?? -1,
        });
      }
    }
  }
  // fourcol_cce_file：全部 CCE 文件（kernel_aicore 目录扫描 ∪ JSON 引用），字典序
  let diskCppFiles: string[] = [];
  try {
    diskCppFiles = (await fs.promises.readdir(path.dirname(opmagicMapPath))).filter((name) => name.endsWith('.cpp'));
  } catch {
    // 目录读取失败时仅保留 JSON 引用的文件
  }
  const cceFileItems: FourcolCceFileItem[] = [...new Set([...opmagicMap.map((entry) => entry.cce), ...diskCppFiles])]
    .sort()
    .map((fileName) => ({ programId, fileName }));

  // 五表并行 bulkDelete + batchSet
  await Promise.all([
    (async () => {
      const store = getFourcolCceOpmagicStore();
      await store.bulkDelete({ programId } as Partial<FourcolCceOpmagicItem>);
      await store.batchSet(cceOpmagicItems);
    })(),
    (async () => {
      const store = getFourcolCceLabelStore();
      await store.bulkDelete({ programId } as Partial<FourcolCceLabelItem>);
      await store.batchSet(labelItems);
    })(),
    (async () => {
      const store = getFourcolPySemanticStore();
      await store.bulkDelete({ programId } as Partial<FourcolPySemanticItem>);
      await store.batchSet(opItems);
    })(),
    (async () => {
      const store = getFourcolCceFileStore();
      await store.bulkDelete({ programId } as Partial<FourcolCceFileItem>);
      await store.batchSet(cceFileItems);
    })(),
    (async () => {
      const store = getFourcolPyImplStore();
      await store.bulkDelete({ programId } as Partial<FourcolPyImplItem>);
      await store.batchSet(pyImplItems);
    })(),
  ]);
  const metaItem: FourcolMetaItem = { key: fingerprintKey(programId), value: withRecordedCounts(fingerprint, [
    cceOpmagicItems.length,
    labelItems.length,
    opItems.length,
    cceFileItems.length,
    pyImplItems.length,
  ]) };
  await metaStore.set(metaItem);
  await metaStore.set({ key: `entryHash:${programId}`, value: program.entryhash ?? '' });

  return {
    programId,
    opmagicCount: cceOpmagicItems.length,
    labelCount: labelItems.length,
    opCount: opItems.length,
    cceFileCount: cceFileItems.length,
    opImplCount: pyImplItems.length,
    skippedReload: false,
  };
}

/** 该 program 是否已加载（以 DB 指纹存在为准，跨会话存活） */
export async function isProgramLoaded(programId: string): Promise<boolean> {
  const [row] = await getFourcolMetaStore()
    .query()
    .filter({ key: fingerprintKey(normalizeProgramPath(programId)) })
    .exec();
  return !!row;
}

/** cce_opmagic_map.json 的第一个 leafhash（取表中首行，非 main 排前故与文件首条一致） */
export async function getFirstLeafHash(programId: string): Promise<string | null> {
  const [row] = await getFourcolCceOpmagicStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId) })
    .slice(0, 1)
    .exec();
  return row?.leafhash ?? null;
}

/** 入库时缓存的 entryhash（meta 表查询，毫秒级；未入库时返回 undefined，调用方回退流式解析） */
export async function getCachedEntryHash(programId: string): Promise<string | undefined> {
  const [row] = await getFourcolMetaStore()
    .query()
    .filter({ key: `entryHash:${normalizeProgramPath(programId)}` })
    .exec();
  return row?.value || undefined;
}

/** 删除该 program 的加载指纹，下次 load 强制全量重灌（test4col 用例用于确定性制造指纹 miss） */
export async function removeLoadFingerprint(programId: string): Promise<void> {
  await getFourcolMetaStore().delete({ key: fingerprintKey(normalizeProgramPath(programId)) });
}

/**
 * 给 hash + opmagic，返回 CCE 文件名和行号；查不到（不产码 op / 空 leaf）返回 null。
 * 双副本默认返回非 _main 的 .cpp。
 */
export async function getCceLocation(programId: string, leafHash: string, opMagic: string): Promise<CceLocation | null> {
  const rows = await getFourcolCceOpmagicStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), leafhash: leafHash, opmagic: opMagic })
    .exec();
  const preferred = preferNonMainCce(rows);
  if (!preferred) {
    return null;
  }
  return { fileName: preferred.cce, lines: rows.filter((row) => row.cce === preferred.cce).map((row) => row.line) };
}

/**
 * CCE 行反查 (leafHash, opMagic)（fileName 可传全路径，内部取 basename）；非 op 行返回 null。
 */
export async function getOpByCceLine(
  programId: string,
  fileName: string,
  line: number,
): Promise<{ leafHash: string; opmagic: string } | null> {
  const cce = path.basename(fileName);
  const rows = await getFourcolCceOpmagicStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), cce, line })
    .exec();
  const row = rows[0];
  return row ? { leafHash: row.leafhash, opmagic: row.opmagic } : null;
}

/**
 * CCE 行反查（fileName 可传全路径，内部取 basename）；非 op 行返回 null。
 */
export async function getOpByCceTree(programId: string, fileName: string, line: number): Promise<OpByCceTree | null> {
  const op = await getOpByCceLine(programId, fileName, line);
  if (!op) {
    return null;
  }
  const [opRow] = await getFourcolPySemanticStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), leafhash: op.leafHash, opmagic: op.opmagic })
    .exec();
  return {
    ...op,
    pyFile: opRow?.pyFile ?? null,
    pyLine: opRow?.pyLine ?? null,
    label: opRow?.label || null,
  };
}

/**
 * py 行反查；basename 不匹配或无命中返回空数组。注意：返回的 hash 是 op 所属函数的
 * hash，非 leaf 函数的 op 返回的是 ROOT/父函数 hash。
 */
export async function getOpsByPyLine(programId: string, codePath: string, line: number): Promise<[string, string][]> {
  const pyBasename = path.basename(codePath);
  const rows = await getFourcolPySemanticStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), pyBasename, pyLine: line })
    .exec();
  return rows.map((row) => [row.leafhash, row.opmagic] as [string, string]);
}

/**
 * 计算图列自高亮（语义标签维度）：py 声明行 → op 落点列表（1:N）。
 * label 为 op 自带语义标签（py_semantic 列，覆盖率 100%）。
 */
export async function getOpSelectionByPyLine(programId: string, codePath: string, line: number): Promise<OpSelectionItem[]> {
  const pyBasename = path.basename(codePath);
  const rows = await getFourcolPySemanticStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), pyBasename, pyLine: line })
    .exec();
  return rows.map((row) => ({
    leafHash: row.leafhash,
    opmagic: row.opmagic,
    subgraphid: row.subgraphid,
    label: row.label || null,
    pyFile: row.pyFile,
    pyLine: row.pyLine,
  }));
}

/**
 * 计算图列自高亮（实现行维度）：py 实现行 → op 落点列表（1:N）。
 * label 为 op 自带语义标签（无 semantic_label 时为 null）。
 * program.json 的 op.file 是编译机绝对路径，与本地打开的文件不同源，故按 basename 匹配
 * （口径同 getOpSelectionByPyLine）；pyBasename 不是表列，先按可查的 pyLine 取候选再本地过滤。
 */
export async function getOpSelectionByImplPyLine(programId: string, pyFile: string, pyLine: number): Promise<OpSelectionItem[]> {
  const basename = toBaseName(pyFile);
  const rows = await getFourcolPyImplStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), pyLine })
    .exec();
  return rows
    .filter((row) => toBaseName(row.pyFile) === basename)
    .map((row) => ({
      leafHash: row.leafhash,
      opmagic: row.opmagic,
      subgraphid: row.subgraphid,
      label: row.label || null,
      pyFile: row.pyFile,
      pyLine: row.pyLine,
    }));
}

/**
 * 四联动：leaf 下的 opmagic 列表，供 returnOpsFromCom 回发后由 py/CCE 栏反查各自的落点。
 * 带 label：只取该 leaf 下同 label 的 op。fourcol_py_semantic 是 op→label 的唯一来源，
 * leafhash/opmagic 可查而 label 不是表列，故先按 leafhash 取候选再本地过滤。
 * 不带 label：代表「整张子图」，优先取产码表（fourcol_cce_opmagic，按 CCE 行序），
 * 无产码数据（例如没有 kernel_aicore 目录）时回退到语义标签表。
 */
export async function getLeafOpsByLabel(programId: string, leafHash: string, label?: string): Promise<string[]> {
  const pid = normalizeProgramPath(programId);
  if (!label) {
    const seq = await getOpSequence(programId, leafHash);
    if (seq.length) {
      return seq.map((r) => r.opmagic);
    }
  }
  const rows = await getFourcolPySemanticStore()
    .query()
    .filter({ programId: pid, leafhash: leafHash })
    .exec();
  const picked = label ? rows.filter((r) => r.label === label) : rows;
  return picked.map((r) => r.opmagic);
}

/**
 * 泳道图 task 只有 leafHash，靠它拿 CCE 文件名（文件级联动）；双副本默认返回非 _main 的 .cpp。
 */
export async function getCceFile(programId: string, leafHash: string): Promise<string | null> {
  const rows = await getFourcolCceOpmagicStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), leafhash: leafHash })
    .exec();
  return preferNonMainCce(rows)?.cce ?? null;
}

/**
 * 按 (funchash, opMagic) 查询全部 CCE 文件列表（含 JSON 未引用的盘上文件）。
 * 排序：关联的非 _main → 关联的 _main → 其余（字典序）；不产码 op 时全部为非关联。
 */
export async function getCceFileList(programId: string, funchash: string, opMagic: string): Promise<CceFileItem[]> {
  const normalizedProgramId = normalizeProgramPath(programId);
  const rows = await getFourcolCceOpmagicStore()
    .query()
    .filter({ programId: normalizedProgramId, leafhash: funchash, opmagic: opMagic })
    .exec();
  const relatedFiles = [...new Set(rows.map((row) => row.cce))].sort(
    (a, b) => Number(a.endsWith('_main.cpp')) - Number(b.endsWith('_main.cpp')),
  );
  const relatedSet = new Set(relatedFiles);
  const fileRows = await getFourcolCceFileStore().query().filter({ programId: normalizedProgramId }).exec();
  const unrelatedFiles = fileRows.map((row) => row.fileName).filter((fileName) => !relatedSet.has(fileName));
  return [
    ...relatedFiles.map((fileName) => ({ fileName, related: true })),
    ...unrelatedFiles.map((fileName) => ({ fileName, related: false })),
  ];
}

/**
 * 按 leaf 的全部 CCE 文件（candidate 用）：主块 _main.cpp 在前，尾块在后，去重。
 */
export async function getCceFilesByLeaf(programId: string, leafHash: string): Promise<string[]> {
  const rows = await getFourcolCceOpmagicStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), leafhash: leafHash })
    .exec();
  return Array.from(new Set(rows.map((row) => row.cce))).sort(
    (a, b) => Number(b.endsWith('_main.cpp')) - Number(a.endsWith('_main.cpp')),
  );
}

/**
 * 按 leaf 命中 op 涉及的全部 py 文件（candidate 用，去重保序）。
 */
export async function getPyFilesByLeaf(programId: string, leafHash: string): Promise<string[]> {
  const rows = await getFourcolPySemanticStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), leafhash: leafHash })
    .exec();
  return Array.from(new Set(rows.map((row) => row.pyFile)));
}

/**
 * 按 op 键 (leafHash, opMagic) 查自带语义标签（py_semantic 列，覆盖率 100%）。
 * 无 py 声明行锚的 op 返回 null；按 CCE 位置查 label 走 getLabelByCceLine。
 */
export async function getLabel(programId: string, leafHash: string, opMagic: string): Promise<string | null> {
  const [row] = await getFourcolPySemanticStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), leafhash: leafHash, opmagic: opMagic })
    .exec();
  return row?.label || null;
}

/**
 * 主块 `_main.cpp` 与尾块 `.cpp` 互为副本。cce_semantic_label 可能只记录了其中一份
 * （sum_lstm 实测只落在 `.cpp`），而 CCE 栏默认显示主块，因此按文件名查不到时需回退到副本。
 */
function siblingCceName(cce: string): string | undefined {
  if (cce.endsWith('_main.cpp')) {
    return `${cce.slice(0, -'_main.cpp'.length)}.cpp`;
  }
  if (cce.endsWith('.cpp')) {
    return `${cce.slice(0, -'.cpp'.length)}_main.cpp`;
  }
  return undefined;
}

/** 按 CCE 文件查 label 原始行，文件自身无记录时回退到主块/尾块副本 */
async function queryLabelRows(programId: string, cce: string): Promise<FourcolCceLabelItem[]> {
  const normalizedProgramId = normalizeProgramPath(programId);
  const rows = await getFourcolCceLabelStore()
    .query()
    .filter({ programId: normalizedProgramId, cce })
    .exec();
  if (rows.length) {
    return rows;
  }
  const sibling = siblingCceName(cce);
  if (!sibling) {
    return [];
  }
  return getFourcolCceLabelStore()
    .query()
    .filter({ programId: normalizedProgramId, cce: sibling })
    .exec();
}

/**
 * CCE 行反查 label（fileName 可传全路径，内部取 basename）。按 label 行区间展开命中，
 * label 覆盖行即可命中、不要求是 op 行；无覆盖返回 null。
 */
export async function getLabelByCceLine(programId: string, fileName: string, line: number): Promise<string | null> {
  const rows = await queryLabelRows(programId, path.basename(fileName));
  for (const row of rows) {
    if (expandLines(row.line).includes(line)) {
      return row.label;
    }
  }
  return null;
}

/**
 * 按文件查询全部 label 及其行号（fileName 可传全路径，内部取 basename）。
 * lines 为区间展开后的行号列表；文件无 label 时返回空数组。
 */
export async function getLabelsByCceFile(programId: string, fileName: string): Promise<CceLabelLines[]> {
  const rows = await queryLabelRows(programId, path.basename(fileName));
  return rows.map((row) => ({ label: row.label, lines: expandLines(row.line) }));
}

/**
 * py 组件接口（实现行维度）：按 py 文件 + 行号查 (hash, opmagic) 对。
 * pyFile 绝对路径精确匹配（两侧盘符归一）；无命中返回 null；声明行的反查走 getOpsByPyLine。
 */
export async function getOpsByPyInfo(programId: string, pyFile: string, pyLine: number): Promise<OpByPyInfo[] | null> {
  const rows = await getFourcolPyImplStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), pyFile: normalizeProgramPath(pyFile), pyLine })
    .exec();
  return rows.length > 0 ? rows.map((row) => ({ hash: row.leafhash, opmagic: row.opmagic })) : null;
}

/**
 * py 组件接口（实现行维度）：按 (hash, opmagic) 索引数组反查 py 实现行。
 * 出参与入参一一对应（靠索引对齐），第 i 个入参无结果 → 第 i 位 null；无实现行的 op 返回 null。
 */
export async function getPyLocationByOps(programId: string, pairs: { hash: string; opmagic: string }[]): Promise<(PyLocation | null)[]> {
  const normalizedProgramId = normalizeProgramPath(programId);
  return Promise.all(
    pairs.map(async ({ hash, opmagic }) => {
      const [row] = await getFourcolPyImplStore()
        .query()
        .filter({ programId: normalizedProgramId, leafhash: hash, opmagic })
        .exec();
      return row ? { pyFile: row.pyFile, pyLine: row.pyLine } : null;
    }),
  );
}

/**
 * py 组件接口（实现行维度）：图中全部 py 文件路径及存在性（pyFile 去重）。
 * exists 为纯绝对路径判断（fs.existsSync 原始路径，无回退）；无 py 文件返回 null。
 */
export async function getPyFileList(programId: string): Promise<PyFileItem[] | null> {
  const rows = await getFourcolPyImplStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId) })
    .exec();
  const pyFiles = [...new Set(rows.map((row) => row.pyFile))];
  if (pyFiles.length === 0) {
    return null;
  }
  return pyFiles.map((pyFile) => ({ path: pyFile, exists: fs.existsSync(pyFile) }));
}

/** py 栏逆映射（实现行维度）：pyFile → leafHash → opmagic → pyLine（editor.vue 消费的 PyOpmagicMap ref） */
export async function buildPyOpmagicMap(programId: string): Promise<Record<string, Record<string, Record<string, number>>>> {
  const rows = await getFourcolPyImplStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId) })
    .exec();
  const map: Record<string, Record<string, Record<string, number>>> = {};
  for (const row of rows) {
    map[row.pyFile] ??= {};
    map[row.pyFile][row.leafhash] ??= {};
    map[row.pyFile][row.leafhash][row.opmagic] = row.pyLine;
  }
  return map;
}

/** 按 leaf 下按 CCE 行序排列的 opmagic 列表（供"第一个 op / 上一/下一 op"） */
export async function getOpSequence(
  programId: string,
  leafHash: string,
): Promise<{ opmagic: string; line: number; cce: string }[]> {
  const rows = await getFourcolCceOpmagicStore()
    .query()
    .filter({ programId: normalizeProgramPath(programId), leafhash: leafHash })
    .exec();
  const main = rows.filter((r) => r.cce.endsWith('_main.cpp'));
  const base = main.length ? main : rows;
  return base.sort((a, b) => a.line - b.line).map((r) => ({ opmagic: r.opmagic, line: r.line, cce: r.cce }));
}

/**
 * 展开 cce_semantic_label 的行号数组，嵌套 [start, end] 表示闭区间
 */
export function expandLines(line: unknown): number[] {
  if (!Array.isArray(line)) {
    return [];
  }
  const result: number[] = [];
  for (const item of line) {
    if (Array.isArray(item) && item.length === 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
      for (let l = item[0]; l <= item[1]; l++) {
        result.push(l);
      }
    } else if (typeof item === 'number') {
      result.push(item);
    }
  }
  return result;
}

function preferNonMainCce<T extends { cce: string }>(rows: T[]): T | undefined {
  return rows.find((row) => !row.cce.endsWith('_main.cpp')) ?? rows[0];
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function computeLoadFingerprint(programId: string, filePaths: string[]): Promise<string> {
  const parts = [programId];
  for (const filePath of filePaths) {
    const stat = await fs.promises.stat(filePath);
    parts.push(`${filePath}:${stat.mtimeMs}:${stat.size}`);
  }
  return parts.join('|');
}
