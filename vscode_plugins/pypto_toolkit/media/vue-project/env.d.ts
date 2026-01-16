/// <reference types="@types/vscode-webview" />
/// <reference types="vite/client" />

import { WebviewApi } from 'vscode-webview';
import type { ViewQuery } from 'ext:/core/view/view-query';

declare global {
  interface Window {
    vscode: WebviewApi<unknown>;
    extensionQuery: ViewQuery;
  }
}
