import * as vscode from 'vscode';

import { getIDETheme } from '../theme';
import { useServer } from '../core/request-server';
import { ViewQuery, ViewQueryConnector } from '../core/view/view-query';
import { getWebviewEntryCode } from '../core/editorView';
import { makeViewServerContext } from '../core/view/view-server-context';
import { SidebarViewServer } from './servers/sidebar-view-server';
import { makeViewServerConfig } from '../core/view/view-server';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'PyPTO-Toolkit-Sidebar';

  private servers: ReturnType<typeof useServer>;
  /** 页面参数通信器 */
  private queryConnector: ViewQueryConnector;

  constructor() {
    this.servers = useServer();
    this.queryConnector = new ViewQueryConnector();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.html = getWebviewEntryCode(webviewView.webview);

    this.startViewServer(webviewView.webview);

    this.servers.addWebview(webviewView.webview);
    const viewQuery: ViewQuery = {
      _viewType: 'returnSidBar',
      _path: '',
      _uri: vscode.Uri.parse(''),
      _server: makeViewServerConfig(SidebarViewServer),
    };
    this.queryConnector.setQuery(webviewView.webview, viewQuery);

    //  主题变化自动刷新
    vscode.window.onDidChangeActiveColorTheme(() => webviewView.webview.postMessage({ command: 'returnTheme', data: getIDETheme() }), null);
  }

  private startViewServer(webview: vscode.Webview): void {
    const panel = {
      webview,
      dispose: () => {
        throw new Error('侧边栏不可销毁');
      },
    };
    const ctx = makeViewServerContext(panel, SidebarViewProvider.viewType);
    const server = new SidebarViewServer(ctx);
    server.created();
  }
}
