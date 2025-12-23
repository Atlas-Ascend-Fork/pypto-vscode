import * as vscode from 'vscode';

import { OutputDetail, OutputRecord } from '../../types/workspace';
import { getOutputDirectory } from './scan-directory';
import { useService } from '..';

export interface GetOutputRecordParams {
  /** 页码 */
  page: number;

  /** 分页数量，默认20 */
  pageSize?: number;

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
  const { page, pageSize = 50, sortBy = 'executeTime', sortOrder = 'desc' } = params;
  const runDataService = useService('runData');
  const isDefaultSortCondition = sortBy === 'executeTime' && sortOrder === 'desc';
  const waitingCount = isDefaultSortCondition ? page * pageSize : undefined;
  await runDataService.waitForScanning(waitingCount);
  const records = await runDataService
    .query()
    .sort(sortBy, sortOrder)
    .slice(pageSize * (page - 1), pageSize * page)
    .exec();
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
  const record =await runDataService.getRecordByDirectoryPath(outputDirPath)  ;
  if(!record){
    return { data: null }
  }
  const outputUri = vscode.Uri.file(outputDirPath);
  const directoryTree = await getOutputDirectory(outputUri, record);
  if (!directoryTree) {
    runDataService.delete(record);
    return { data: null };
  }
  return { data: { ...record, directoryTree } };
}
