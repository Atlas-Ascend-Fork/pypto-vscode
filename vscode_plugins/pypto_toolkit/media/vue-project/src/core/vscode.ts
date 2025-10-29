import type { WebviewApi } from 'vscode-webview';
import { computed } from 'vue';

export const vscode = computed<WebviewApi<unknown>>(() => {
  return window.vscode ?? acquireVsCodeApi();
});
