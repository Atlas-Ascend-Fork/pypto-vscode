import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';

import { hismartliteEx } from '../hismarliteEx';
import { getIDELang } from '../lang';
import { getIDETheme } from '../theme';

import type { ViewQuery } from './viewQuery';
import { ViewQueryConnector } from './viewQuery';

/** 页面配置 */
export interface EditorViewRaw {
  /** 页面类型（组件路由） */
  viewType: string;

  /** 页面标题 */
  title: string;
}

interface EditorViewState {
  query: ViewQuery;
}

/**
 * 在IDE中间编辑区域显示的自定义视图
 */
export class EditorView {
  /** 页面配置 */
  private viewRawMap: Map<string, EditorViewRaw> = new Map();

  /** 当前打开的页面 */
  private openedViewPanels: Map<string, vscode.WebviewPanel> = new Map();

  /** 页面参数通信器 */
  private queryConnector: ViewQueryConnector;

  /**
   * @param views 页面配置
   * @param onViewActivated 显示页面hook
   * @param onViewDisposed 销毁页面hook
   */
  constructor(
    views: EditorViewRaw[],
    private onViewActivated?: (viewPanel: vscode.WebviewPanel) => void,
    private onViewDisposed?: (viewType: string, uri: vscode.Uri) => void,
  ) {
    for (const viewRaw of views) {
      this.registerViewRaw(viewRaw);
    }
    this.queryConnector = new ViewQueryConnector();
  }

  /**
   * 打开页面
   * @param viewType 页面类型
   * @param uri 文件路径
   * @param column 渲染的窗口分栏
   */
  public open(viewType: string, uri: vscode.Uri, column: vscode.ViewColumn = vscode.ViewColumn.Active): vscode.WebviewPanel {
    const viewKey = makeViewKey(viewType, uri);

    // 已打开，切换至该页面
    if (this.openedViewPanels.has(viewKey)) {
      return this.switchToOpenedPanel(viewKey);
    }

    // 打开新页面
    const viewRaw = this.viewRawMap.get(viewType);
    if (!viewRaw) {
      throw new Error(`Webview - ${viewType} 不存在`);
    }
    const viewPanel = vscode.window.createWebviewPanel(
      viewRaw.viewType,
      viewRaw.title,
      { viewColumn: column },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.activeViewPanel(viewPanel, uri);
    return viewPanel;
  }

  /**
   * 注册页面配置
   * @param viewRaw 页面配置
   */
  private registerViewRaw(viewRaw: EditorViewRaw): void {
    const viewType = viewRaw.viewType;
    this.viewRawMap.set(viewType, viewRaw);

    // IDE重新启动时，重开上次未关闭的页面(仅当前激活的页面触发deserializeWebviewPanel)
    vscode.window.registerWebviewPanelSerializer(viewType, {
      deserializeWebviewPanel: async (webviewPanel, state: EditorViewState) => {
        const { uri } = state?.query ?? {};
        if (!uri) {
          webviewPanel.dispose();
          return;
        }
        this.activeViewPanel(webviewPanel, uri);
      },
    });
  }

  /**
   * 切换至已打开的窗口
   */
  private switchToOpenedPanel(viewKey: string): vscode.WebviewPanel {
    const viewPanel = this.openedViewPanels.get(viewKey)!;
    viewPanel.reveal();
    return viewPanel;
  }

  /**
   * 激活页面
   */
  private activeViewPanel(viewPanel: vscode.WebviewPanel, uri: vscode.Uri): void {
    // 加载html
    const htmlTemplateText = getWebviewEntryCode(viewPanel);
    viewPanel.webview.html = htmlTemplateText;

    // hook
    this.onViewActivated?.(viewPanel);

    // 设置页面参数
    this.queryConnector.setQuery(viewPanel, uri);

    const viewKey = makeViewKey(viewPanel.viewType, uri);
    this.openedViewPanels.set(viewKey, viewPanel);

    // 监听销毁
    viewPanel.onDidDispose(() => {
      this.openedViewPanels.delete(viewKey);
      // hook
      this.onViewDisposed?.(viewPanel.viewType, uri);
    });
  }
}

function makeViewKey(viewType: string, uri: vscode.Uri): string {
  return `${viewType}-${uri.fsPath}`;
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
