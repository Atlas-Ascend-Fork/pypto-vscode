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
import 'core-js/stable/structured-clone';

import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, window, env } from 'vscode';
import * as vscode from 'vscode';

import * as translationEN from '../package.nls.json';
import * as translationCN from '../package.nls.zh-cn.json';

import { RegisterCommand } from './command/registerCommand';
import { globalConfig } from './config/config';
import { initRequestServer } from './core/request-server';
import { SQLiteCache } from './core/sqliteCache';
import { clearAllStores, initStores } from './core/store';
import { hismartliteEx } from './hismarliteEx';
import { closeAllServices, serviceApis, startAllServices } from './services';
import { initView } from './view';
import { loadMaterialColorUtilities } from './color-list';
import { SidebarViewProvider } from './view/SidebarViewProvider';
import { t } from 'i18next';
import { openPyPTOWelcome } from './services/tmp-view-opener';
import { PyptoJitCodeLensProvider } from './view/pyptoJitCodeLensProvider';
import { PyptoJitService } from './services/pyptoJitService';
import { SampleManager } from './services/welcome/sample';

const i18next = require('i18next');
const config = globalConfig;

// 导出模块级变量，供其他文件访问
export let extensionContext: vscode.ExtensionContext | undefined;
export let sampleManager: SampleManager;

export async function activate(context: ExtensionContext) {
  extensionContext = context;

  const resources = {
    en: {
      translation: translationEN,
    },
    zh: {
      translation: translationCN,
    },
  };
  // 1. 初始化
  i18next.init({
    resources,
    fallbackLng: env.language,
    interpolation: { escapeValue: false },
  });

  // 旧版本检查
  const delay = 5000;
  setTimeout(async () => {
    const oldExtensionId = 'hismartliteopen.pypto-toolkit';
    const oldExtensionName = 'PyPTO Toolkit';

    const ext = vscode.extensions.getExtension(oldExtensionId);
    if (!ext?.isActive) {
      return; // 未安装或未激活，直接退出
    }

    try {
      await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', oldExtensionId);
      // 卸载成功：提示重启
      const msg = i18next.t('pypto.ExtensionUninstalledPleaseReload');
      const reloadBtn = i18next.t('pypto.confirm');
      vscode.window.showWarningMessage(msg, reloadBtn).then((selection) => {
        if (selection === reloadBtn) {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
    } catch (err) {
      console.warn(`Failed to uninstall extension ${oldExtensionId}:`, err);
      // 卸载失败：提示手动操作
      const msg = i18next.t('pypto.ExtensionWarned', { oldExtensionName: oldExtensionName });
      const openExtensionsBtn = i18next.t('pypto.confirm');
      vscode.window.showErrorMessage(msg, openExtensionsBtn).then((selection) => {
        if (selection === openExtensionsBtn) {
          vscode.commands.executeCommand('workbench.extensions.search', `@installed pypto`);
        }
      });
    }
  }, delay);

  await hismartliteEx.initHismartliteEx(context);
  const registerCommand = new RegisterCommand(context);
  if (config.IS_USE_DB) {
    await initDB(context);
  }
  await loadMaterialColorUtilities();
  fixExecutablePermissions(context);

  // 启动存储
  initStores(context);
  // 启动接口
  const requestServer = initRequestServer(serviceApis);
  // 启动服务
  startAllServices(context);
  // 启动编辑区视图
  const editorView = initView((viewPanel) => {
    requestServer.addWebview(viewPanel.webview);
  });
  registerCommand.register(editorView);

  const sidebarViewProvider = new SidebarViewProvider();

  vscode.window.registerWebviewViewProvider(
    SidebarViewProvider.viewType, // 页面 ID
    sidebarViewProvider, // 页面实例
    { webviewOptions: { retainContextWhenHidden: true } }, // 界面不可见时仍然保留内容
  );

  // 注册CodeLens提供者
  const codeLensProvider = new PyptoJitCodeLensProvider();
  context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'python' }, codeLensProvider));
  // 注册向导功能
  vscode.commands.registerCommand('PyPTO.Open.OpenWelcomeGuide', async () => {
    openPyPTOWelcome();
  });
  // 注册 PyptoJit 命令
  context.subscriptions.push(
    vscode.commands.registerCommand('pypto.setDebugOptions', (uri: vscode.Uri, lineNumber: number) => {
      PyptoJitService.setDebugOptions(uri, lineNumber);
    }),
    vscode.commands.registerCommand('pypto.unsetDebugOptions', (uri: vscode.Uri, lineNumber: number) => {
      PyptoJitService.unsetDebugOptions(uri, lineNumber);
    }),
    vscode.commands.registerCommand('pypto.setAllDebugMode', (uri: vscode.Uri) => {
      PyptoJitService.setAllDebugMode(uri);
    }),
    vscode.commands.registerCommand('pypto.unsetAllDebugMode', (uri: vscode.Uri) => {
      PyptoJitService.unsetAllDebugMode(uri);
    }),
  );

  sampleManager = new SampleManager();
  sampleManager.prepare();
}

