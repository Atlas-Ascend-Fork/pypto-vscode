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
};

export const window = {
  showOpenDialog: vi.fn(),
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  activeTextEditor: undefined as { document: { uri: { fsPath: string } } } | undefined,
};

export const Uri = {
  file: (fsPath: string) => ({ fsPath }),
};

export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
    update: vi.fn(),
  })),
};

export class ExtensionContext {
  subscriptions: any[] = [];
}

export const Position = vi.fn();
export const Selection = vi.fn();
export const ViewColumn = { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 };
export const Range = vi.fn();
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
export const WebviewPanel = vi.fn();
export const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3 };
export class Disposable {
  private _dispose: () => void;
  constructor(fn: () => void) { this._dispose = fn; }
  dispose() { this._dispose(); }
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

export default {
  commands,
  window,
  Uri,
  workspace,
  ExtensionContext,
  Position,
  Selection,
  ViewColumn,
  Range,
  ConfigurationTarget,
  WebviewPanel,
  ColorThemeKind,
  Disposable,
  EventEmitter,
};
