import fs from 'node:fs';
import path from 'node:path';

import * as vscode from 'vscode';

import { hismartliteEx } from '../../hismarliteEx';
import { getIDELang } from '../../lang';
import { getIDETheme } from '../../theme';
import { ViewQuery, ViewQueryConnector } from '../view/view-query';
import { makeViewServerConfig, ViewServer } from '../view/view-server';
import { makeViewServerContext } from '../view/view-server-context';

import { fromVirtualUri, toVirtualUri } from './virtualUri';
import { OpenedViews } from './openedViews';

/** 页面配置 */
export interface EditorViewRaw {
  /** 页面类型（组件路由） */
  viewType: string;

  /** 页面标题 */
  title: string | ((uri: vscode.Uri) => string);

  /** 页面服务端，每个webview使用独立的实例 */
  viewServer?: typeof ViewServer<never, {}>;
}

export interface EditorViewState {
  _viewType: string;
  _uri: vscode.Uri;
  [key: string]: unknown;
}

interface EditorViewOptions {
  /** 路由参数，页面使用getQuery获取 */
  query?: Record<string, unknown>;

  /** 打开的窗口区域 */
  viewColumn?: vscode.ViewColumn;

  /** 自定义标题 */
  title?: string;
}

const CUSTOM_EDITOR_VIEW_TYPE = 'PyPTO.open.editorView';

/**
 * 在IDE中间编辑区域显示的自定义视图
 */
export class EditorView {
  /** 页面配置 */
  private viewRawMap: Map<string, EditorViewRaw> = new Map();

  /** 页面参数通信器 */
  private queryConnector: ViewQueryConnector;

  /** 已开启的页面 */
  private openedViews: OpenedViews;

  public openServer: Map<string, any>;

  /**
   * @param onViewActivated 显示页面hook
   * @param onViewDisposed 销毁页面hook
   */
  constructor(
    private onViewActivated?: (viewPanel: vscode.WebviewPanel) => void,
    private onViewDisposed?: (viewType: string, uri: vscode.Uri) => void,
  ) {
    this.queryConnector = new ViewQueryConnector();
    this.openedViews = new OpenedViews();
    this.openServer = new Map();
    this.registerSerializer();
  }

  public registerViews(views: EditorViewRaw[]): void {
    for (const viewRaw of views) {
      this.registerViewRaw(viewRaw);
    }
  }

  /**
   * 打开页面
   * @param viewType 页面类型
   * @param uri 文件路径
   * @param column 渲染的窗口分栏
   */
  public open(viewType: string, uri: vscode.Uri, options: EditorViewOptions = {}): void {
    const { viewColumn = vscode.ViewColumn.Active, query, title } = options;
    const viewRaw = this.viewRawMap.get(viewType);
    if (!viewRaw) {
      throw new Error(`Webview - ${viewType} 不存在`);
    }

    const rawTitle: string = viewRaw.title instanceof Function ? viewRaw.title(uri) : viewRaw.title;
    const staticTitle = title ?? rawTitle;
    const virtualUri = toVirtualUri(uri, viewType, query);

    // 避免重复开启
    if (this.openedViews.has(viewType, virtualUri)) {
      this.openedViews.reveal(viewType, virtualUri, viewColumn);
      return;
    }

    const webviewPanel = vscode.window.createWebviewPanel(
      CUSTOM_EDITOR_VIEW_TYPE,
      staticTitle,
      { viewColumn },
      { retainContextWhenHidden: true, enableScripts: true },
    );
    this.activeViewPanel(webviewPanel, viewType, virtualUri);
  }

  /**
   * 关闭所有打开的页面
   */
  public closeAll(): void {
    // 获取所有打开的页面
    const openedViews = this.openedViews.getAll();
    // 关闭所有当前打开的页面
    for (const view of openedViews) {
      view.viewPanel.dispose();
    }
  }

  /**
   * 注册页面配置
   * @param viewRaw 页面配置
   */
  private registerViewRaw(viewRaw: EditorViewRaw): void {
    const viewType = viewRaw.viewType;
    this.viewRawMap.set(viewType, viewRaw);
  }

  /**
   * 注册页面重启序列化
   */
  private registerSerializer() {
    vscode.window.registerWebviewPanelSerializer(CUSTOM_EDITOR_VIEW_TYPE, {
      deserializeWebviewPanel: async (webviewPanel: vscode.WebviewPanel, { _viewType, _uri }: EditorViewState) => {
        // 避免重复开启
        if (this.openedViews.has(_viewType, _uri)) {
          // 增加延迟让切换过程可被人眼感知，避免闪烁效果
          setTimeout(() => {
            this.openedViews.reveal(_viewType, _uri);
            setTimeout(() => {
              webviewPanel.dispose();
            }, 200);
          }, 800);
          return;
        }
        this.activeViewPanel(webviewPanel, _viewType, _uri);
      },
    });
  }

  /**
   * 激活页面
   */
  private activeViewPanel(viewPanel: vscode.WebviewPanel, viewType: string, uri: vscode.Uri): void {
    this.openedViews.set(viewType, uri, viewPanel);

    // 加载html
    const htmlTemplateText = getWebviewEntryCode(viewPanel.webview);
    viewPanel.webview.html = htmlTemplateText;

    // 视图服务
    const { viewServer } = this.viewRawMap.get(viewType) ?? {};
    let server: ViewServer<never, {}>;
    const query = JSON.parse(uri.query);
    const serverKey = `${query._path}_${query.funcHash || ''}_${query.nodeMagic || ''}`;
    if (viewServer) {
      const ctx = makeViewServerContext(viewPanel, viewType, uri);
      server = new viewServer(ctx);
      server.created(ctx);
      this.openServer.set(serverKey, server);
    }

    // 【hook】页面激活
    this.onViewActivated?.(viewPanel);

    // 设置页面参数
    const uriQuery = fromVirtualUri(uri);
    const viewQuery: ViewQuery = {
      ...uriQuery,
      _uri: uri,
      _server: makeViewServerConfig(viewServer),
    };
    this.queryConnector.setQuery(viewPanel.webview, viewQuery);

    // 监听主题变化
    const themeListener = vscode.window.onDidChangeActiveColorTheme(
      () => viewPanel.webview.postMessage({ command: 'returnTheme', data: getIDETheme() }),
      null,
    );

    // 监听销毁
    viewPanel.onDidDispose(() => {
      themeListener.dispose();
      server?.dispose();
      this.openedViews.delete(viewType, uri);
      this.openServer.delete(serverKey);
      // 【hook】页面销毁
      this.onViewDisposed?.(viewType, uri);
    });
  }
}

/**
 * 获取webview入口html文件代码
 */
export function getWebviewEntryCode(webview: vscode.Webview): string {
  /** 扩展根目录相对webview入口的路径 */
  const base = webview.asWebviewUri(vscode.Uri.file(hismartliteEx.extensionPath)).toString();
  const htmlPath = path.join(hismartliteEx.extensionPath, 'webview-dist', 'index.html');
  const htmlCode = fs
    .readFileSync(htmlPath, 'utf-8')
    .replace(/{{root}}/g, base)
    .replace(/{{staticPath}}/g, `${base}/webview-dist`)
    .replace(/{{ascTheme}}/g, getIDETheme())
    .replace(/{{ascLang}}/g, getIDELang());
  return htmlCode;
}
