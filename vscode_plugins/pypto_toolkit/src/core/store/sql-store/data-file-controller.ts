import * as vscode from 'vscode';

import { Data } from '../types';

export class DataFileController<Item extends Data> {
  constructor(private _storeDirUri: vscode.Uri) {}

  public async read(fileName: string): Promise<Item> {
    const fileUri = vscode.Uri.joinPath(this._storeDirUri, fileName);
    const fileContent = (await vscode.workspace.fs.readFile(fileUri)).toString();
    return JSON.parse(fileContent);
  }

  public async write(item: Item, fileName: string): Promise<void> {
    await vscode.workspace.fs.createDirectory(this._storeDirUri);
    const fileUri = vscode.Uri.joinPath(this._storeDirUri, fileName);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(item), 'utf8'));
  }

  public async delete(fileName: string): Promise<void> {
    const fileUri = vscode.Uri.joinPath(this._storeDirUri, fileName);
    await vscode.workspace.fs.delete(fileUri);
    return;
  }

  public async clear(): Promise<void> {
    await vscode.workspace.fs.delete(this._storeDirUri, { recursive: true });
    return;
  }
}
