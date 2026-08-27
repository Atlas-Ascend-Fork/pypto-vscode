/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import 'core-js/stable/structured-clone';

import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, window, env, WebviewPanel } from 'vscode';
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
import { setExtensionContext, setSampleManager } from './extension';

const i18next = require('i18next');
const config = globalConfig;

export async function activate(context: ExtensionContext) {
  setExtensionContext(context);

  const resources = {
    en: {
      translation: translationEN,
    },
    zh: {
      translation: translationCN,
    },
  };
  i18next.init({
    resources,
    fallbackLng: env.language,
    interpolation: { escapeValue: false },
  });

  const delay = 5000;
  setTimeout(async () => {
    const oldExtensionId = 'hismartliteopen.pypto-toolkit';
    const oldExtensionName = 'PyPTO Toolkit';

    const ext = vscode.extensions.getExtension(oldExtensionId);
    if (!ext?.isActive) {
      return;
    }

    try {
      await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', oldExtensionId);
      const msg = i18next.t('pypto.ExtensionUninstalledPleaseReload');
      const reloadBtn = i18next.t('pypto.confirm');
      vscode.window.showWarningMessage(msg, reloadBtn).then((selection) => {
        if (selection === reloadBtn) {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
    } catch (err) {
      console.warn(`Failed to uninstall extension ${oldExtensionId}:`, err);
      const msg = i18next.t('pypto.ExtensionWarned', { oldExtensionName: oldExtensionName });
      const openExtensionsBtn = i18next.t('pypto.confirm');
      vscode.window.showErrorMessage(msg, openExtensionsBtn).then((selection) => {
        if (selection === openExtensionsBtn) {
          vscode.commands.executeCommand('workbench.extensions.search', `@installed pypto`);
        }
      });
    }
  }, delay);

  try {
    await hismartliteEx.initHismartliteEx(context);
  } catch (err) {
    console.error('[PyPTO] initHismartliteEx failed:', err);
  }

  const registerCommand = new RegisterCommand(context);

  try {
    if (config.IS_USE_DB) {
      await initDB(context);
    }
    await loadMaterialColorUtilities();
    fixExecutablePermissions(context);

    initStores(context);
    const requestServer = initRequestServer(serviceApis);
    startAllServices(context);
    const editorView = initView((viewPanel) => {
      requestServer.addWebview(viewPanel.webview);
    });
    registerCommand.register(editorView);
  } catch (err) {
    console.error('[PyPTO] Extension initialization failed:', err);
    registerCommand.register(undefined);
  }

  const sidebarViewProvider = new SidebarViewProvider();

  vscode.window.registerWebviewViewProvider(
    SidebarViewProvider.viewType,
    sidebarViewProvider,
    { webviewOptions: { retainContextWhenHidden: true } },
  );

  const codeLensProvider = new PyptoJitCodeLensProvider();
  context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'python' }, codeLensProvider));
  vscode.commands.registerCommand('PyPTO.Open.OpenWelcomeGuide', async () => {
    openPyPTOWelcome();
  });
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

  if (window.registerWebviewPanelSerializer) {
    window.registerWebviewPanelSerializer('swimLaneOpen', {
      async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: unknown) {
        await loadMaterialColorUtilities();
      },
    });
  }
  const sm = new SampleManager();
  setSampleManager(sm);
  sm.prepare();
}

async function initDB(context: ExtensionContext) {
  await SQLiteCache.init(context);
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');
  watcher.onDidChange((uri) => SQLiteCache.getInstance().comGraphDataDelete(uri.fsPath));
  watcher.onDidDelete((uri) => SQLiteCache.getInstance().comGraphDataDelete(uri.fsPath));
  vscode.commands.registerCommand('PyPTO.Open.deletePersistFile', async () => {
    const yes = 'Clear';
    const pick = await vscode.window.showWarningMessage(t('pypto.clearAllCache'), { modal: true }, yes);
    if (pick !== yes) return;
    await SQLiteCache.getInstance().deleteForCommand();
    await clearAllStores();
    vscode.window.showInformationMessage(t('pypto.cacheAlreadyCleared'));
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('PyPTOToolkitOpen.enableNativeLayout')) {
        vscode.commands.executeCommand('PyPTO.Open.deletePersistFile');
      }
    }),
  );

  context.subscriptions.push(watcher, {
    dispose: () => SQLiteCache.getInstance().clearCache(),
  });

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
