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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as vscode from 'vscode';
import { UriQuery } from '../view/view-query';

/**
 * 生成虚拟uri
 * @param uri 原始文件uri
 * @param viewType 视图类型
 * @param subTitle 文件副标题
 * @param query 文件副标题
 * @returns 虚拟uri
 */
export function toVirtualUri(uri: vscode.Uri, viewType: string, query?: Record<string, unknown>): vscode.Uri {
  const uriQuery: UriQuery = { ...query, _path: uri.fsPath, _viewType: viewType };
  return uri.with({ query: JSON.stringify(uriQuery) });
}

/**
 * 解析虚拟uri
 * @param virtualUri 虚拟uri
 * @returns 文件路径 && 视图类型
 */
export function fromVirtualUri(virtualUri: vscode.Uri): UriQuery {
  try {
    return JSON.parse(virtualUri.query);
  } catch {
    throw new Error('VirtualUri参数解析失败');
  }
}
