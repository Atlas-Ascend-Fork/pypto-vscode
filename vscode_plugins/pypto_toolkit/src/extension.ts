import 'core-js/stable/structured-clone';

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
import { PyptoJitCodeLensProvider } from './view/pyptoJitCodeLensProvider';
import { PyptoJitService } from './services/pyptoJitService';


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
      vscode.window.showWarningMessage(msg, reloadBtn).then(selection => {
        if (selection === reloadBtn) {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
    } catch (err) {
      console.warn(`Failed to uninstall extension ${oldExtensionId}:`, err);
      // 卸载失败：提示手动操作
      const msg = i18next.t('pypto.ExtensionWarned', { oldExtensionName: oldExtensionName });
      const openExtensionsBtn = i18next.t('pypto.confirm');
      vscode.window.showErrorMessage(msg, openExtensionsBtn).then(selection => {
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

  // 注册CodeLens提供者
  const codeLensProvider = new PyptoJitCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'python' }, codeLensProvider)
  );

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
    })
  );

  if (window.registerWebviewPanelSerializer) {
    window.registerWebviewPanelSerializer('swimLaneOpen', {
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
  vscode.commands.registerCommand('PyPTO.Open.deletePersistFile', async () => {
    const yes = 'Clear';
    const pick = await vscode.window.showWarningMessage(t('pypto.clearAllCache'), { modal: true }, yes);
    if (pick !== yes) return;
    await SQLiteCache.getInstance().deleteForCommand();
    await clearAllStores();
    vscode.window.showInformationMessage(t('pypto.cacheAlreadyCleared'));
  });

  vscode.commands.registerCommand('PyPTO.Open.OpenWelcomeGuide', async () => {
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
