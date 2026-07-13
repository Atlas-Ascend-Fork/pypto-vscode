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

export class OpenedViews {
  private _openedPanels = new Map<string, vscode.WebviewPanel>();

  public set(viewType: string, uri: vscode.Uri, webviewPanel: vscode.WebviewPanel): void {
    const key = this._toSavingKey(viewType, uri);
    this._openedPanels.set(key, webviewPanel);
    webviewPanel.onDidDispose(() => {
      this._openedPanels.delete(key);
    });
  }

  public has(viewType: string, uri: vscode.Uri): boolean {
    const key = this._toSavingKey(viewType, uri);
    return this._openedPanels.has(key);
  }

  public reveal(viewType: string, uri: vscode.Uri, viewColumn?: vscode.ViewColumn): void {
    const key = this._toSavingKey(viewType, uri);
    const openedPanel = this._openedPanels.get(key);
    if (openedPanel) {
      openedPanel.reveal(viewColumn);
      return;
    }
  }

  public delete(viewType: string, uri: vscode.Uri): boolean {
    const key = this._toSavingKey(viewType, uri);
    return this._openedPanels.delete(key);
  }

  public getAll(): { viewType: string; uri: vscode.Uri; viewPanel: vscode.WebviewPanel }[] {
    const openedViews: { viewType: string; uri: vscode.Uri; viewPanel: vscode.WebviewPanel }[] = [];
    
    for (const [key, viewPanel] of this._openedPanels.entries()) {
      const [viewType, uriPathQuery] = key.split(':');
      const [path, query] = uriPathQuery.split('|');
      const uri = vscode.Uri.parse(`file:${path}?${query}`);
      openedViews.push({ viewType, uri, viewPanel });
    }

    return openedViews;
  }

  private _toSavingKey(viewType: string, uri: vscode.Uri): string {
    return `${viewType}:${uri.path}|${uri.query}`;
  }
}
