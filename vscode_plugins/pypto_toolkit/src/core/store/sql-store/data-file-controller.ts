import * as vscode from 'vscode';

import type { Data } from '../types';

import { SqlStoreManager } from './sql-store-manager';

export class DataFileController<Item extends Data> {
  private _storeDirUri: vscode.Uri;

  constructor(storeName: string) {
    this._storeDirUri = SqlStoreManager.getInstance().toUri(storeName);
    vscode.workspace.fs.createDirectory(this._storeDirUri);
  }

  public async read(fileName: string): Promise<Item> {
    const fileUri = vscode.Uri.joinPath(this._storeDirUri, fileName);
    const fileContent = (await vscode.workspace.fs.readFile(fileUri)).toString();
    return JSON.parse(fileContent, reviveDateInJson);
  }

  public async write(item: Item, fileName: string): Promise<void> {
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

const DATE_STR_REG_EXP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

function reviveDateInJson(_: string, value: unknown) {
  if (typeof value === 'string') {
    const matches = DATE_STR_REG_EXP.exec(value);
    if (matches) {
      return new Date(
        Number(matches[1]),
        Number(matches[2]) - 1,
        Number(matches[3]),
        Number(matches[4]),
        Number(matches[5]),
        Number(matches[6]),
      );
    }
  }
  return value;
}
