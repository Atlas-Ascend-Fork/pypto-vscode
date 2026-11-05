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
import { readFileSync, statSync } from 'fs';
import { isAbsolute, resolve } from 'path';

import { defineAttributes, SqlStore, Store } from '../../core/store';

/** py 语义高亮映射：pyFile → { lineno → label } */
export type ThreeColumnSemanticObj = Record<string, Record<number, string | undefined>>;

// three_column_semantic 表：计算图文件的语义高亮映射缓存（整行大 JSON，粒度对齐 control_flow）
export interface ThreeColumnSemanticItem {
  /** 计算图文件绝对路径 */
  filePath: string;
  /** 计算图文件 mtimeMs（严格相等才命中） */
  mtime: number;
  semanticObj: ThreeColumnSemanticObj;
}

const THREE_COLUMN_SEMANTIC_ATTRIBUTES = defineAttributes<ThreeColumnSemanticItem>({
  filePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  mtime: { type: Number, isQuery: true },
  semanticObj: { type: Object },
});

let semanticStore: Store<ThreeColumnSemanticItem, 'filePath' | 'mtime'>;

export function getThreeColumnSemanticStore(): Store<ThreeColumnSemanticItem, 'filePath' | 'mtime'> {
  if (!semanticStore) {
    semanticStore = new SqlStore('three_column_semantic', THREE_COLUMN_SEMANTIC_ATTRIBUTES);
  }
  return semanticStore;
}

/** 查缓存：文件 mtimeMs 与入库时严格相等才命中；文件不存在/不匹配返回 undefined */
export async function getSemanticFromCache(filePath: string): Promise<ThreeColumnSemanticObj | undefined> {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
  const [row] = await getThreeColumnSemanticStore().query().filter({ filePath }).exec();
  return row && row.mtime === mtimeMs ? row.semanticObj : undefined;
}

/** 写缓存（mtime 取当前文件值，覆盖同 filePath 旧条目） */
export async function saveSemanticToCache(filePath: string, semanticObj: ThreeColumnSemanticObj): Promise<void> {
  const mtime = statSync(filePath).mtimeMs;
  await getThreeColumnSemanticStore().set({ filePath, mtime, semanticObj });
}

/**
 * 单遍读取计算图 JSON 并构建语义高亮映射（缓存 miss 时使用）。
 * semantic_label 兼容两种形态：对象（filename/lineno/label）与数组（配合 op.file/op.line 取首个非空 label）。
 */
export async function readAndBuildSemanticObj(graphPath: string, rootPath: string): Promise<ThreeColumnSemanticObj> {
  const jsonData = JSON.parse(readFileSync(graphPath, 'utf8'));
  return buildSemanticObj(jsonData, rootPath);
}

function buildSemanticObj(jsonData: any, rootPath: string): ThreeColumnSemanticObj {
  const semanticObj: ThreeColumnSemanticObj = {};
  if (!jsonData.functions || !Array.isArray(jsonData.functions)) {
    return semanticObj;
  }
  for (const func of jsonData.functions) {
    if (!func.operations || !Array.isArray(func.operations)) {
      continue;
    }
    for (const op of func.operations) {
      const semanticInfo = op.semantic_label;
      if (!semanticInfo) {
        continue;
      }
      const result = getSemanticByType(semanticInfo, op);
      if (!result || !result.filename || result.lineno == null) {
        continue;
      }
      let { lineno, filename, label } = result;
      if (!isAbsolute(filename)) {
        filename = resolve(rootPath, filename);
      }
      if (filename.includes('\\')) {
        const driveLetter = filename[0].toLowerCase();
        const _path = filename.slice(1);
        filename = `${driveLetter}${_path}`;
      }
      if (!semanticObj[filename]) {
        semanticObj[filename] = {};
      }
      semanticObj[filename][lineno] = label;
    }
  }
  return semanticObj;
}

function getSemanticByType(
  semanticInfo: any,
  op: any,
): { lineno: number | undefined; label: string | undefined; filename: string | undefined } | undefined {
  if (Array.isArray(semanticInfo)) {
    if (op.file) {
      return { lineno: op.line, filename: op.file, label: semanticInfo.find((label: string) => label && label.trim() !== '') };
    }
    return undefined;
  }
  if (typeof semanticInfo === 'object') {
    return semanticInfo;
  }
  return undefined;
}
