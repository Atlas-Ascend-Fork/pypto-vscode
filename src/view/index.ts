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

import { EditorView, EditorViewRaw } from '../core/editorView';
import { EditorViewRoutes, routes } from './routes';

let editorView: EditorView;

export function initView(
  onViewActivated?: (viewPanel: vscode.WebviewPanel) => void,
  onViewDisposed?: (viewType: string, uri: vscode.Uri) => void,
): { editorView: EditorView } {
  const viewRaws = adaptRoutesToViewRaws(routes);
  editorView = new EditorView(onViewActivated, onViewDisposed);
  editorView.registerViews(viewRaws);
  return { editorView };
}

export function useView(): { editorView: EditorView } {
  if (!editorView) throw new Error('EditorView 还未初始化，请先调用 initView()');
  return { editorView };
}

function adaptRoutesToViewRaws(routes: EditorViewRoutes): EditorViewRaw[] {
  return Object.entries(routes).map(([viewType, raw]) => ({ viewType, ...raw }));
}
