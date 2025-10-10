/// <reference types="@types/vscode-webview" />
/// <reference types="vite/client" />

import { WebviewApi } from 'vscode-webview';

declare global {
  interface Window {
    vscode: WebviewApi<unknown>;
  }
}
