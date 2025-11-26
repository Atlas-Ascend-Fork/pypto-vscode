import * as vscode from 'vscode';

import { WebviewConnector } from '../connector';
import { ViewServerConfig } from './view-server';

export interface UriQuery {
  /** 页面类型（组件路由） */
  _viewType: string;

  /** 真正的文件路径 */
  _path: string;

  [key: string]: unknown;
}

/**
 * 页面参数
 */
export type ViewQuery = UriQuery & {
  /** 文件路径 */
  _uri: vscode.Uri;

  /** 视图服务配置 */
  _server?: ViewServerConfig;
};

/**
 * 页面参数通信器
 * @description 页面启动时增加pendingQuery，页面加载后推送query
 */
export class ViewQueryConnector {
  /** 页面参数通信器 */
  private queryConnector: WebviewConnector<ViewQuery, null>;

  constructor() {
    this.initQueryConnector();
  }

  /**
   * 设置页面参数
   */
  public setQuery(webview: vscode.Webview, query: ViewQuery): void {
    this.queryConnector.addWebview(webview);
    this.queryConnector.send(webview, query);
  }

  /**
   * 初始化页面参数通信器
   */
  private initQueryConnector(): void {
    this.queryConnector = new WebviewConnector('viewQuery');
  }
}
