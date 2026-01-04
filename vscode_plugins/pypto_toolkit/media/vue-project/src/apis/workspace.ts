import { request, RequestOptions } from '../core/request';
import type { GetOutputDetailParams, GetOutputDetailRes, GetOutputRecordParams, GetOutputRecordsRes } from 'ext:/services/run-data/api';

const WORKSPACE_PREFIX = 'workspace';

/**
 * 获取所有运行记录
 */
export function getRunDataList(params: GetOutputRecordParams, options?: RequestOptions): Promise<GetOutputRecordsRes> {
  return request.post(`${WORKSPACE_PREFIX}/getRunDataList`, params, options);
}

/**
 * 获取运行记录详情（子目录）
 */
export function getOutputDetail(outputDirPath: string): Promise<GetOutputDetailRes> {
  const params: GetOutputDetailParams = { outputDirPath };
  return request.post(`${WORKSPACE_PREFIX}/getOutputDetail`, params);
}
