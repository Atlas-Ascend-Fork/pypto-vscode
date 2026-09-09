/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import type {
  GetOutputDetailParams,
  GetOutputDetailRes,
  GetOutputRecordParams,
  GetOutputRecordsRes,
  GetRunDataBySwimlaneGraphPathParams,
} from 'ext:/services/run-data/api';
import type { OutputRecord } from 'ext:/types/workspace';

import { request, RequestOptions } from '../core/request';

const WORKSPACE_PREFIX = 'workspace';

/**
 * 获取所有运行记录
 */
export function getRunDataList(params: GetOutputRecordParams, options?: RequestOptions): Promise<GetOutputRecordsRes> {
  return request.post(`${WORKSPACE_PREFIX}/getRunDataList`, params, options);
}

/**
 * 删除数据
 */
export function deleteRunData(params: { directoryPaths: string[] }): Promise<void> {
  return request.post(`${WORKSPACE_PREFIX}/deleteRunData`, params);
}

/**
 * 获取运行记录详情（子目录）
 */
export function fetchRunDataDetail(outputDirPath: string): Promise<GetOutputDetailRes> {
  const params: GetOutputDetailParams = { outputDirPath };
  return request.post(`${WORKSPACE_PREFIX}/fetchRunDataDetail`, params);
}

/**
 * 根据泳道图路径获取运行结果记录
 * @param swimlaneGraphPath 泳道图文件路径
 */
export function getRunDataBySwimlaneGraphPath(swimlaneGraphPath: string): Promise<OutputRecord | null> {
  return request.post<GetRunDataBySwimlaneGraphPathParams, OutputRecord | null>(`${WORKSPACE_PREFIX}/getRunDataBySwimlaneGraphPath`, {
    swimlaneGraphPath,
  });
}
