import type { WebviewApi } from 'vscode-webview';
import { computed } from 'vue';

import type { EditorViewState } from 'ext:/core/editorView';

export const vscode = computed<WebviewApi<EditorViewState>>(() => {
  return window.vscode ?? acquireVsCodeApi();
});
