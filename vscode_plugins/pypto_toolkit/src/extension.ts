import 'core-js/stable';

import { ExtensionContext, window, env, WebviewPanel } from 'vscode';
import * as vscode from 'vscode';

import * as translationEN from '../package.nls.json';
import * as translationCN from '../package.nls.zh-cn.json';

import { RegisterCommand } from './command/registerCommand';
import { globalConfig } from './config/config';
import { initServer } from './core/request-server';
import { SQLiteCache } from './core/sqliteCache';
import { clearAllStores, initStores } from './core/store';
import { hismartliteEx } from './hismarliteEx';
import { closeAllServices, serviceApis, startAllServices } from './services';
import { initView } from './view';
import { SwimGraphView } from './view/swimGraphView.js';
import { loadMaterialColorUtilities } from './color-list';
import { SidebarViewProvider } from './view/SidebarViewProvider';
import { t } from 'i18next';
import { openPyPTOWelcome } from './services/tmp-view-opener';

const i18next = require('i18next');
const config = globalConfig;

// 导出模块级变量，供其他文件访问
export let extensionContext: vscode.ExtensionContext | undefined;

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
      vscode.window
        .showWarningMessage(
          i18next.t('pypto.ExtensionWarned', { oldExtensionName: detectedExtensions.join(', ') }),
          i18next.t('pypto.ExtensionUninstall'),
          i18next.t('pypto.ExtensionIgnore'),
        )
        .then((selection) => {
          if (selection === i18next.t('pypto.ExtensionUninstall')) {
            vscode.commands.executeCommand('workbench.extensions.search', `@installed ascend`);
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
  // 启动存储
  initStores(context);
  // 启动接口

  const server = initServer(serviceApis);
  // 启动服务
  startAllServices();
  // 启动编辑区视图
  const editorView = initView((viewPanel) => {
    server.addWebview(viewPanel.webview);
  });
  registerCommand.register(editorView);

  const sidebarViewProvider = new SidebarViewProvider();

  vscode.window.registerWebviewViewProvider(
    SidebarViewProvider.viewType, // 页面 ID
    sidebarViewProvider, // 页面实例
    { webviewOptions: { retainContextWhenHidden: true } }, // 界面不可见时仍然保留内容
  );

  if (window.registerWebviewPanelSerializer) {
    window.registerWebviewPanelSerializer('swimLane', {
      async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: unknown) {
        await loadMaterialColorUtilities();
        SwimGraphView.revive(webviewPanel, context.extensionUri);
      },
    });
  }
}

async function initDB(context: ExtensionContext) {
  await SQLiteCache.init(context);
  // 文件修改监听
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');
  watcher.onDidChange((uri) => SQLiteCache.getInstance().comGraphDataDelete(uri.fsPath));
  watcher.onDidDelete((uri) => SQLiteCache.getInstance().comGraphDataDelete(uri.fsPath));
  // 2. 注册命令
  vscode.commands.registerCommand('PyPTO.deletePersistFile', async () => {
    const yes = 'Clear';
    const pick = await vscode.window.showWarningMessage(t('pypto.clearAllCache'), { modal: true }, yes);
    if (pick !== yes) return;
    await SQLiteCache.getInstance().deleteForCommand();
    await clearAllStores();
    vscode.window.showInformationMessage(t('pypto.cacheAlreadyCleared'));
  });

  vscode.commands.registerCommand('PyPTO.OpenWelcomeGuide', async () => {
    openPyPTOWelcome();
  });

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
  closeAllServices();
}
