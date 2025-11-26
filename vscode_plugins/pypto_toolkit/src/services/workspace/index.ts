import * as vscode from 'vscode';

import { OutputDetail, OutputRecord } from '../../types/workspace';
import { getOutputDirectory } from './scan-directory';
import { useService } from '..';

export interface GetOutputRecordParams {
  /** 算子源文件 */
  operatorSourceFile?: string;

  /** 排序属性 */
  sortBy?: 'executeTime';

  /** 正序 or 倒序 */
  sortOrder?: 'asc' | 'desc';
}

export interface GetOutputRecordsRes {
  data: OutputRecord[];
}

/**
 * 获取运行结果记录
 */
export async function getOutputRecords(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  const { sortBy = 'executeTime', sortOrder = 'desc' } = params;
  const runDataService = useService('runData');
  const records = await runDataService.query().sort(sortBy, sortOrder).exec();
  return { data: records };
}

export interface GetOutputDetailParams {
  outputDirPath: string;
}

export interface GetOutputDetailRes {
  data: OutputDetail | null;
}

/**
 * 获取运行结果详情
 */
export async function getOutputDetail({ outputDirPath }: GetOutputDetailParams): Promise<GetOutputDetailRes> {
  const runDataService = useService('runData');
  const [record] = await runDataService.query().filter({ directoryPath: outputDirPath }).exec();
  const outputUri = vscode.Uri.file(outputDirPath);
  const directoryTree = await getOutputDirectory(outputUri, record);
  if (!directoryTree) {
    runDataService.delete(record);
    return { data: null };
  }
  return { data: { ...record, directoryTree } };
}
