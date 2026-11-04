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
  FourcolCceLabelItem,
  FourcolCceOpmagicItem,
  FourcolOpItem,
  getFourcolCceLabelStore,
  getFourcolCceOpmagicStore,
  getFourcolOpStore,
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
  semantic_label?: { filename?: string; lineno?: number };
}

interface ProgramFunction {
  hash: string;
  graphtype?: number;
  operations?: ProgramOperation[];
}

interface ProgramJson {
  functions?: ProgramFunction[];
}

export interface FourcolLoadStats {
  dataDir: string;
  opmagicCount: number;
  labelCount: number;
  opCount: number;
}

export interface CceLocation {
  fileName: string;
  lines: number[];
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

/**
 * 定位四联动数据三件套。约定：所选 py 必须位于 <data>/kernel_src/ 下，
 * program.json 与 kernel_aicore/ 位于 <data>/ 下。
 */
export function locateFourColFiles(pyPath: string) {
  const dataDir = path.dirname(path.dirname(pyPath));
  const files = [
    { name: 'program.json', path: path.join(dataDir, 'program.json') },
    { name: 'cce_opmagic_map.json', path: path.join(dataDir, 'kernel_aicore', 'cce_opmagic_map.json') },
    { name: 'cce_semantic_label.json', path: path.join(dataDir, 'kernel_aicore', 'cce_semantic_label.json') },
  ];
  return {
    dataDir,
    programPath: files[0].path,
    opmagicMapPath: files[1].path,
    semanticLabelPath: files[2].path,
    missing: files.filter((file) => !fs.existsSync(file.path)),
  };
}

/**
 * 三张表是模块级单例，重灌流程「clear → batchSet」必须串行，
 * 否则并发重灌会互相清空（EntryNotFound / 数据被后写者覆盖）。
 */
let loadQueue: Promise<unknown> = Promise.resolve();

export function loadFourColData(pyPath: string): Promise<FourcolLoadStats> {
  const run = () => doLoadFourColData(pyPath);
  const next = loadQueue.then(run, run);
  loadQueue = next.catch(() => undefined);
  return next;
}

/**
 * 读取三份 JSON 入库（先清空再重灌，幂等）
 */
async function doLoadFourColData(pyPath: string): Promise<FourcolLoadStats> {
  const { dataDir, programPath, opmagicMapPath, semanticLabelPath, missing } = locateFourColFiles(pyPath);
  if (missing.length > 0) {
    const missingFiles = missing.map((file) => `${file.name} (${file.path})`).join('; ');
    throw new Error(`缺少四联动数据文件（py 需位于 <data>/kernel_src/ 下）: ${missingFiles}`);
  }
  const [opmagicMap, semanticLabel, program] = (await Promise.all([
    readJsonFile(opmagicMapPath),
    readJsonFile(semanticLabelPath),
    readJsonFile(programPath),
  ])) as [CceOpmagicSource[], CceLabelSource[], ProgramJson];

  // fourcol_cce_opmagic：主块 _main.cpp 排前，保证“首条匹配”即主块
  const cceOpmagicItems: FourcolCceOpmagicItem[] = [];
  for (const entry of opmagicMap) {
    for (const line of entry.line) {
      cceOpmagicItems.push({ leafhash: entry.leafhash, opmagic: String(entry.opmagic), cce: entry.cce, line });
    }
  }
  cceOpmagicItems.sort((a, b) => Number(b.cce.endsWith('_main.cpp')) - Number(a.cce.endsWith('_main.cpp')));
  const cceOpmagicStore = getFourcolCceOpmagicStore();
  await cceOpmagicStore.clear();
  await cceOpmagicStore.batchSet(cceOpmagicItems);

  // fourcol_cce_label：行区间原样入库，查询时再展开
  const labelItems: FourcolCceLabelItem[] = semanticLabel.map((entry) => ({
    leafhash: entry.leafhash,
    label: entry.semanticLabel,
    cce: entry.cce,
    line: entry.line,
  }));
  const cceLabelStore = getFourcolCceLabelStore();
  await cceLabelStore.clear();
  await cceLabelStore.batchSet(labelItems);

  // fourcol_op：只收 CCE 落地层（graphtype==3，与 cce_opmagic_map 的 leafhash 对齐）且 semantic_label 带 py 落点的 op
  const opItems: FourcolOpItem[] = [];
  for (const func of program.functions || []) {
    if (func.graphtype !== 3) {
      continue;
    }
    for (const op of func.operations || []) {
      const sl = op.semantic_label;
      if (sl && sl.filename && sl.lineno != null && sl.filename.endsWith('.py')) {
        opItems.push({
          leafhash: func.hash,
          opmagic: String(op.opmagic),
          pyFile: sl.filename,
          pyBasename: path.basename(sl.filename),
          pyLine: sl.lineno,
          subgraphid: op.subgraphid ?? -1,
        });
      }
    }
  }
  const opStore = getFourcolOpStore();
  await opStore.clear();
  await opStore.batchSet(opItems);

  return { dataDir, opmagicCount: cceOpmagicItems.length, labelCount: labelItems.length, opCount: opItems.length };
}

/**
 * 给 hash + opmagic，返回 CCE 文件名和行号；查不到（不产码 op / 空 leaf）返回 null。
 * 双副本默认返回主块 _main.cpp。
 */
export async function getCceLocation(leafHash: string, opMagic: string): Promise<CceLocation | null> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash, opmagic: opMagic }).exec();
  const preferred = preferMainCce(rows);
  if (!preferred) {
    return null;
  }
  return { fileName: preferred.cce, lines: rows.filter((row) => row.cce === preferred.cce).map((row) => row.line) };
}

