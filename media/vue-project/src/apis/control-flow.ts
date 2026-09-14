/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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