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

  private _toSavingKey(viewType: string, uri: vscode.Uri): string {
    return `${viewType}:${uri.path}|${uri.query}`;
  }
}
