import fs from 'node:fs';

import * as vscode from 'vscode';

import { fromVirtualUri, VIRTUAL_SCHEME } from './virtualUri';

const emptyDisposable: vscode.Disposable = { dispose: () => null };

export class EditorViewFileSystemProvider implements vscode.FileSystemProvider, vscode.Disposable {
  private changeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

  constructor() {
    vscode.workspace.registerFileSystemProvider(VIRTUAL_SCHEME, this, {
      isReadonly: true,
      isCaseSensitive: true,
    });
  }

  public dispose() {
    // 释放资源
  }

  public readonly onDidChangeFile = this.changeFileEmitter.event;

  public watch() {
    return emptyDisposable;
  }

  public stat(uri: vscode.Uri): vscode.FileStat {
    const { _path } = fromVirtualUri(uri);
    const { size, ctime, mtime } = fs.statSync(_path);
    return { type: vscode.FileType.File, size, ctime: ctime.getTime(), mtime: mtime.getTime() };
  }

  public readDirectory(): [string, vscode.FileType][] {
    throw new Error('不支持readDirectory');
  }

  public createDirectory(): void {
    throw new Error('不支持createDirectory');
  }

  public readFile(): Uint8Array {
    // 无需返回文件内容
    return new Uint8Array();
  }

  public writeFile(): void {
    throw new Error('不支持writeFile');
  }

  public delete(): void {
    throw new Error('不支持delete');
  }

  public rename(): void {
    throw new Error('不支持rename');
  }
}
