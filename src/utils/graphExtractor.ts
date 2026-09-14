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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 */
// src/utils/graphExtractor.ts

/* ==========================================
 * 纯函数：从单图 JSON 里提取各种映射
 * ========================================== */

export interface TensorNode {
  magic: string;
  subgraphid: number;
  rawtensor?: string;
  semantic_label?: {
    filename?: string;
    label?: string;
    lineno?: number;
  };
  [key: string]: any;
}

export interface OpNode {
  opmagic: string;
  subgraphid: number;
  calleehash?: string;
  [key: string]: any;
}

export interface RawTensorNode {
  rawmagic: string;
  [key: string]: any;
}

/* --------------------------------------------------
 * 1. 提取 incasts / outcasts 映射
 * -------------------------------------------------- */
export function extractIncasts(jsonData: any): Record<string, number> {
  const map: Record<string, number> = {};
  if (Array.isArray(jsonData.incasts)) {
    jsonData.incasts.forEach((item: any[], idx: number) => {
      map[item[0]] = idx;
    });
  }
  return map;
}

export function extractOutcasts(jsonData: any): Record<string, number> {
  const map: Record<string, number> = {};
  if (Array.isArray(jsonData.outcasts)) {
    jsonData.outcasts.forEach((item: any[], idx: number) => {
      map[item[0]] = idx;
    });
  }
  return map;
}

/* --------------------------------------------------
 * 2. 原始张量映射  rawmagic -> 节点
 * -------------------------------------------------- */
export function extractRawTensors(jsonData: any): Record<string, RawTensorNode> {
  const map: Record<string, RawTensorNode> = {};
  if (Array.isArray(jsonData.rawtensors)) {
    jsonData.rawtensors.forEach((n: RawTensorNode) => {
      map[n.rawmagic] = n;
    });
  }
  return map;
}

/* --------------------------------------------------
 * 3. 张量节点映射  subgraphId -> magic -> 节点
 * -------------------------------------------------- */
export function extractTensorNodes(
  jsonData: any,
  incasts: Record<string, number>,
  outcasts: Record<string, number>,
  rawTensorMap: Record<string, RawTensorNode>,
): Record<number, Record<string, TensorNode>> {
  const map: Record<number, Record<string, TensorNode>> = {};
  if (!Array.isArray(jsonData.tensors)) return map;

  jsonData.tensors.forEach((n: TensorNode) => {
    const sid = n.subgraphid ?? -1;
    if (!map[sid]) map[sid] = {};
    n.node_id = `tensor-${n.magic}-${sid}`;
    n.node_type = 'tensor';
    n.subgraphid = sid;
    n.rawtensor_info = rawTensorMap[n.rawtensor!];
    map[sid][n.magic] = n;
  });
  return map;
}

/* --------------------------------------------------
 * 4. 算子节点映射  subgraphId -> opmagic -> 节点
 * -------------------------------------------------- */
export function extractOperationNodes(jsonData: any): Record<number, Record<string, OpNode>> {
  const map: Record<number, Record<string, OpNode>> = {};
  if (!Array.isArray(jsonData.operations)) return map;

  jsonData.operations.forEach((n: OpNode) => {
    const sid = n.subgraphid ?? -1;
    if (!map[sid]) map[sid] = {};
    n.node_id = `operation-magic-${n.opmagic}-${sid}`;
    n.node_type = 'operation';
    map[sid][n.opmagic] = n;
  });
  return map;
}

/* --------------------------------------------------
 * 5. 函数节点映射  hash -> 节点
 * -------------------------------------------------- */
export function extractFuncMap(funcHashMap: Record<string, { func_magicname: string }>): Record<string, any> {
  const map: Record<string, any> = {};
  Object.entries(funcHashMap).forEach(([hash, item]) => {
    map[hash] = {
      func_magicname: item.func_magicname,
      node_type: 'function',
      hash,
    };
  });
  return map;
}

/* --------------------------------------------------
 * 6. 搜索函数（模糊 / 正则 / 大小写）
 * -------------------------------------------------- */
