import { request } from '../core/request';

const OPENER_PREFIX = 'tmpViewOpener';

/**
 * 打开控制流
 */
export function openControlFlow(params: { outputPath: string; controlFlowPath: string }) {
  request.post(`${OPENER_PREFIX}/openControlFlow`, params);
}

/**
 * 打开计算图
 */
export function openComputeGraph(params: { outputPath?: string; computeGraphPath: string; pathName?: string }) {
  request.post(`${OPENER_PREFIX}/openComputeGraph`, params);
}

/**
 * 打开泳道图
 */
export function openSwimlaneGraph(params: { swimlaneGraphPath: string }) {
  request.post(`${OPENER_PREFIX}/openSwimlaneGraph`, params);
}

/**
 * 打开配置
 */
export function openPtoConfig(params: { configPath: string; pathName: string }) {
  request.post(`${OPENER_PREFIX}/openPtoConfig`, params);
}
