import { request } from '../core/request';
import type { OutputRecordParams, OutputRecordsRes } from '../../../../src/services/workspace';

const WORKSPACE_PREFIX = 'workspace';

export function getOutputRecords(params: OutputRecordParams): Promise<OutputRecordsRes> {
  return request.post(`${WORKSPACE_PREFIX}/getOutputRecords`, params);
}
