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
