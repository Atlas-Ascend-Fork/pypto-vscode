const metaKeys = [
  'timeUnit',
  'timeDenominator',
  't0',
  'addrUnit',
  'memTypeSource',
  'regions',
  'memoryScope',
  'reuseSegmented',
  'rawShapeAvailable',
  'viewAxisShape',
  'validation',
];

const regionKeys = [
  'regionId',
  'addr0',
  'addrEnd',
  'span',
  'occupiedBytes',
  'fill',
  'count',
  'totalBytes',
  'workspaceCount',
  'globalCount',
];

const rawTensorKeys = [
  'rawId',
  'instanceId',
  'base',
  'end',
  'size',
  'memType',
  'isWorkspace',
  'ndim',
  'logicalShape',
  'accesses',
  'regionId',
];

const accessKeys = [
  'seqNo',
  'taskId',
  'funcId',
  'opIdx',
  'rootIndex',
  'isWrite',
  'offset',
  'shape',
  'rawShape',
  'overflow',
  'execStart',
  'execEnd',
  'timeResolved',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasKeys(value: unknown, keys: string[]): boolean {
  return isObject(value) && keys.every((key) => key in value);
}

function hasKeysForEachItem(value: unknown, keys: string[]): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((item) => hasKeys(item, keys));
}

export function validateMemoryData(data: any): boolean {
  if (!hasKeys(data, ['meta', 'rawTensors'])) {
    return false;
  }

  const { meta, rawTensors } = data;

  if (!hasKeys(meta, metaKeys)) {
    return false;
  }

  if (!hasKeysForEachItem(meta.regions, regionKeys)) {
    return false;
  }

  if (!hasKeysForEachItem(rawTensors, rawTensorKeys)) {
    return false;
  }

  return rawTensors.every((tensor) => {
    if (!isObject(tensor)) {
      return false;
    }

    return hasKeysForEachItem(tensor.accesses, accessKeys) && tensor.accesses.every((access) => access.isWrite === true || access.isWrite === false);
  });
}
