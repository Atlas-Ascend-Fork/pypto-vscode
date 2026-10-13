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
