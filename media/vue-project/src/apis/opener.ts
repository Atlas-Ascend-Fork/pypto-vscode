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
import { request } from '../core/request';

const OPENER_PREFIX = 'tmpViewOpener';

/**
 * 打开控制流
 */
export function openControlFlow(params: { outputPath: string; controlFlowPath: string; isBootStep?: boolean }) {
  return request.post(`${OPENER_PREFIX}/openControlFlow`, params);
}

/**
 * 打开计算图
 */
export function openComputeGraph(params: {
  outputPath?: string;
  computeGraphPath: string;
  pathName?: string;
  isBootStep?: boolean;
  fileType?: string;
  computeGraphDirPath?: string;
  flowVerifyPath?: string;
}) {
  return request.post(`${OPENER_PREFIX}/openComputeGraph`, params);
}

/**
 * 打开泳道图
 */
export function openSwimlaneGraph(params: { swimlaneGraphPath: string; outputPath?: string; isBootStep?: boolean }) {
  return request.post(`${OPENER_PREFIX}/openSwimlaneGraph`, params);
}

/**
 * 打开OpCheck页面
 */
export function openOpCheck(params: { outputPath: string; opeCheckDirPath?: string[] | null; flowVerifyPath?: string; computeGraphDirPath?: string }) {
  return request.post(`${OPENER_PREFIX}/openOpCheck`, params);
}

/**
 * 打开TaskCheck页面
 */
export function openTaskCheck(params: { outputPath: string; taskCheckDirPath?: string[] | null; flowVerifyPath?: string; computeGraphDirPath?: string }) {
  return request.post(`${OPENER_PREFIX}/openTaskCheck`, params);
}

/**
 * 打开配置
 */
export function openPtoConfig(params: { configPath: string; pathName: string; isBootStep?: boolean }) {
  return request.post(`${OPENER_PREFIX}/openPtoConfig`, params);
}

/**
 * 打开欢迎页面
 */
export function openPyPTOWelcome() {
  return request.post(`${OPENER_PREFIX}/openPyPTOWelcome`, null);
}

/**
 * 打开三联动视图
 */
export function openThreeColumnGraph(params: { isBootStep?: boolean; sameplePath: string }) {
  return request.post(`${OPENER_PREFIX}/openThreeColumnGraph`, params);
}

/**
 * 提示rundata.json中配置的计算图文件不存在（VS Code右下角通知）
 */
export function warnComputeGraphNotExist(params: { outputPath: string }) {
  return request.post(`${OPENER_PREFIX}/warnComputeGraphNotExist`, params);
}
