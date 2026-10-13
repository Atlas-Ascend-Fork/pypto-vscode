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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

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
