/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock(import('../../../src/hismarliteEx'), () => ({
  hismartliteEx: { extensionPath: '/ext/pypto-toolkit', context: { subscriptions: [] } },
}));

vi.mock(import('../../../src/util'), () => {
  class MockUtil {
    replaceHtmlFromData(params: any[], html: string) { return html; }
  }
  return { Util: MockUtil };
});

vi.mock(import('../../../src/theme'), () => ({
  getIDETheme: vi.fn(() => 'dark'),
}));

vi.mock(import('../../../src/lang'), () => ({
  getIDELang: vi.fn(() => 'zh-cn'),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: { ...actual, readFileSync: vi.fn(() => '<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>') },
    readFileSync: vi.fn(() => '<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>'),
  };
});

import { Uri } from 'vscode';
import { SwimData, SwimGraphView } from '../../../src/view/swimGraphView';

describe('SwimData', () => {
  it('stores uri and fsPath', () => {
    const uri = Uri.file('/test/swim.json');
    const data = new SwimData(uri as any, '/test/swim.json');
    expect(data.uri).toEqual(uri);
    expect(data.fsPath).toBe('/test/swim.json');
  });
});

describe('SwimGraphView', () => {
  it('initializes webview HTML', () => {
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: vi.fn((uri) => uri),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
      swimData: null as any,
    };
    const uri = Uri.file('/test/swim.json');
    new SwimGraphView(mockPanel as any, uri as any);
    expect(mockPanel.webview.html).toBeDefined();
    expect(mockPanel.swimData).toBeDefined();
    expect(mockPanel.swimData.fsPath).toBe('/test/swim.json');
  });

  it('sets title and initial state', () => {
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: vi.fn((uri) => uri),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
      swimData: null as any,
    };
    const uri = Uri.file('/test/swim.json');
    const view = new SwimGraphView(mockPanel as any, uri as any);
    expect(view.title).toBe('Swim Lane Graph');
    expect(view.isReveal).toBe(false);
    expect(view._disposables).toEqual([]);
  });

  it('registers onDidDispose handler', () => {
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: vi.fn((uri) => uri),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
      swimData: null as any,
    };
    const uri = Uri.file('/test/swim.json');
    new SwimGraphView(mockPanel as any, uri as any);
    expect(mockPanel.onDidDispose).toHaveBeenCalled();
  });

  it('registers onDidReceiveMessage handler', () => {
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: vi.fn((uri) => uri),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
      swimData: null as any,
    };
    const uri = Uri.file('/test/swim.json');
    new SwimGraphView(mockPanel as any, uri as any);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
  });

  it('revive creates a new SwimGraphView', () => {
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: vi.fn((uri) => uri),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
      swimData: null as any,
    };
    const uri = Uri.file('/test/swim.json');
    SwimGraphView.revive(mockPanel as any, uri as any);
    expect(mockPanel.webview.html).toBeDefined();
  });

  it('onDidDispose sets panel to null', () => {
    const mockPanel = {
      webview: {
        html: '',
        asWebviewUri: vi.fn((uri) => uri),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
      swimData: null as any,
    };
    const uri = Uri.file('/test/swim.json');
    const view = new SwimGraphView(mockPanel as any, uri as any);
    const disposeHandler = mockPanel.onDidDispose.mock.calls[0][0];
    disposeHandler();
    expect(view.panel).toBeNull();
  });

  it('onDidReceiveMessage dispatches to msgHandler', () => {
    const mockPanel: any = {
      webview: {
        html: '',
        asWebviewUri: vi.fn((uri) => uri),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
      swimData: null as any,
      msgHandler: {
        testCommand: vi.fn(),
      },
    };
    const uri = Uri.file('/test/swim.json');
    new SwimGraphView(mockPanel as any, uri as any);
    const msgHandler = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
    msgHandler({ command: 'testCommand', paramObj: { data: 1 } });
    expect(mockPanel.msgHandler.testCommand).toHaveBeenCalledWith(mockPanel, { data: 1 });
  });
});
