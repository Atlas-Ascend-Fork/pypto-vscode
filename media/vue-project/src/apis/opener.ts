/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
