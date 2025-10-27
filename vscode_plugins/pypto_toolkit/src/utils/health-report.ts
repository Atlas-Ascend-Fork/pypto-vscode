import fs from 'node:fs';

import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';

const HEALTH_REPORT_SUFFIX = [
  ['TensorGraph', '_TensorGraphHealthReport.json'],
  ['TileGraph', '_TileGraphHealthReport.json'],
  ['ExecuteGraph', '_ExecuteGraph_Health_Report.json'],
  ['KernelGraph', '_Kernel_Graph_Health_Report.json'],
];

/**
 * 判断当前文件是否是健康报告
 * @param filename 
 * @returns 
 */
export function isHealthReport(filename: string): boolean {
  return HEALTH_REPORT_SUFFIX.some(([_, suffix]) => filename.endsWith(suffix));
}

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
