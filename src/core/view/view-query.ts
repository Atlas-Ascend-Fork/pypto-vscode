/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 */
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
