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
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

export interface ColumnModeResult {
  columnMode: 3 | 4;
  cceDir?: string;
}

/** CCE 产物目录的默认名字； rundata 记录提供真实路径时以记录为准（见 resolveCceDir） */
export const DEFAULT_CCE_DIR_NAME = 'kernel_aicore';
const CCE_MAP_FILE = 'cce_opmagic_map.json';

/**
 * 解析 CCE 目录，唯一入口。顺序：
 * ① 同目录约定：<outputDir>/kernel_aicore（与 program.json 同源，默认名字）
 * ② 保底：运行记录 rundata.json 的 kernel_aicore_path（文件夹被改名时的真实名字/路径）
 * 两级都要求 cce_opmagic_map.json 存在，否则返回 undefined。
 */
export function resolveCceDir(outputDir: string | undefined, recordCceDir?: string): string | undefined {
  if (outputDir) {
    const convention = join(outputDir, DEFAULT_CCE_DIR_NAME);
    if (existsSync(join(convention, CCE_MAP_FILE))) {
      return convention;
    }
  }
  if (recordCceDir && existsSync(join(recordCceDir, CCE_MAP_FILE))) {
    return recordCceDir;
  }
  return undefined;
}

/**
 * 三/四栏判定：锚点为 comPath/swimPath 所在目录，CCE 目录经 resolveCceDir 解析。
 */
export function detectColumnMode(anchorPath: string | undefined, fallbackCceDir?: string): ColumnModeResult {
  const cceDir = resolveCceDir(anchorPath ? dirname(anchorPath) : undefined, fallbackCceDir);
  if (!cceDir) {
    return { columnMode: 3 };
  }
  return { columnMode: 4, cceDir };
}

/** 从运行记录目录（~/.pypto/run/rundata_<ts>/）自己的 rundata.json 读 kernel_aicore_path，本地存在才返回 */
export function readRecordCceDir(recordDirPath: string | undefined): string | undefined {
  if (!recordDirPath) {
    return undefined;
  }
  const recordFile = join(recordDirPath, 'rundata.json');
  if (!existsSync(recordFile)) {
    return undefined;
  }
  try {
    const rundata = JSON.parse(readFileSync(recordFile, 'utf8'));
    const kernelAicorePath = rundata.kernel_aicore_path;
    if (typeof kernelAicorePath === 'string' && kernelAicorePath && existsSync(kernelAicorePath)) {
      return kernelAicorePath;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
