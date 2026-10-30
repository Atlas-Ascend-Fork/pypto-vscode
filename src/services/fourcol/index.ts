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
  semantic_label?: { filename?: string; lineno?: number };
}

interface ProgramFunction {
  hash: string;
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
 * 读取三份 JSON 入库（先清空再重灌，幂等）
 */
export async function loadFourColData(pyPath: string): Promise<FourcolLoadStats> {
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

  // fourcol_cce_opmagic：非 _main 的 .cpp 排前，保证“首条匹配”即 .cpp
  const cceOpmagicItems: FourcolCceOpmagicItem[] = [];
  for (const entry of opmagicMap) {
    for (const line of entry.line) {
      cceOpmagicItems.push({ leafhash: entry.leafhash, opmagic: String(entry.opmagic), cce: entry.cce, line });
    }
  }
  cceOpmagicItems.sort((a, b) => Number(a.cce.endsWith('_main.cpp')) - Number(b.cce.endsWith('_main.cpp')));
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

  // fourcol_op：只收 semantic_label 带 py 落点的 op（op.file 字段忽略）
  const opItems: FourcolOpItem[] = [];
  for (const func of program.functions || []) {
    for (const op of func.operations || []) {
      const sl = op.semantic_label;
      if (sl && sl.filename && sl.lineno != null && sl.filename.endsWith('.py')) {
        opItems.push({
          leafhash: func.hash,
          opmagic: String(op.opmagic),
          pyFile: sl.filename,
          pyBasename: path.basename(sl.filename),
          pyLine: sl.lineno,
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
 * 双副本默认返回非 _main 的 .cpp。
 */
export async function getCceLocation(leafHash: string, opMagic: string): Promise<CceLocation | null> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash, opmagic: opMagic }).exec();
  const preferred = preferNonMainCce(rows);
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
 * py 行反查；basename 不匹配或无命中返回空数组。注意：返回的 hash 是 op 所属函数的
 * hash，非 leaf 函数的 op 返回的是 ROOT/父函数 hash。
 */
export async function getOpsByPyLine(codePath: string, line: number): Promise<[string, string][]> {
  const pyBasename = path.basename(codePath);
  const rows = await getFourcolOpStore().query().filter({ pyBasename, pyLine: line }).exec();
  return rows.map((row) => [row.leafhash, row.opmagic] as [string, string]);
}

/**
 * 泳道图 task 只有 leafHash，靠它拿 CCE 文件名（文件级联动）；双副本默认返回非 _main 的 .cpp。
 */
export async function getCceFile(leafHash: string): Promise<string | null> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash }).exec();
  return preferNonMainCce(rows)?.cce ?? null;
}

/**
 * 获取 label：先按 (leafHash, opMagic) 查 CCE 文件 + 行号，再在 cce_semantic_label
 * 的行区间中命中 label 名（.cpp 优先，其次 _main.cpp）；无覆盖返回 null。
 */
export async function getLabel(leafHash: string, opMagic: string): Promise<string | null> {
  const rows = await getFourcolCceOpmagicStore().query().filter({ leafhash: leafHash, opmagic: opMagic }).exec();
  const ordered = [...rows].sort((a, b) => Number(a.cce.endsWith('_main.cpp')) - Number(b.cce.endsWith('_main.cpp')));
  for (const row of ordered) {
    const label = await getLabelByCceLine(row.cce, row.line);
    if (label) {
      return label;
    }
  }
  return null;
}

/**
 * CCE 行反查 label（fileName 可传全路径，内部取 basename）。按 label 行区间展开命中，
 * label 覆盖行即可命中、不要求是 op 行；无覆盖返回 null。
 */
export async function getLabelByCceLine(fileName: string, line: number): Promise<string | null> {
  const cce = path.basename(fileName);
  const rows = await getFourcolCceLabelStore().query().filter({ cce }).exec();
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
  const cce = path.basename(fileName);
  const rows = await getFourcolCceLabelStore().query().filter({ cce }).exec();
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

function preferNonMainCce<T extends { cce: string }>(rows: T[]): T | undefined {
  return rows.find((row) => !row.cce.endsWith('_main.cpp')) ?? rows[0];
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(content);
}