/**
 * CCE 行反查 (leafHash, opMagic)（fileName 可传全路径，内部取 basename）；非 op 行返回 null。
 */
export async function getOpByCceLine(fileName: string, line: number): Promise<{ leafHash: string; opmagic: string } | null> {
  const cce = path.basename(fileName);
  const rows = await getFourcolCceOpmagicStore().query().filter({ cce, line }).exec();
  const row = rows[0];
  return row ? { leafHash: row.leafhash, opmagic: row.opmagic } : null;
}

/**
 * CCE 行反查（fileName 可传全路径，内部取 basename）；非 op 行返回 null。
 */
export async function getOpByCceTree(fileName: string, line: number): Promise<OpByCceTree | null> {
  const op = await getOpByCceLine(fileName, line);
  if (!op) {
    return null;
  }
  const opRows = await getFourcolOpStore().query().filter({ leafhash: op.leafHash, opmagic: op.opmagic }).exec();
  const label = await getLabelByCceLine(fileName, line);
  return { ...op, pyFile: opRows[0]?.pyFile ?? null, pyLine: opRows[0]?.pyLine ?? null, label };
}

/**
 * py 行反查；basename 不匹配或无命中返回空数组。返回的 hash 是 op 所属 leaf 函数
 * （graphtype==3，与 cce_opmagic_map / 泳道 leafHash 一致）的 hash。
 */
export async function getOpsByPyLine(codePath: string, line: number): Promise<[string, string][]> {
  const pyBasename = path.basename(codePath);
  const rows = await getFourcolOpStore().query().filter({ pyBasename, pyLine: line }).exec();
  return rows.map((row) => [row.leafhash, row.opmagic] as [string, string]);
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

export async function getOpSelectionByPyLine(codePath: string, line: number): Promise<OpSelectionItem[]> {
  const pyBasename = path.basename(codePath);
  const rows = await getFourcolOpStore().query().filter({ pyBasename, pyLine: line }).exec();
  return Promise.all(
    rows.map(async (row) => ({
      leafHash: row.leafhash,
      opmagic: row.opmagic,
      subgraphid: row.subgraphid,
      label: await getLabel(row.leafhash, row.opmagic),
      pyFile: row.pyFile,
      pyLine: row.pyLine,
    })),
  );
}

/**
 * 泳道图 task 只有 leafHash，靠它拿 CCE 文件名（文件级联动）；双副本默认返回主块 _main.cpp。
 */
export async function getCceFile(leafHash: string): Promise<string | null> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash }).exec();
  return preferMainCce(rows)?.cce ?? null;
}

