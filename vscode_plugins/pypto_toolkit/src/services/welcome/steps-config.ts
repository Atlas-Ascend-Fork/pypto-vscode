/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { UpdateWelcomeStateParams } from '../../types/welcome';
import { extensionContext } from '../../extension';
import * as vscode from 'vscode';

export async function registerWebviewMessageListener(message) {
  if (!extensionContext) {
    vscode.window.showErrorMessage('插件未激活，无法获取上下文！');
    return;
  }
  switch (message.type) {
    // 1. 更新引导进度（转发到所有WebView，同步进度）
    case 'updateGuideProgress': {
      const { bigGroup, smallIndex } = message.data;
      // 持久化进度到globalState
      await extensionContext.globalState.update('guide.currentBigGroup', bigGroup);
      await extensionContext.globalState.update('guide.currentSmallIndex', smallIndex);
      break;
    }
  }
}

/**
 * 更新引导进度
 * @param params
 */
export async function updateWelcomeState(params: UpdateWelcomeStateParams) {
  if (!extensionContext) {
    return;
  }
  await extensionContext.globalState.update(params.key, params.value);
}

/**
 * 获取引导进度
 * @param params
 */
export async function getWelcomeState(params) {
  if (!extensionContext) {
    return;
  }

  const value = await extensionContext.globalState.get(params.key, 0);
  return value;
}

/**
 * 是否引导中
 */
export async function getIsCompleteBoot() {
  if (!extensionContext) {
    return;
  }

  const value = await extensionContext.globalState.get('guide.state', false);
  return value;
}

/**
 * 是否下次打开引导页面
 */
export async function getIsOpen() {
  if (!extensionContext) {
    return;
  }

  const value = await extensionContext.globalState.get('guide.isOpen', true);
  return value;
}

/**
 * 是否下次打开引导页面
 */
export async function getIsSuccessBoot() {
  if (!extensionContext) {
    return;
  }

  const value = await extensionContext.globalState.get('guide.isOpen', false);
  return value;
}
