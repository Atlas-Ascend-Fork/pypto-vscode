/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

/**
 * 构造子图跳转的 query 参数。
 * 入口图直接返回 oldQuery，非入口图附加子图参数。
 */
export function buildSubgraphQuery(
  entryHash: string,
  oldQuery: any,
  calleehash: string,
  subFuncmagicname: string,
  curPath: string,
  calleeOpMagic: string | undefined,
  calleeOpSubgraphId: string | undefined,
  parentInfo: any,
): any {
  const isEntry = entryHash === calleehash;
  if (isEntry) return oldQuery;
  return {
    ...oldQuery,
    funcHash: calleehash,
    subFuncmagicname,
    curPath,
    calleeOpMagic,
    calleeOpSubgraphId,
    isSearch: oldQuery.isSearch,
    parentInfo,
    nodeMagic: oldQuery.nodeMagic,
  };
}

/**
 * 将精度校验结果应用到 comGraphData 对象。
 * 返回 true 如果应用了结果，false 如果已有数据无需覆盖。
 */
export function applyFailMagicResults(comGraphData: any, failMagicRes: any): boolean {
  if (comGraphData.wrongRawMagicList && comGraphData.failOpMagicList) return false;

  if (!comGraphData.wrongRawMagicList && failMagicRes.accuType === 'brief') {
    comGraphData.wrongRawMagicList = Object.fromEntries(
      Object.entries(failMagicRes.wrongRawMagicList).map(([k, v]) => [k, v instanceof Set ? [...v] : []]),
    );
    return true;
  } else if (!comGraphData.failOpMagicList && failMagicRes.accuType === 'op') {
    comGraphData.failOpMagicList = failMagicRes.failMagicList;
    return true;
  } else if (!comGraphData.failOpMagicList && failMagicRes.accuType === 'task') {
    comGraphData.failMagicList = failMagicRes.failMagicList;
    return true;
  }
  return false;
}
