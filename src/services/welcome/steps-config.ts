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
