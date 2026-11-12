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

const CCE_DIR_NAME = 'kernel_aicore';
const CCE_MAP_FILE = 'cce_opmagic_map.json';

/**
 * 三/四栏判定，两级顺序：
 * ① 同目录约定：<anchor 目录>/kernel_aicore（与当前加载的 program.json 同源，优先）
 * ② 保底：运行记录（~/.pypto/run/rundata_<ts>/）自己的 rundata.json 里的 kernel_aicore_path
 * 两级都要求 cce_opmagic_map.json 存在才判四栏。
 */
export function detectColumnMode(anchorPath: string | undefined, fallbackCceDir?: string): ColumnModeResult {
  if (anchorPath) {
    const cceDir = join(dirname(anchorPath), CCE_DIR_NAME);
    if (existsSync(join(cceDir, CCE_MAP_FILE))) {
      return { columnMode: 4, cceDir };
    }
  }
  if (fallbackCceDir && existsSync(join(fallbackCceDir, CCE_MAP_FILE))) {
    return { columnMode: 4, cceDir: fallbackCceDir };
  }
  return { columnMode: 3 };
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
