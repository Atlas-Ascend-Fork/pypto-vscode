import * as vscode from 'vscode';

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

  /** 所属output绝对路径 */
  outputPath?: string;
};