function buildReg(keyword: string, isReg: boolean, isUpper: boolean): RegExp | null {
  if (isReg) {
    try {
      return new RegExp(keyword, 'i');
    } catch {
      return null;
    }
  }
  const word = isUpper ? keyword : keyword.toLowerCase();
  return new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export function searchByFunctionHash(funcMap: Record<string, any>, keyword: string, isUpper = false, isReg = false) {
  const reg = buildReg(keyword, isReg, isUpper);
  return Object.entries(funcMap)
    .filter(([hash]) => (reg ? reg.test(hash) : hash.toLowerCase().includes(keyword.toLowerCase())))
    .map(([, node]) => node);
}

export function searchByFunctionName(funcMap: Record<string, any>, keyword: string, isUpper = false, isReg = false) {
  const reg = isReg ? new RegExp(keyword) : null;
  if (reg) {
    return Object.values(funcMap)
      .filter(item => reg.test(item.func_magicname));
  }
  if (isUpper) {
    return Object.values(funcMap)
      .filter(item => {
        return item.func_magicname.includes(keyword);
      });
  }
  let lowerName = keyword.toLowerCase();
  return Object.values(funcMap)
    .filter(item => item.func_magicname.toLowerCase().includes(lowerName));
}

/* --------------------------------------------------
 * 7. 按类别搜索入口
 * -------------------------------------------------- */
export function searchFunc(
  criteria: {
    searchKey: string;
    category?: 'Tensor' | 'Operation' | 'Subgraph' | 'Rawtensor' | 'Function' | '';
    option?: 'magic' | 'semantic_label' | 'id' | 'hash' | 'name';
    isReg?: boolean;
    isUpper?: boolean;
  },
  tensorMap: Record<number, Record<string, TensorNode>>,
  opMap: Record<number, Record<string, OpNode>>,
  rawTensorMap: Record<string, RawTensorNode>,
  funcMap: Record<string, any>,
): any[] {
  const { searchKey, category = '', option = '', isReg = false, isUpper = false } = criteria;
  const reg = buildReg(searchKey, isReg, isUpper);

  const isMatch = (obj: any): boolean => {
    return Object.values(obj).some((v) => (v && typeof v === 'object' ? isMatch(v) : String(v).search(reg!) !== -1));
  };

  switch (category) {
    case 'Function': {
      if (option === 'hash') return searchByFunctionHash(funcMap, searchKey, isUpper, isReg);
      if (option === 'name') return searchByFunctionName(funcMap, searchKey, isUpper, isReg);
      // 默认模糊
      return [...searchByFunctionHash(funcMap, searchKey, isUpper, isReg), ...searchByFunctionName(funcMap, searchKey, isUpper, isReg)];
    }
    case 'Tensor': {
      if (option === 'magic')
        return Object.values(tensorMap)
          .map((m) => m[searchKey])
          .filter(Boolean);
      if (option === 'semantic_label')
        return Object.values(tensorMap)
          .flatMap((m) => Object.values(m))
          .filter((n) => n.semantic_label?.label?.includes(searchKey));
      // 默认模糊
      return Object.values(tensorMap)
        .flatMap((m) => Object.values(m))
        .filter((n) => isMatch(n));
    }
    case 'Operation': {
      if (option === 'magic')
        return Object.values(opMap)
          .map((m) => m[searchKey])
          .filter(Boolean);
      // 默认模糊
      return Object.values(opMap)
        .flatMap((m) => Object.values(m))
        .filter((n) => isMatch(n));
    }
    case 'Subgraph': {
      const sid = Number(searchKey);
      return [...(tensorMap[sid] ? Object.values(tensorMap[sid]) : []), ...(opMap[sid] ? Object.values(opMap[sid]) : [])];
    }
    case 'Rawtensor': {
      if (option === 'magic') {
        return Object.values(tensorMap)
          .flatMap(m => Object.values((m)))
          .filter((n) => n.rawtensor == searchKey);
      }
      // 默认模糊
      return Object.values(tensorMap)
        .flatMap((m) => Object.values(m))
        .filter((n) => n.rawtensor && isMatch(rawTensorMap[n.rawtensor]));
    }
    default:
      // 全图模糊
      return [
        ...Object.values(tensorMap).flatMap((m) => Object.values(m).filter(isMatch)),
        ...Object.values(opMap).flatMap((m) => Object.values(m).filter(isMatch)),
      ];
  }
}
