import { UpdateWelcomeStateParams } from '../../types/welcome';
import { extensionContext } from '../../extension';
import * as vscode from 'vscode';

// 注册单个WebView的消息监听
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
