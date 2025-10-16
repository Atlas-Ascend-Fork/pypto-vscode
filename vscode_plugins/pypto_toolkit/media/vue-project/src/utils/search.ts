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
  if (jsonData && jsonData.operations && Array.isArray(jsonData.operations)) {
    jsonData.operations.forEach((operation, index) => {
      const subgraphId = operation.subgraphid !== undefined ? operation.subgraphid : -1;

      if (!opMap[subgraphId]) {
       opMap[subgraphId] = {}
      }

      operation['node_id'] = `operation-magic-${operation.opmagic}-${subgraphId}`;
      operation['subgraphid'] = subgraphId;
      operation['node_type'] = 'operation';
      opMap[operation.subgraphid][operation.opmagic] = operation;
    });
  }
  return opMap;
}

export function extractTensorNodes(jsonData, incasts, outcasts, rawtensorMap) {
  const tensorMap = {};
  if (jsonData && jsonData.tensors && Array.isArray(jsonData.tensors)) {
    jsonData.tensors.forEach(tensor => {
      const subgraphId = tensor.subgraphid !== undefined ? tensor.subgraphid : -1;

      if (!tensorMap[subgraphId]) {
        tensorMap[subgraphId] = {}
      }

      tensor['node_id'] = `tensor-${tensor.magic}-${subgraphId}`;

      tensor['subgraphid'] = subgraphId;
      tensor['node_type'] = 'tensor';
      tensor['rawtensor_info'] = rawtensorMap[tensor.rawtensor];

      tensorMap[tensor.subgraphid][tensor.magic] = tensor;
    });
  }
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
      tensor.semantic_label &&
      tensor.semantic_label == semantic_label
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
