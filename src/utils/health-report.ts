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
import fs from 'node:fs';

import { loadStreamJsonToolkit } from './stream-json-loader';

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

async function readHealthyJson(fsPath: string): Promise<object> {
  const { parser, streamValues } = await loadStreamJsonToolkit();
  return new Promise<object>((resolve) => {
    const res: object = {};
    fs.createReadStream(fsPath)
      .pipe(parser.asStream())
      .pipe(streamValues.asStream())
      .on('data', (d) => Object.assign(res, d.value))
      .on('end', () => resolve(res));
  });
}
