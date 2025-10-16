import { request } from '../core/request';
import type { GetControlFlowParams, GetControlFlowRes } from '../../../../src/services/control-flow';

const CONTROL_FLOW_PREFIX = 'controlFlow';

export function getControlFlow(outputDirPath: string): Promise<GetControlFlowRes> {
  const params: GetControlFlowParams = { outputDirPath };
  return request.post(`${CONTROL_FLOW_PREFIX}/getControlFlow`, params);
}
