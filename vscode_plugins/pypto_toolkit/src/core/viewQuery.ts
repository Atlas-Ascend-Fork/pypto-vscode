import * as vscode from 'vscode';

import { WebviewConnector } from './connector';

/**
 * 页面参数
 */
export interface ViewQuery {
  /** 页面类型（组件路由） */
  viewType: string;

  /** 页面标题 */
  title: string;

  /** 文件路径 */
  uri: vscode.Uri;

  [key: string]: unknown;
}

/**
 * 页面参数通信器
 * @description 页面启动时增加pendingQuery，页面加载后推送query
 */
export class ViewQueryConnector {
  /** 页面参数通信器 */
  private queryConnector: WebviewConnector<ViewQuery, null>;

  /** 等待传输的页面参数 */
  private pendingQuery: WeakMap<vscode.Webview, () => void> = new WeakMap();

  constructor() {
    this.initQueryConnector();
  }

  /**
   * 设置页面参数
   */
  public setQuery({ viewType, title, webview }: vscode.WebviewPanel, uri: vscode.Uri, otherQuery: Record<string, unknown> = {}): void {
    const query: ViewQuery = { viewType, title, uri, ...otherQuery };
    this.queryConnector.addWebview(webview);
    this.pendingQuery.set(webview, () => {
      this.queryConnector.send(webview, query);
    });
  }

  /**
   * 初始化页面参数通信器
   */
  private initQueryConnector(): void {
    this.queryConnector = new WebviewConnector('viewQuery');
    this.queryConnector.receive((_, webview) => {
      this.pendingQuery.get(webview)?.();
    });
  }
}
