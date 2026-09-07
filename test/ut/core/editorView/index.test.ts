/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { window, Uri, ViewColumn } from 'vscode';

vi.mock(import('../../../../src/core/view/view-server'), () => {
  class MockViewServer {
    static _viewConfig = { apis: ['closeWebview'], refs: [] };
    createdCount = 0;
    disposed = false;
    created(_ctx: unknown) {
      this.createdCount++;
    }
    dispose() {
      this.disposed = true;
    }
  }
  return {
    ViewServer: MockViewServer,
    makeViewServerConfig: vi.fn(() => ({ apis: ['closeWebview'], refs: [] })),
    viewApi: () => () => {},
    viewRefs: () => () => {},
  };
});

vi.mock(import('../../../../src/core/view/view-server-context'), () => ({
  makeViewServerContext: vi.fn((panel: any, viewType: string) => ({
    viewType,
    fileUri: undefined,
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(() => panel.dispose()),
  })),
}));

vi.mock(import('../../../../src/lang'), () => ({
  getIDELang: vi.fn(() => 'zh'),
}));

vi.mock(import('../../../../src/theme'), () => ({
  getIDETheme: vi.fn(() => 'dark'),
}));

vi.mock(import('../../../../src/hismarliteEx'), () => ({
  hismartliteEx: { extensionPath: '/ext', webviews: {} },
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() =>
      '<html root="{{root}}" static="{{staticPath}}" theme="{{ascTheme}}" lang="{{ascLang}}" query=\'{{query}}\'></html>',
    ),
  },
  readFileSync: vi.fn(() =>
    '<html root="{{root}}" static="{{staticPath}}" theme="{{ascTheme}}" lang="{{ascLang}}" query=\'{{query}}\'></html>',
  ),
}));

import { EditorView, getWebviewEntryCode } from '../../../../src/core/editorView/index';
import { ViewServer } from '../../../../src/core/view/view-server';

function makeVirtualUri(fsPath: string, viewType: string, query: Record<string, unknown> = {}) {
  const base = Uri.file(fsPath);
  return base.with({ query: JSON.stringify({ ...query, _path: fsPath, _viewType: viewType }) }) as any;
}

function makePanel() {
  return {
    webview: {
      html: '',
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      asWebviewUri: vi.fn((uri: any) => uri),
    },
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
    reveal: vi.fn(),
    dispose: vi.fn(),
  };
}

function lastPanel() {
  const panel = vi.mocked(window.createWebviewPanel).mock.results.at(-1)!.value as any;
  return panel;
}

function firePanelDispose(panel: any) {
  panel.onDidDispose.mock.calls.forEach(([cb]: [() => void]) => cb());
}

function fireInitHook(panel: any) {
  const messageCallbacks = panel.webview.onDidReceiveMessage.mock.calls.map(([cb]: [any]) => cb);
  messageCallbacks.forEach((cb) => cb({ channel: '__connector__', data: 'editorView' }));
  messageCallbacks.forEach((cb) => cb({ channel: 'editorView', data: null }));
}

