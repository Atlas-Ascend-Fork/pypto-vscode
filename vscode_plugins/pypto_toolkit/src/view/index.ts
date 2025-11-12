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
