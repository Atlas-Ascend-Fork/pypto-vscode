/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

import path from 'path';
import { getComGraphDataSum, getComGraphDataDetail, searchKeyword } from '../common/accurancyAnylasis';

/**
 * 从图文件路径中解析出 Pass 目录名和函数标识名。
 * 消除原 baseGraphMsgHandler.ts 中 3 处重复的路径解析逻辑。
 *
 * 规则：
 *   curPassName = basename(dirname(filePath))   — 即 Pass_xx_xxx
 *   curFuncMagicNameString = basename 从 TENSOR 开始的部分，去掉 _ROOT 后缀
 */
export function parseAccuracyPath(
  filePath: string,
): { curPassName: string; curFuncMagicNameString: string } {
  const curPassName = path.basename(path.dirname(filePath));
  const graphFileName = path.basename(filePath, path.extname(filePath));
  let curFuncMagicNameString = graphFileName.slice(graphFileName.indexOf('TENSOR'));
  const rootSuffix = '_ROOT';
  if (curFuncMagicNameString.endsWith(rootSuffix)) {
    curFuncMagicNameString = curFuncMagicNameString.slice(0, -rootSuffix.length);
  }
  return { curPassName, curFuncMagicNameString };
}

/**
 * 获取精度报告数据并通过 server.setRef 发送给前端。
 */
export async function getAccurancyReport(server: any): Promise<void> {
  const graphData = server.comGraphData;
  const filePath = graphData.fsPath ?? undefined;
  if (!filePath) return;

  const { curPassName, curFuncMagicNameString } = parseAccuracyPath(filePath);

  const errorRawInfo = await getComGraphDataSum(
    filePath, curPassName, curFuncMagicNameString, 30, 0,
    server.query?.flowVerifyPath, server.query?.computeGraphDirPath,
  );
  server.setRef('AccurancyReport', { data: errorRawInfo });
}

/**
 * 搜索精度汇总列表，支持分页和关键词搜索。
 */
export async function searchAccurancySumList(server: any, message: any): Promise<void> {
  const graphData = server.comGraphData;
  const filePath = graphData.fsPath ?? undefined;
  if (!filePath) return;

  const { curPassName, curFuncMagicNameString } = parseAccuracyPath(filePath);

  const pageSize = message.data.pageSize ?? 30;
  const startOffset = (message.data.startOffset * pageSize);
  const keyword = message.data.keyword ?? '';

  const errorRawInfo = await searchKeyword(
    filePath, curPassName, curFuncMagicNameString, keyword, pageSize, startOffset,
    server.query?.flowVerifyPath, server.query?.computeGraphDirPath,
  );
  server.setRef('AccurancyList', { data: errorRawInfo });
}

/**
 * 获取精度详细数据（按 loopInfo + rawMagic 过滤）。
 */
export async function getAccurancyDetail(server: any, message: any): Promise<void> {
  const graphData = server.comGraphData;
  const filePath = graphData.fsPath ?? undefined;
  if (!filePath) return;

  const { curPassName, curFuncMagicNameString } = parseAccuracyPath(filePath);

  const loopInfo = message.data.loopInfo;
  const rawMagic = message.data.rawMagic;
  const errorRawInfo = await getComGraphDataDetail(
    filePath, curPassName, curFuncMagicNameString, loopInfo, rawMagic, 10000, 0,
    server.query?.flowVerifyPath, server.query?.computeGraphDirPath,
  );
  server.setRef('AccurancyDetail', { data: errorRawInfo });
}
