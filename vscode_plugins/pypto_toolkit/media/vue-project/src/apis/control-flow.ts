import { request, RequestOptions } from '@/core/request';

import type { GetControlFlowParams, GetControlFlowRes } from '../../../../src/services/control-flow';

const CONTROL_FLOW_PREFIX = 'controlFlow';

/**
 * 获取控制流
 */
export function getControlFlow(params: GetControlFlowParams, options?: RequestOptions): Promise<GetControlFlowRes> {
  return request.post(`${CONTROL_FLOW_PREFIX}/getControlFlow`, params, options);
}
