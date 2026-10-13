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
import { comGraphStore } from "@/service/com-graph-store";

export function extractOutcasts(jsonData) {
  const outcasts = {};
  if (jsonData.outcasts) {
    jsonData.outcasts.forEach((item, index) => {
      const key = item[0];
      outcasts[key] = index;
    });
  }
  return outcasts;
}

export function extractIncasts(jsonData) {
  const incasts = {};
  if (jsonData.incasts) {
    jsonData.incasts.forEach((item, index) => {
      const key = item[0];
      incasts[key] = index;
    });
  }
  return incasts;
}

export function extractRawTensors(jsonData) {
  const rawtensorMap = {};
  if (jsonData.rawtensors) {
    jsonData.rawtensors.forEach (rawtensor => {
      rawtensorMap[rawtensor.rawmagic] = rawtensor;
    });
  }
  return rawtensorMap;
}

export function extractOperationNodes(jsonData) {
  const opMap = {};
  const magicNodeIdMap = {};
  if (jsonData && jsonData.operations && Array.isArray(jsonData.operations)) {
    jsonData.operations.forEach((operation, index) => {
      const curOperation = JSON.parse(JSON.stringify(operation));
      const subgraphId = curOperation.subgraphid !== undefined ? curOperation.subgraphid : -1;

      if (!opMap[subgraphId]) {
       opMap[subgraphId] = {}
      }

      curOperation['node_id'] = `operation-magic-${curOperation.opmagic}-${subgraphId}`;
      curOperation['subgraphid'] = subgraphId;
      curOperation['node_type'] = 'operation';
      opMap[curOperation.subgraphid][curOperation.opmagic] = curOperation;
      magicNodeIdMap[curOperation.opmagic] = curOperation['node_id'];
    });
  }
  comGraphStore.setData('magicNodeIdMap', { ...comGraphStore.data.magicNodeIdMap, ...magicNodeIdMap });
  return opMap;
}

export function extractTensorNodes(jsonData, incasts, outcasts, rawtensorMap) {
  const tensorMap = {};
  const magicNodeIdMap = {};
  if (jsonData && jsonData.tensors && Array.isArray(jsonData.tensors)) {
    jsonData.tensors.forEach(tensor => {
      const curTensor = JSON.parse(JSON.stringify(tensor));
      const subgraphId = curTensor.subgraphid !== undefined ? curTensor.subgraphid : -1;

      if (!tensorMap[subgraphId]) {
        tensorMap[subgraphId] = {}
      }

      curTensor['node_id'] = `tensor-${curTensor.magic}-${subgraphId}`;

      curTensor['subgraphid'] = subgraphId;
      curTensor['node_type'] = 'tensor';
      curTensor['rawtensor_info'] = rawtensorMap[curTensor.rawtensor];

      tensorMap[curTensor.subgraphid][curTensor.magic] = curTensor;
      magicNodeIdMap[curTensor.magic] = curTensor['node_id'];
    });
  }
  comGraphStore.setData('magicNodeIdMap', { ...comGraphStore.data.magicNodeIdMap, ...magicNodeIdMap });
  return tensorMap;
}

export function extractFuncMap(calleehash) {
  const funcMap = {};
  Object.entries(calleehash).forEach(([hash, item]) => {
    const funcNode = {};
    funcNode['func_magicname'] = item.func_magicname;
    funcNode['node_type'] = 'function';
    funcNode['hash'] = hash;
    funcMap[hash] = funcNode;
  });
  return funcMap;
}

export function extractTokenNodeMap(jsonData) {
  const tokennodeMap = {};
  if (jsonData && jsonData.operations && Array.isArray(jsonData.operations)) {
    jsonData.operations.forEach(op => {
      if (op.itokens && Array.isArray(op.itokens)) {
        op.itokens.forEach(token => { tokennodeMap[token] = true; });
      }
      if (op.otokens && Array.isArray(op.otokens)) {
        op.otokens.forEach(token => { tokennodeMap[token] = true; });
      }
    });
  }
  return tokennodeMap;
}

export function searchByToken(tokennodeMap, keyword, isUpper = false, isReg = false) {
  let reg = null;
  if (isReg) {
    try {
      reg = new RegExp(keyword, 'i');
    } catch {
      reg = null;
    }
  }
  return Object.keys(tokennodeMap)
    .filter(token => {
      const str = String(token);
      if (isUpper) return str.includes(keyword);
      return reg ? reg.test(str) : str.toLowerCase().includes(keyword.toLowerCase());
    })
    .map(token => ({
      node_type: 'token',
      node_id: `operation-${token}-0`,
      magic: token,
      subgraphid: 0,
    }));
}


export function searchByTensorMagic(tensorMap, magic) {
  return Object.values(tensorMap)
    .map(subgraph => subgraph[magic])
    .filter(Boolean);
}

