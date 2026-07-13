/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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