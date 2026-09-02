/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