export function searchByOperationMagic(operationMap, magic) {
  return Object.values(operationMap)
    .map(subgraph => subgraph[magic])
    .filter(Boolean);
}

export function searchBySubgraphid(tensorMap, operationMap, subgraphid) {
  return [
    ...(tensorMap[subgraphid] ? Object.values(tensorMap[subgraphid]) : []),
    ...(operationMap[subgraphid] ? Object.values(operationMap[subgraphid]) : [])
  ];
}

export function searchByRawTensorMagic(tensorMap, rawtensormagic) {
  return Object.values(tensorMap)
    .flatMap(subgraph => Object.values((subgraph)))
    .filter(tensor =>
      tensor.rawtensor == rawtensormagic
    );
}

export function searchByTensorSemanticLabel(tensorMap, semantic_label) {
  return Object.values(tensorMap)
    .flatMap(subgraph => Object.values((subgraph)))
    .filter(tensor =>
      tensor.semantic_label?.label.includes(semantic_label)
    );
}

//FuzzSearch
function searchByFunctionHash(functionMap, hash, isUpper = false, isReg = false) {
    let reg = null;
  if (isReg) {
    try {
      reg = new RegExp(hash, 'i');
    } catch {
      reg = null;
    }
  }
  if (reg) {
    return Object.entries(functionMap)
    .filter(([funcHash]) => reg.test(funcHash))
    .map(([, value]) => value);
  }
  return Object.entries(functionMap)
    .filter(([funcHash]) => funcHash.includes(hash))
    .map(([, value]) => value);
}

//FuzzSearch 
function searchByFunctionName(functionMap, name, isUpper = false, isReg = false) {
  let reg = null;
  if (isReg) {
    try {
      reg = new RegExp(name, 'i');
    } catch {
      reg = null;
    }
  }
  if (reg) {
    return Object.values(functionMap)
      .filter(item => reg.test(item.func_magicname));
  }
  if (isUpper) {
    return Object.values(functionMap)
      .filter(item => {
        return item.func_magicname.includes(name);
      });
  }
  let lowerName = name.toLowerCase();
  return Object.values(functionMap)
    .filter(item => item.func_magicname.toLowerCase().includes(lowerName));
}

//for list of Objects, deduplicate by key
const uniqueByKey = (arr, key) => [
  ...new Map(arr.map(it => [it[key], it])).values()
];

export function searchByFunctionFuzz(functionMap, keyword) {
  let res = [
        ...searchByFunctionHash(functionMap, keyword),
        ...searchByFunctionName(functionMap, keyword)
      ];
  return uniqueByKey(res, 'hash');
}

//search keyword in each node's each field
export function searchFuzzy(tensorMap, operationMap, rawtensorMap, funcMap, keyword, type, isUpper = false, isReg = false) {

  let reg = null;
  if (isReg) {
    try {
      reg = new RegExp(keyword, 'i');
    } catch {
      reg = null;
    }
  }

  const isMatch = obj => {
    return Object.values(obj).some(value => {
      if (value && typeof value === 'object') {
        //recursive check
        return isMatch(value);
      }
      const str = String(value);
      if (isUpper) {
        return str.includes(keyword);
      }
        return reg ? reg.test(str) : str.toLowerCase().includes(keyword.toLowerCase());
    });
  };

  const searchMap = map => 
    Object.values(map)
      .flatMap(subgraph => Object.values(subgraph))
      .filter(element => isMatch(element));

  switch (type) {
    case 'Tensor':
      return [...searchMap(tensorMap)];
    case 'Operation':
      return [...searchMap(operationMap)];
    case 'Subgraph':
      return searchBySubgraphid(tensorMap, operationMap, keyword);
    case 'Rawtensor':
      let rawmagics = Object.entries(rawtensorMap)
        .filter(([key, value]) => isMatch(value))
        .map(([key])=> key);
      return rawmagics.flatMap(rawmagic => searchByRawTensorMagic(tensorMap ,rawmagic));
    default:
      return [
        ...searchMap(tensorMap),
        ...searchMap(operationMap)
        ];
  }
}

export function findNodeIdsBySemanticLabel(jsonData: Object, semantic_label: string) {
  const ids: string[] = [];
  for (const op of jsonData.operations ?? []) {
    if (op.semantic_label?.label === semantic_label) {
      const subgraphId = op.subgraphid !== undefined ? op.subgraphid : -1;
      const opNodeId = `operation-magic-${op.opmagic}-${subgraphId}`;
      ids.push(opNodeId);
    }
  }
  for (const t of jsonData.tensors ?? []) {
    if (t.semantic_label?.label === semantic_label) {
      const subgraphId = t.subgraphid !== undefined ? t.subgraphid : -1;
      const tensorNodeId = `tensor-${t.magic}-${subgraphId}`;
      ids.push(tensorNodeId);
    }
  }
  return ids;
}