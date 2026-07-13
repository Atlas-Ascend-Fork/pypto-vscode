/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import fs from 'node:fs';

import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';

const HEALTH_REPORT_SUFFIX = [
  ['TensorGraph', '_TensorGraphHealthReport.json'],
  ['TileGraph', '_TileGraphHealthReport.json'],
  ['ExecuteGraph', '_ExecuteGraph_Health_Report.json'],
  ['BlockGraph', '_Block_Graph_Health_Report.json'],
];

/**
 * 判断计算图是否有健康报告
 * @param computeGraphPath
 * @returns
 */
export function hasHealthReport(computeGraphPath: string): boolean {
  const base = computeGraphPath.replace(/\.json$/, '');
  for (const [_, suffix] of HEALTH_REPORT_SUFFIX) {
    if (fs.existsSync(`${base}${suffix}`)) {
      return true;
    }
  }
  return false;
}

/**
 * 获取计算图关联的健康报告
 */
export async function getHealthReport(computeGraphPath: string): Promise<Record<string, object>> {
  const base = computeGraphPath.replace(/\.json$/, '');
  const reports: any = {};
  for (const [key, suffix] of HEALTH_REPORT_SUFFIX) {
    const filePath = `${base}${suffix}`;
    reports[key] = fs.existsSync(filePath) ? await readHealthyJson(filePath) : null;
  }
  return reports;
}

function readHealthyJson(fsPath: string): Promise<object> {
  return new Promise<object>((resolve) => {
    const res: object = {};
    fs.createReadStream(fsPath)
      .pipe(parser())
      .pipe(streamValues())
      .on('data', (d) => Object.assign(res, d.value))
      .on('end', () => resolve(res));
  });
}
