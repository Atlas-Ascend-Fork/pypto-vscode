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
import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';

export interface ColumnModeResult {
  columnMode: 3 | 4;
  cceDir?: string;
}

const CCE_DIR_NAME = 'kernel_aicore';
const CCE_MAP_FILE = 'cce_opmagic_map.json';
const RUNDATA_FIXED = join('rundata', 'rundata.json');
const RUNDATA_LEGACY_PREFIX = 'rundata_';
const RUNDATA_LEGACY_FILE = 'rundata.json';

function readRundataKernelAicorePath(outputDir: string): string | undefined {
  const candidates: string[] = [];
  const fixedPath = join(outputDir, RUNDATA_FIXED);
  if (existsSync(fixedPath)) {
    candidates.push(fixedPath);
  }
  try {
    for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(RUNDATA_LEGACY_PREFIX)) {
        const legacyPath = join(outputDir, entry.name, RUNDATA_LEGACY_FILE);
        if (existsSync(legacyPath)) {
          candidates.push(legacyPath);
        }
      }
    }
  } catch {
    return undefined;
  }
  for (const candidate of candidates) {
    try {
      const rundata = JSON.parse(readFileSync(candidate, 'utf8'));
      if (typeof rundata.kernel_aicore_path === 'string' && rundata.kernel_aicore_path.length > 0) {
        return rundata.kernel_aicore_path;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

export function detectColumnMode(comPath: string | undefined): ColumnModeResult {
  if (!comPath) {
    return { columnMode: 3 };
  }
  const outputDir = dirname(comPath);
  let cceDir = join(outputDir, CCE_DIR_NAME);
  if (!existsSync(cceDir)) {
    const rundataCceDir = readRundataKernelAicorePath(outputDir);
    if (!rundataCceDir || !existsSync(rundataCceDir)) {
      return { columnMode: 3 };
    }
    cceDir = rundataCceDir;
  }
  if (!existsSync(join(cceDir, CCE_MAP_FILE))) {
    return { columnMode: 3 };
  }
  return { columnMode: 4, cceDir };
}
