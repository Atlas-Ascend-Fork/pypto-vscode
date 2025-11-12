import fs from 'node:fs';
import path from 'node:path';

import * as vscode from 'vscode';

import { hismartliteEx } from '../../hismarliteEx';
import { getIDELang } from '../../lang';
import { getIDETheme } from '../../theme';
import { ViewQuery, ViewQueryConnector } from '../view/view-query';
import { makeViewServerConfig, ViewServer } from '../view/view-server';
import { makeViewServerContext } from '../view/view-server-context';

import { EditorViewFileSystemProvider } from './fileSystemProvider';
import { fromVirtualUri, toVirtualUri } from './virtualUri';

/** 页面配置 */
export interface EditorViewRaw {
  /** 页面类型（组件路由） */
  viewType: string;

  /** 页面标题 */
  title: string | ((uri: vscode.Uri) => string);

  /** 页面服务端，每个webview使用独立的实例 */
  viewServer?: typeof ViewServer<string, string>;
}

interface EditorViewOptions {
  /** 路由参数，页面使用getQuery获取 */
  query?: Record<string, unknown>;

  /** 打开的窗口区域 */
  viewColumn?: vscode.ViewColumn;

  /** 自定义标题 */
  title?: string;
}

const CUSTOM_EDITOR_VIEW_TYPE = 'PyPTO.editorView';

/**
 * 在IDE中间编辑区域显示的自定义视图
 */
export class EditorView {
  /** 页面配置 */
  private viewRawMap: Map<string, EditorViewRaw> = new Map();

  /** 页面参数通信器 */
  private queryConnector: ViewQueryConnector;

  /** 正在开启的view */
  private pendingViewPanel: Map<string, (panel: vscode.WebviewPanel) => void> = new Map();

  /**
   * @param onViewActivated 显示页面hook
   * @param onViewDisposed 销毁页面hook
   */
  constructor(
    private onViewActivated?: (viewPanel: vscode.WebviewPanel) => void,
    private onViewDisposed?: (viewType: string, uri: vscode.Uri) => void,
  ) {
    this.queryConnector = new ViewQueryConnector();
    this.registerEditorProvider();
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
  public open(viewType: string, uri: vscode.Uri, options: EditorViewOptions = {}): Promise<vscode.WebviewPanel> {
    const { viewColumn = vscode.ViewColumn.Active, query, title } = options;
    const viewRaw = this.viewRawMap.get(viewType);
    if (!viewRaw) {
      throw new Error(`Webview - ${viewType} 不存在`);
    }

    const rawTitle: string = viewRaw.title instanceof Function ? viewRaw.title(uri) : viewRaw.title;
    const staticTitle = title ?? rawTitle;
    const virtualUri = toVirtualUri(uri, viewType, staticTitle, query);
    vscode.commands.executeCommand('vscode.open', virtualUri, { preview: false, viewColumn });

    return new Promise((resolve) => {
      this.pendingViewPanel.set(virtualUri.path, resolve);
    });
  }

  private registerEditorProvider() {
    // 监听虚拟uri，提供document对象
    new EditorViewFileSystemProvider();

    // 监听文件ext，提供webview编辑器
    vscode.window.registerCustomEditorProvider(
      CUSTOM_EDITOR_VIEW_TYPE,
      {
        resolveCustomTextEditor: (document, webviewPanel) => {
          webviewPanel.webview.options = { enableScripts: true };
          this.activeViewPanel(webviewPanel, document.uri);

          // 提供open方法返回的WebviewPanel
          this.pendingViewPanel.get(document.uri.path)?.(webviewPanel);
          this.pendingViewPanel.delete(document.uri.path);
        },
      },
      {
        // 切换至其他tab时保留webview
        webviewOptions: { retainContextWhenHidden: true },
      },
    );
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
   * 激活页面
   */
  private activeViewPanel(viewPanel: vscode.WebviewPanel, uri: vscode.Uri): void {
    const uriQuery = fromVirtualUri(uri);
    const { viewServer } = this.viewRawMap.get(uriQuery._viewType) ?? {};

    // 加载html
    const htmlTemplateText = getWebviewEntryCode(viewPanel);
    viewPanel.webview.html = htmlTemplateText;

    // 视图服务
    let server: ViewServer<string, string>;
    if (viewServer) {
      const ctx = makeViewServerContext(viewPanel, uriQuery._viewType, uri);
      server = new viewServer(ctx);
      server.created(ctx);
    }
    // hook
    this.onViewActivated?.(viewPanel);

    // 设置页面参数
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
      server?.disposed();
      // hook
      this.onViewDisposed?.(uriQuery._viewType, uri);
    });
  }
}

/**
 * 获取webview入口html文件代码
 */
function getWebviewEntryCode(viewPanel: vscode.WebviewPanel): string {
  /** 扩展根目录相对webview入口的路径 */
  const base = viewPanel.webview.asWebviewUri(vscode.Uri.file(hismartliteEx.extensionPath)).toString();
  const htmlPath = path.join(hismartliteEx.extensionPath, 'webview-dist', 'index.html');
  const htmlCode = fs
    .readFileSync(htmlPath, 'utf-8')
    .replace(/{{root}}/g, base)
    .replace(/{{staticPath}}/g, `${base}/webview-dist`)
    .replace(/{{ascTheme}}/g, getIDETheme())
    .replace(/{{ascLang}}/g, getIDELang());
  return htmlCode;
}

export interface GraphViewOptions {
  /** 面板类型标识，对应 package.json contributes.views */
  viewType: string;
  /** 显示标题 */
  title: string;
  /** 列区域 */
  column?: vscode.ViewColumn;
  /** 额外图标（可选） */
  iconPath?: vscode.Uri;
  calleeOpMagic?: string;
  calleeOpSubgraphId?: string;
}

