import { request } from '../core/request';
import type {
  GetOutputDetailParams,
  GetOutputDetailRes,
  GetOutputRecordParams,
  GetOutputRecordsRes,
} from '../../../../src/services/workspace';

const WORKSPACE_PREFIX = 'workspace';

export function getOutputRecords(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  return request.post(`${WORKSPACE_PREFIX}/getOutputRecords`, params);
}

export function getOutputDetail(outputDirPath: string): Promise<GetOutputDetailRes> {
  const params: GetOutputDetailParams = { outputDirPath };
  return request.post(`${WORKSPACE_PREFIX}/getOutputDetail`, params);
}
