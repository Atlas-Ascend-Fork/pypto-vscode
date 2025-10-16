// src\extension.ts
import { ExtensionContext, window, env, WebviewPanel } from 'vscode';
import * as vscode from 'vscode';

import * as translationEN from '../package.nls.json';
import * as translationCN from '../package.nls.zh-cn.json';

import { RegisterCommand } from './command/registerCommand';
import { globalConfig } from './config/config';
import { ExtensionApiServer } from './core/server';
import { SQLiteCache } from './core/sqliteCache';
import { hismartliteEx } from './hismarliteEx';
import { services } from './services';
import { initView } from './view';
import { SwimGraphView } from './view/swimGraphView.js';
import { GraphView } from './view/graphView';
import { SingleGraphData } from './core/graphData';
import { SingleGraphHandler } from './handler/singleGraphHandler';

const i18next = require('i18next');
const config = globalConfig;
export async function activate(context: ExtensionContext) {
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
  setTimeout(() => {
    const oldExtensions = {
    'hismartliteopen.ascend-devkit': 'Ascend Devkit',
    'hismartliteopen.ascend-cpp-devkit': 'Ascend C++ Devkit',
  };
  const detectedExtensions: string[] = [];
    for (const [oldExtensionId, oldExtensionName] of Object.entries(oldExtensions)) {
      const oldExtension = vscode.extensions.getExtension(oldExtensionId);
      if (oldExtension && oldExtension.isActive) {
        detectedExtensions.push(oldExtensionName);
      }
    }
    if (detectedExtensions.length) {
      vscode.window.showWarningMessage(
        i18next.t('pypto.ExtensionWarned', { oldExtensionName: detectedExtensions.join(', ') }),
        i18next.t('pypto.ExtensionUninstall'),
        i18next.t('pypto.ExtensionIgnore'),
      ).then(selection => {
        if (selection === i18next.t('pypto.ExtensionUninstall')) {
          vscode.commands.executeCommand('workbench.extensions.search', `@installed ascend`)
        }
      });
    }
  }, delay);
  
  await hismartliteEx.initHismartliteEx(context);
  const registerCommand = new RegisterCommand(context);
  registerCommand.register();
  if(config.IS_USE_DB){
    await initDB(context);
  }

  // 启动接口服务
  const server = new ExtensionApiServer(services);
  
  // 启动编辑区视图
  initView((viewPanel) => {
    server.addWebview(viewPanel.webview);
  });

  if (window.registerWebviewPanelSerializer) {
    window.registerWebviewPanelSerializer('swimLane', {
      async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: unknown) {
        SwimGraphView.revive(webviewPanel, context.extensionUri);
      },
    });

    window.registerWebviewPanelSerializer('comItemDetailView', {
      async deserializeWebviewPanel(webviewPanel: WebviewPanel, state) {
        const { fsPath, funcHash, magicName, curPath, calleeOpMagic, calleeOpSubgraphId } = (state as any) || {};
        GraphView.revive(
          webviewPanel,
          SingleGraphData,
          SingleGraphHandler,
          fsPath,
          funcHash,
          magicName,
          curPath,
          calleeOpMagic,
          calleeOpSubgraphId
        );
      },
    });
  }
}

async function initDB(context: ExtensionContext) {
  await SQLiteCache.init(context);
  // 文件修改监听
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');
  watcher.onDidChange((uri) => SQLiteCache.getInstance().comGraphLayoutDel(uri.fsPath));
  watcher.onDidDelete((uri) => SQLiteCache.getInstance().comGraphLayoutDel(uri.fsPath));
  // 2. 注册命令
  
  vscode.commands.registerCommand('PyPTO.deletePersistFile', () => SQLiteCache.getInstance().deleteForCommand());
  // 3. 监听停用
  context.subscriptions.push(watcher, {
    dispose: () => SQLiteCache.getInstance().clearCache(),
  });

  // 首次安装清理数据库缓存持久化文件
  const key = 'SqlDataVersions';
  const extensionId = 'hismartliteopen.pypto-toolkit';
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
}
