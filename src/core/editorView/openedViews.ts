/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

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
