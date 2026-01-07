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
}

export interface GetOutputRecordsRes {
  data: OutputRecord[];
}

/**
 * 获取运行结果记录
 */
export async function getRunDataList(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  const { page, pageSize = 50, sortBy = 'executeTime', sortOrder = 'desc', forceReloadFromFiles } = params;
  const runDataService = useService('runData');
  if (forceReloadFromFiles) {
    runDataService.scanDirectory();
  }
  const isDefaultSortCondition = sortBy === 'executeTime' && sortOrder === 'desc';
  const waitingCount = isDefaultSortCondition ? page * pageSize : undefined;
  await runDataService.waitForScanning(waitingCount);
  const records = await runDataService
    .query()
    .sort(sortBy, sortOrder)
    .slice(pageSize * (page - 1), pageSize * page)
    .exec();
  const list = records.map<OutputRecord>((record) => ({ ...record, directoryTree: undefined }));
  return { data: list };
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
