/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { OutputDetail, OutputRecord } from '../../types/workspace';
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

  /** 强制重新读取文件 */
  forceReloadFromFiles?: boolean;

  /** 是否三栏视图 */
  isThreeColumnNotNull?: boolean;

  /** 搜索关键词 */
  titleKeyword?: string;

  /** 是否精确匹配 */
  isExactMatch?: boolean;
}

export interface GetOutputRecordsRes {
  data: OutputRecord[];
  total: number;
}

/**
 * 获取运行结果记录
 */
export async function getRunDataList(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  const { page, pageSize = 50, sortBy = 'executeTime', sortOrder = 'desc', forceReloadFromFiles, isThreeColumnNotNull = false, titleKeyword, isExactMatch = false } = params;
  const runDataService = useService('runData');
  if (forceReloadFromFiles) {
    await runDataService.scanDirectory();
  }
  const isDefaultSortCondition = sortBy === 'executeTime' && sortOrder === 'desc';
  const waitingCount = isDefaultSortCondition ? page * pageSize : undefined;
  await runDataService.waitForScanning(waitingCount);
  const query = runDataService
    .query()
    .sort(sortBy, sortOrder);
  if (titleKeyword) {
    query.search('title', titleKeyword, isExactMatch);
  }
  // 三栏联动视图确保泳道图文件地址、控制流文件地址存在
  if (isThreeColumnNotNull) {
    query.notNull(['swimlaneGraphFilePath', 'controlFlowFilePath']);
  }
  const total = await query.count();
  const records = await query.slice(pageSize * (page - 1), pageSize * page).exec();
  const list = records.map<OutputRecord>((record) => ({ ...record, directoryTree: undefined }));
  return { data: list, total };
}

/**
 * 删除数据
 */
export async function deleteRunData(params: { directoryPaths: string[] }): Promise<void> {
  const runDataService = useService('runData')
  const recordPromises = params.directoryPaths.map(async (directoryPath) => {
    return await runDataService.getOutputRecord(directoryPath);
  });
  const records = await Promise.all(recordPromises);
  // 过滤掉无效或不存在的记录
  const validRecords = records.filter((record): record is OutputRecord => record !== undefined);
  if (validRecords.length > 0) {
    await runDataService.deleteData(validRecords);
  }
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
  const detail = await runDataService.getOutputDetail(outputDirPath);
  return { data: detail ?? null };
}

export interface GetRunDataBySwimlaneGraphPathParams {
  swimlaneGraphPath: string;
}

/**
 * 根据泳道图路径获取运行结果记录
 * @param swimlaneGraphPath
 * @returns
 */
export async function getRunDataBySwimlaneGraphPath({
  swimlaneGraphPath,
}: GetRunDataBySwimlaneGraphPathParams): Promise<OutputRecord | null> {
  const runDataService = useService('runData');
  const [record] = await runDataService.query().filter({ swimlaneGraphFilePath: swimlaneGraphPath }).exec();
  return record ?? null;
}
