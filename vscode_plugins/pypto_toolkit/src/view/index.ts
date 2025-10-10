import * as vscode from 'vscode';

import { EditorView, EditorViewRaw } from '../core/editorView';
import { EditorViewRoutes, routes } from './routes';

let editorView: EditorView;

export function initView(
  onViewActivated?: (viewPanel: vscode.WebviewPanel) => void,
  onViewDisposed?: (viewType: string, uri: vscode.Uri) => void,
): { editorView: EditorView } {
  const raws = adaptRoutesToViewRaws(routes);
  editorView = new EditorView(raws, onViewActivated, onViewDisposed);
  return { editorView };
}

export function useView(): { editorView: EditorView } {
  return { editorView };
}

function adaptRoutesToViewRaws(routes: EditorViewRoutes): EditorViewRaw[] {
  return Object.entries(routes).map(([viewType, raw]) => ({ viewType, ...raw }));
}
