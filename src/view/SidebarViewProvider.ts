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

import { getIDETheme } from '../theme';
import { useRequestServer } from '../core/request-server';
import type { ViewQuery } from '../core/view/view-query';
import { getWebviewEntryCode } from '../core/editorView';
import { makeViewServerContext } from '../core/view/view-server-context';
import { SidebarViewServer } from './servers/sidebar-view-server';
import { makeViewServerConfig } from '../core/view/view-server';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'PyPTO-Open-Toolkit-Sidebar';

  private servers: ReturnType<typeof useRequestServer>;

  constructor() {
    this.servers = useRequestServer();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };

    const viewQuery: ViewQuery = {
      _viewType: 'returnSidBar',
      _path: '',
      _uri: vscode.Uri.parse(''),
      _server: makeViewServerConfig(SidebarViewServer),
    };
    webviewView.webview.html = getWebviewEntryCode(webviewView.webview, viewQuery);

    this.startViewServer(webviewView.webview);

    this.servers.addWebview(webviewView.webview);

    //  主题变化自动刷新
    vscode.window.onDidChangeActiveColorTheme(() => webviewView.webview.postMessage({ command: 'returnTheme', data: getIDETheme() }), null);

    // 监听侧边栏显隐
    webviewView.onDidChangeVisibility(() => {
      webviewView.webview.postMessage({
        type: 'SIDEBAR_VISIBILITY_CHANGED',
        isVisible: webviewView.visible
      });
    });
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
