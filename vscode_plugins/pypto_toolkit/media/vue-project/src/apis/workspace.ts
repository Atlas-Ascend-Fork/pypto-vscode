import { request, RequestOptions } from '../core/request';
import type {
  GetOutputDetailParams,
  GetOutputDetailRes,
  GetOutputRecordParams,
  GetOutputRecordsRes,
} from '../../../../src/services/workspace';

const WORKSPACE_PREFIX = 'workspace';

/**
 * 获取所有运行记录
 */
export function getOutputRecords(params: GetOutputRecordParams, options?: RequestOptions): Promise<GetOutputRecordsRes> {
  return request.post(`${WORKSPACE_PREFIX}/getOutputRecords`, params, options);
}

/**
 * 获取运行记录详情（子目录）
 */
export function getOutputDetail(outputDirPath: string): Promise<GetOutputDetailRes> {
  const params: GetOutputDetailParams = { outputDirPath };
  return request.post(`${WORKSPACE_PREFIX}/getOutputDetail`, params);
}
