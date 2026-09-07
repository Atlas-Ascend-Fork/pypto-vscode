/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { vi } from 'vitest';

const disposable = { dispose: vi.fn() };

export const commands = {
  registerCommand: vi.fn(() => disposable),
  executeCommand: vi.fn(),
};

export const extensions = {
  getExtension: vi.fn(),
};

export const window = {
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  createWebviewPanel: vi.fn(() => ({
    webview: { html: '', options: {}, asWebviewUri: vi.fn((uri) => uri), onDidReceiveMessage: vi.fn(() => disposable), postMessage: vi.fn() },
    dispose: vi.fn(),
    onDidDispose: vi.fn(() => disposable),
    onDidChangeViewState: vi.fn(() => disposable),
    reveal: vi.fn(),
    visible: true,
  })),
  registerWebviewPanelSerializer: vi.fn(),
  registerWebviewViewProvider: vi.fn(() => disposable),
  onDidChangeActiveColorTheme: vi.fn(() => disposable),
  activeTextEditor: undefined as { document: { uri: { fsPath: string } } } | undefined,
  showTextDocument: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  withProgress: vi.fn((_options: any, task: any) => task({ report: vi.fn() })),
};

export const Uri = {
  file: (fsPath: string) => {
    const uri = { 
      fsPath, 
      scheme: 'file', 
      path: fsPath, 
      query: '',
      toString: () => `file://${fsPath}`,
      with: vi.fn((change: any) => {
        return {
          ...uri,
          ...change,
        };
      }),
    };
    return uri;
  },
  parse: (str: string) => {
    const uri = { 
      fsPath: str, 
      scheme: 'file', 
      path: str, 
      query: '',
      toString: () => str,
      with: vi.fn((change: any) => {
        return {
          ...uri,
          ...change,
        };
      }),
    };
    return uri;
  },
  joinPath: (base: { fsPath: string }, ...segments: string[]) => {
    const baseStr = String(base.fsPath ?? '');
    const allSegments = [
      ...baseStr.split(/[\\/]/),
      ...segments.flatMap((s) => String(s).split(/[\\/]/)),
    ];
    const parts: string[] = [];
    for (const seg of allSegments) {
      if (seg === '' || seg === '.') {
        continue;
      }
      if (seg === '..') {
        parts.pop();
        continue;
      }
      parts.push(seg);
    }
    const joined = parts.join('/');
    const isDrivePath = /^[A-Za-z]:/.test(joined);
    const finalPath = isDrivePath || joined.startsWith('/') ? joined : `/${joined}`;
    return {
      fsPath: finalPath,
      path: finalPath,
      toString: () => `file://${finalPath}`,
    };
  },
};

export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
    update: vi.fn(),
  })),
  fs: {
    stat: vi.fn(),
    delete: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    createDirectory: vi.fn(),
    readDirectory: vi.fn(),
    copy: vi.fn(),
  },
  createFileSystemWatcher: vi.fn(() => ({
    onDidCreate: vi.fn(() => disposable),
    onDidChange: vi.fn(() => disposable),
    onDidDelete: vi.fn(() => disposable),
    dispose: vi.fn(),
  })),
  workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
  openTextDocument: vi.fn(),
  applyEdit: vi.fn(),
  onDidChangeWorkspaceFolders: vi.fn(() => disposable),
  onDidChangeConfiguration: vi.fn(() => disposable),
  onDidCreateFiles: vi.fn(() => disposable),
  onDidDeleteFiles: vi.fn(() => disposable),
  onDidRenameFiles: vi.fn(() => disposable),
};

export class RelativePattern {
  constructor(public base: string, public pattern: string) {}
}

export class ExtensionContext {
  subscriptions: any[] = [];
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Range {
  constructor(public start: Position, public end: Position) {}
  static from(startLine: number, startChar: number, endLine: number, endChar: number) {
    return new Range(new Position(startLine, startChar), new Position(endLine, endChar));
  }
}

export class CodeLens {
  constructor(public range: any, public command?: any) {}
}

export const Selection = vi.fn();
export const ViewColumn = { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 };
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
export const FileType = { Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 };
export const ProgressLocation = { SourceControl: 1, Window: 10, Notification: 15 };
export const env = { language: 'en' };
export const languages = {
  registerCodeLensProvider: vi.fn(() => disposable),
};
export const WebviewPanel = vi.fn();
export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3 };
export const EndOfLine = { LF: 1, CRLF: 2 };
export const TextEditorRevealType = { Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 };
export class Disposable {
  constructor(private callOnDispose?: () => void) {}
  dispose() { this.callOnDispose?.(); }
}

export class EventEmitter {
  private listeners: ((e: any) => void)[] = [];
  event = (listener: (e: any) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== listener); } };
  };
  fire(data: any) { this.listeners.forEach((l) => l(data)); }
  dispose() { this.listeners = []; }
}

export class WorkspaceEdit {
  private edits: Array<{ uri: any; range: any; newText: string }> = [];
  
  replace(uri: any, range: any, newText: string) {
    this.edits.push({ uri, range, newText });
  }
  
  insert(uri: any, position: any, newText: string) {
    this.edits.push({ uri, range: new Range(position, position), newText });
  }
  
  delete(uri: any, range: any) {
    this.edits.push({ uri, range, newText: '' });
  }
  
  get size() {
    return this.edits.length;
  }
}

export class TextEdit {
  constructor(public range: any, public newText: string) {}
  
  static replace(range: any, newText: string) {
    return new TextEdit(range, newText);
  }
  
  static insert(position: any, newText: string) {
    return new TextEdit(new Range(position, position), newText);
  }
  
  static delete(range: any) {
    return new TextEdit(range, '');
  }
}

// sql.js Database mock
export class MockDatabase {
  private tables: Map<string, any[]> = new Map();
  
  run(sql: string, params?: any[]) {
    // Mock implementation - records SQL execution
    return this;
  }
  
  exec(sql: string) {
    // Mock implementation - returns empty result
    return [];
  }
  
  prepare(sql: string) {
    return {
      bind: vi.fn(),
      step: vi.fn().mockReturnValue(false),
      getAsObject: vi.fn().mockReturnValue({}),
      free: vi.fn(),
    };
  }
  
  export() {
    return new Uint8Array();
  }
  
  close() {
    // Mock implementation
  }
}

// Webview mock
export class MockWebview {
  html = '';
  options: any = {};
  postMessage = vi.fn();
  onDidReceiveMessage = vi.fn(() => disposable);
  asWebviewUri = vi.fn((uri: any) => uri);
}

// ReadableStream mock for stream-json
export class MockReadableStream {
  private data: any[] = [];
  private index = 0;
  
  constructor(data: any[] = []) {
    this.data = data;
  }
  
  getReader() {
    return {
      read: vi.fn().mockImplementation(() => {
        if (this.index < this.data.length) {
          return Promise.resolve({ value: this.data[this.index++], done: false });
        }
        return Promise.resolve({ value: undefined, done: true });
      }),
      releaseLock: vi.fn(),
    };
  }
}

export default {
  commands,
  extensions,
  window,
  Uri,
  workspace,
  RelativePattern,
  ExtensionContext,
  languages,
  Position,
  Range,
  CodeLens,
  Selection,
  ViewColumn,
  WebviewPanel,
  ConfigurationTarget,
  FileType,
  ProgressLocation,
  env,
  ColorThemeKind,
  EndOfLine,
  TextEditorRevealType,
  Disposable,
  EventEmitter,
  WorkspaceEdit,
  TextEdit,
  MockDatabase,
  MockWebview,
  MockReadableStream,
};
