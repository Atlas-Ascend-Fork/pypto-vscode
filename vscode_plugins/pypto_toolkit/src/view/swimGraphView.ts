/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { Uri, WebviewPanel } from 'vscode';
import { hismartliteEx } from '../hismarliteEx';
import { Util } from '../util';
import { join } from 'path';
import { readFileSync} from 'fs';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';

export class SwimData {

  public uri: Uri;
  public fsPath: string;

  constructor(uri: Uri, fsPath: string) {
    this.uri = uri;
    this.fsPath = fsPath;
  }
}

export class SwimGraphView {
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  public panel: any;

  constructor(panel: WebviewPanel, uri: Uri) {
    this.title = 'Swim Lane Graph';
    this.isReveal = false;
    this._disposables = [];

    this.panel = panel;
    this.panel.swimData = new SwimData(uri, uri.fsPath);

    this.initWebViewPanel();

    const context: any = hismartliteEx.context;
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.onDispose();
      },
      null,
      context.subscriptions
    );
    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        const panel: any = this.panel;
        if (panel.msgHandler[message.command]) {
          panel.msgHandler[message.command](panel, message.paramObj);
        }
      },
      undefined,
      this._disposables
    );
  }

  public static revive(panel: WebviewPanel, uri: Uri) {
    new SwimGraphView(panel, uri);
  }

  initWebViewPanel() {
    let replaceParams: any[] = [];
    const htmlPath = join(hismartliteEx.extensionPath, 'webview-dist', 'index.html');
    let documentText = readFileSync(htmlPath);
    let webviewText = this.panel.webview.asWebviewUri(Uri.file(join(hismartliteEx.extensionPath)));
    let html = documentText.toString()
      .replace(/{{root}}/g, webviewText)
      .replace(/{{staticPath}}/g, `${webviewText}/webview-dist`)
      .replace(/{{ascTheme}}/g, getIDETheme())
      .replace(/{{ascLang}}/g, getIDELang());
    this.panel.webview.html = new Util().replaceHtmlFromData(replaceParams, html);
  }

 private onDispose() {
    this.panel = null;
    this.closeWebViewPanel();
  }

 private closeWebViewPanel() {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}



