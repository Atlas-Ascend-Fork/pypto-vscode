import { request, RequestOptions } from '@/core/request';

import type { GetControlFlowParams, GetControlFlowRes } from '../../../../src/services/control-flow';
import { SourceCodeRequestDto } from 'ext:/types/control-flow/basic-node';
import { CodeSnippetDocument } from 'ext:/types/control-flow/source-code';

const CONTROL_FLOW_PREFIX = 'controlFlow';

/**
 * 获取控制流
 */
export function getControlFlow(params: GetControlFlowParams, options?: RequestOptions): Promise<GetControlFlowRes> {
  return request.post(`${CONTROL_FLOW_PREFIX}/getControlFlow`, params, options);
}

/**
 * 获取控制流代码片段
 */
export function getSnippetCodeText(params: SourceCodeRequestDto): Promise<CodeSnippetDocument> {
  return request.post(`${CONTROL_FLOW_PREFIX}/getSnippetCodeText`, params);
}

/**
 * 打开代码片段源代码文件
 */
export function openControlFlowTargetFile(params: SourceCodeRequestDto): Promise<string> {
  return request.post(`${CONTROL_FLOW_PREFIX}/openControlFlowTargetFile`, params);
}

/**
 * 读取program.json的path
 */
export function readProgramPath(params: { outputPath: string }): Promise<string> {
  return request.post(`${CONTROL_FLOW_PREFIX}/readProgramPath`, params);
}