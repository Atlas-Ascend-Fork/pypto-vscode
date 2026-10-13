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