/**
 * 某 leaf 的全部 CCE 文件（candidate 用）：主块 _main.cpp 在前，尾块在后，去重。
 */
export async function getCceFilesByLeaf(leafHash: string): Promise<string[]> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash }).exec();
  return Array.from(new Set(rows.map((row) => row.cce))).sort((a, b) => Number(b.endsWith('_main.cpp')) - Number(a.endsWith('_main.cpp')));
}

/**
 * 某 leaf 命中 op 涉及的全部 py 文件（candidate 用，去重保序）。
 */
export async function getPyFilesByLeaf(leafHash: string): Promise<string[]> {
  const rows = await getFourcolOpStore().query().filter({ leafhash: leafHash }).exec();
  return Array.from(new Set(rows.map((row) => row.pyFile)));
}

/**
 * 获取 label：先按 (leafHash, opMagic) 查 CCE 文件 + 行号，再在 cce_semantic_label
 * 的行区间中命中 label 名（主块 _main.cpp 优先，其次 .cpp）；无覆盖返回 null。
 */
export async function getLabel(leafHash: string, opMagic: string): Promise<string | null> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash, opmagic: opMagic }).exec();
  const ordered = [...rows].sort((a, b) => Number(b.cce.endsWith('_main.cpp')) - Number(a.cce.endsWith('_main.cpp')));
  for (const row of ordered) {
    const label = await getLabelByCceLine(row.cce, row.line);
    if (label) {
      return label;
    }
  }
  return null;
}

/**
 * 主块 `_main.cpp` 与尾块 `.cpp` 互为副本。cce_semantic_label 可能只记录了其中一侧
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
async function queryLabelRows(cce: string): Promise<FourcolCceLabelItem[]> {
  const rows = await getFourcolCceLabelStore().query().filter({ cce }).exec();
  if (rows.length) {
    return rows;
  }
  const sibling = siblingCceName(cce);
  if (!sibling) {
    return [];
  }
  return getFourcolCceLabelStore().query().filter({ cce: sibling }).exec();
}

/**
 * CCE 行反查 label（fileName 可传全路径，内部取 basename）。按 label 行区间展开命中，
 * label 覆盖行即可命中、不要求是 op 行；无覆盖返回 null。
 */
export async function getLabelByCceLine(fileName: string, line: number): Promise<string | null> {
  const rows = await queryLabelRows(path.basename(fileName));
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
export async function getLabelsByCceFile(fileName: string): Promise<CceLabelLines[]> {
  const rows = await queryLabelRows(path.basename(fileName));
  return rows.map((row) => ({ label: row.label, lines: expandLines(row.line) }));
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

function preferMainCce<T extends { cce: string }>(rows: T[]): T | undefined {
  return rows.find((row) => row.cce.endsWith('_main.cpp')) ?? rows[0];
}

/** py 栏逆映射：pyFile → leafHash → opmagic → pyLine（editor.vue 消费的 PyOpmagicMap ref） */
export async function buildPyOpmagicMap(): Promise<Record<string, Record<string, Record<string, number>>>> {
  const rows = await getFourcolOpStore().query().exec();
  const map: Record<string, Record<string, Record<string, number>>> = {};
  for (const row of rows) {
    map[row.pyFile] ??= {};
    map[row.pyFile][row.leafhash] ??= {};
    map[row.pyFile][row.leafhash][row.opmagic] = row.pyLine;
  }
  return map;
}

/** 某 leaf 下按 CCE 行序排列的 opmagic 列表（供“第一个 op / 上一/下一 op”） */
export async function getOpSequence(leafHash: string): Promise<{ opmagic: string; line: number; cce: string }[]> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash }).exec();
  const main = rows.filter((r) => r.cce.endsWith('_main.cpp'));
  const base = main.length ? main : rows;
  return base.sort((a, b) => a.line - b.line).map((r) => ({ opmagic: r.opmagic, line: r.line, cce: r.cce }));
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(content);
}