async function initDB(context: ExtensionContext) {
  await SQLiteCache.init(context);
  // 文件修改监听
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');
  watcher.onDidChange((uri) => SQLiteCache.getInstance().comGraphDataDelete(uri.fsPath));
  watcher.onDidDelete((uri) => SQLiteCache.getInstance().comGraphDataDelete(uri.fsPath));
  // 2. 注册命令
  vscode.commands.registerCommand('PyPTO.Open.deletePersistFile', async () => {
    const yes = 'Clear';
    const pick = await vscode.window.showWarningMessage(t('pypto.clearAllCache'), { modal: true }, yes);
    if (pick !== yes) return;
    await SQLiteCache.getInstance().deleteForCommand();
    await clearAllStores();
    vscode.window.showInformationMessage(t('pypto.cacheAlreadyCleared'));
  });

  // 切换布局引擎（PyPTOToolkitOpen.enableNativeLayout）后，已有布局缓存来自旧引擎，
  // 调用上面的命令清理持久化缓存，避免读取到旧引擎的布局结果
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('PyPTOToolkitOpen.enableNativeLayout')) {
        vscode.commands.executeCommand('PyPTO.Open.deletePersistFile');
      }
    }),
  );

  // 3. 监听停用
  context.subscriptions.push(watcher, {
    dispose: () => SQLiteCache.getInstance().clearCache(),
  });

  // 首次安装清理数据库缓存持久化文件
  const key = 'SqlDataVersions';
  const extensionId = 'cann-pub.pypto-toolkit';
  const ext = vscode.extensions.getExtension(extensionId);
  const version = ext?.packageJSON.version;
  console.log('当前插件版本：' + version);
  const isInstall = context.globalState.get<string>(key);
  if (!isInstall || isInstall !== version) {
    console.log('首次使用新版本插件');
    SQLiteCache.getInstance().clearCache();
  }
  await context.globalState.update(key, version);
}

export async function deactivate() {
  closeAllServices();
}

/**
 * Windows 打包（vsce）时，VSIX 中文件权限由 yazl 从 fs.stat 读取，
 * 但 NTFS 不支持 Unix 可执行位，导致 @pypto/data-compress 中的原生可执行文件
 * （swimlane-parser-linux/linux-arm64/mac）丢失 0o755 权限。
 * Mac/Linux 打包时 fs.stat 能正确返回可执行位，无此问题。
 * 此处在非 Windows 平台上显式恢复可执行权限，确保 spawn 调用不会失败。
 */
function fixExecutablePermissions(context: vscode.ExtensionContext) {
  if (process.platform === 'win32') {
    return;
  }
  try {
    const staticDir = path.join(context.extensionPath, 'node_modules', '@pypto', 'data-compress', 'build', 'static');
    const executables = ['swimlane-parser-linux', 'swimlane-parser-linux-arm64', 'swimlane-parser-mac'];
    executables
      .map((exe) => path.join(staticDir, exe))
      .filter((exePath) => fs.existsSync(exePath))
      .forEach((exePath) => fs.chmodSync(exePath, 0o755));
  } catch (err) {
    console.warn('Failed to fix executable permissions for @pypto/data-compress:', err);
  }
}
