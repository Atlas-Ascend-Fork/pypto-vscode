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
}

export interface GetOutputRecordsRes {
  data: OutputRecord[];
  total: number;
}

/**
 * 获取运行结果记录
 */
export async function getRunDataList(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  const { page, pageSize = 50, sortBy = 'executeTime', sortOrder = 'desc', forceReloadFromFiles, isThreeColumnNotNull = false, titleKeyword } = params;
  const runDataService = useService('runData');
  if (forceReloadFromFiles) {
    runDataService.scanDirectory();
  }
  const isDefaultSortCondition = sortBy === 'executeTime' && sortOrder === 'desc';
  const waitingCount = isDefaultSortCondition ? page * pageSize : undefined;
  await runDataService.waitForScanning(waitingCount);
  let query = runDataService
    .query()
    .sort(sortBy, sortOrder)
  if (titleKeyword) {
    query = query.search('title', titleKeyword)
  }
  // 三栏联动视图确保泳道图文件地址、控制流文件地址存在
  if (isThreeColumnNotNull) {
    query = query.notNull(['swimlaneGraphFilePath', 'controlFlowFilePath'])
  }
  const total = await query.count();
  const records = await query.slice(pageSize * (page - 1), pageSize * page).exec();
  const list = records.map<OutputRecord>((record) => ({ ...record, directoryTree: undefined }));
  return { data: list, total };
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