describe('EditorView', () => {
  let editorView: EditorView;
  let activated: any[];
  let disposed: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    activated = [];
    disposed = [];
    editorView = new EditorView(
      (panel) => activated.push(panel),
      (viewType, uri) => disposed.push({ viewType, uri }),
    );
    editorView.registerViews([
      {
        viewType: 'computeGraph',
        title: 'Compute Graph',
        viewServer: ViewServer as any,
        iconPath: () => Uri.file('/ext/icon.png'),
      },
      { viewType: 'plain', title: (uri: any) => `T:${uri.fsPath}` },
    ] as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the serializer on construction', () => {
    expect(window.registerWebviewPanelSerializer).toHaveBeenCalledWith('PyPTO.open.editorView', expect.any(Object));
  });

  it('throws when opening an unregistered view type', () => {
    expect(() => editorView.open('missing', Uri.file('/test.json'))).toThrow('Webview - missing 不存在');
  });

  it('opens a webview panel with html injected and activates hooks', () => {
    editorView.open('computeGraph', Uri.file('/test.json'));

    const panel = lastPanel();
    expect(window.createWebviewPanel).toHaveBeenCalledWith(
      'PyPTO.open.editorView',
      'Compute Graph',
      { viewColumn: ViewColumn.Active },
      { retainContextWhenHidden: true, enableScripts: true },
    );
    expect(panel.iconPath).toBeDefined();
    expect(panel.webview.html).toContain('theme="dark"');
    expect(panel.webview.html).toContain('lang="zh"');
    expect(panel.webview.html).toContain('_path');
    expect(activated).toHaveLength(1);

    fireInitHook(panel);
    expect(editorView.openServer.size).toBe(1);
    expect([...editorView.openServer.values()][0].createdCount).toBe(1);
  });

  it('supports function titles and custom title override', () => {
    editorView.open('plain', Uri.file('/a.json'));
    expect(vi.mocked(window.createWebviewPanel).mock.calls[0][1]).toBe('T:/a.json');

    editorView.open('plain', Uri.file('/b.json'), { title: 'Custom' });
    expect(vi.mocked(window.createWebviewPanel).mock.calls[1][1]).toBe('Custom');
  });

  it('reveals an existing panel instead of opening a duplicate', () => {
    editorView.open('computeGraph', Uri.file('/test.json'));
    const firstPanel = lastPanel();

    editorView.open('computeGraph', Uri.file('/test.json'), { viewColumn: ViewColumn.Two });

    expect(window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(firstPanel.reveal).toHaveBeenCalledWith(ViewColumn.Two);
  });

  it('cleans up on panel dispose', () => {
    editorView.open('computeGraph', Uri.file('/test.json'));
    const panel = lastPanel();
    fireInitHook(panel);

    firePanelDispose(panel);

    expect(disposed).toHaveLength(1);
    expect(disposed[0].viewType).toBe('computeGraph');
    expect(editorView.openServer.size).toBe(0);
    expect([...editorView.openServer.values()]).toHaveLength(0);
  });

  it('posts theme updates when the color theme changes', () => {
    editorView.open('computeGraph', Uri.file('/test.json'));
    const panel = lastPanel();

    const themeCallback = vi.mocked(window.onDidChangeActiveColorTheme).mock.calls.at(-1)![0];
    themeCallback();

    expect(panel.webview.postMessage).toHaveBeenCalledWith({ command: 'returnTheme', data: 'dark' });
  });

  it('closeAll disposes every opened panel', () => {
    editorView.open('computeGraph', Uri.file('/a.json'));
    editorView.open('plain', Uri.file('/b.json'));
    const panels = vi.mocked(window.createWebviewPanel).mock.results.map((r: any) => r.value);

    editorView.closeAll();

    expect(panels[0].dispose).toHaveBeenCalled();
    expect(panels[1].dispose).toHaveBeenCalled();
  });

  describe('serializer', () => {
    function getSerializer() {
      return vi.mocked(window.registerWebviewPanelSerializer).mock.calls.at(-1)![1] as any;
    }

    it('re-activates the panel for a fresh view', async () => {
      const serializer = getSerializer();
      const panel = makePanel();
      const virtualUri = makeVirtualUri('/test.json', 'computeGraph');

      await serializer.deserializeWebviewPanel(panel, { _viewType: 'computeGraph', _uri: virtualUri });

      expect(panel.webview.html).toContain('theme="dark"');
      expect(activated).toHaveLength(1);
    });

    it('reveals the existing panel and disposes the duplicate with delays', async () => {
      vi.useFakeTimers();
      editorView.open('computeGraph', Uri.file('/test.json'));
      const originalPanel = lastPanel();
      const duplicatePanel = {
        webview: { html: '', postMessage: vi.fn(), onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })) },
        onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
        reveal: vi.fn(),
        dispose: vi.fn(),
      };

      const serializer = getSerializer();
      await serializer.deserializeWebviewPanel(duplicatePanel, {
        _viewType: 'computeGraph',
        _uri: makeVirtualUri('/test.json', 'computeGraph'),
      });

      await vi.advanceTimersByTimeAsync(800);
      expect(originalPanel.reveal).toHaveBeenCalled();
      expect(duplicatePanel.dispose).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200);
      expect(duplicatePanel.dispose).toHaveBeenCalled();
    });
  });
});

describe('getWebviewEntryCode', () => {
  it('replaces all placeholders in the html template', () => {
    const webview = {
      asWebviewUri: vi.fn((uri: any) => uri),
    } as any;

    const html = getWebviewEntryCode(webview, { _path: '/test.json' } as any);

    expect(webview.asWebviewUri).toHaveBeenCalled();
    expect(html).toContain('root="file:///ext"');
    expect(html).toContain('static="file:///ext/webview-dist"');
    expect(html).toContain('theme="dark"');
    expect(html).toContain('lang="zh"');
    expect(html).toContain('query={"_path":"/test.json"}');
  });
});
