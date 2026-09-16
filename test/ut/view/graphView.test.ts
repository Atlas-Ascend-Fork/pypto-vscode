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
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../src/hismarliteEx'), () => ({
  hismartliteEx: { extensionPath: '/ext/pypto-toolkit', webviews: {} },
}));

vi.mock(import('../../../src/theme'), () => ({
  getIDETheme: vi.fn(() => 'dark'),
}));

vi.mock(import('../../../src/lang'), () => ({
  getIDELang: vi.fn(() => 'zh'),
}));

vi.mock(import('../../../src/core/request-server'), () => ({
  useRequestServer: vi.fn(() => ({
    addWebview: vi.fn(),
  })),
}));

vi.mock(import('../../../src/handler/baseGraphMsgHandler'), () => {
  class MockHandler {
    static WHITE_COMMANDS = new Set(['loadMainData', 'getSubgraph']);
    static globalCallInOutTensorMap = new Map();
    static loadMainData = vi.fn();
    static getSubgraph = vi.fn();
  }
  return { BaseGraphMsgHandler: MockHandler };
});

vi.mock(import('../../../src/core/graphData'), () => {
  class MockGraphData {
    fsPath: string;
    constructor(fsPath: string) { this.fsPath = fsPath; }
  }
  return { AbstractGraphData: MockGraphData };
});

import { GraphView } from '../../../src/view/graphView';
import { BaseGraphMsgHandler } from '../../../src/handler/baseGraphMsgHandler';
import { hismartliteEx } from '../../../src/hismarliteEx';
import { window, workspace } from 'vscode';

class TestData {
  fsPath: string;
  constructor(fsPath: string, funcHash?: string, calleeOpMagic?: string, calleeOpSubgraphId?: string) {
    this.fsPath = fsPath;
  }
}

function createMockPanel(overrides?: any) {
  const disposable = { dispose: vi.fn() };
  return {
    viewType: 'testView',
    title: 'Test Panel',
    webview: {
      html: '',
      asWebviewUri: vi.fn((uri: any) => uri),
      onDidReceiveMessage: vi.fn(() => disposable),
      postMessage: vi.fn(),
    },
    onDidDispose: vi.fn(() => disposable),
    onDidChangeViewState: vi.fn(() => disposable),
    dispose: vi.fn(),
    reveal: vi.fn(),
    visible: true,
    ...overrides,
  };
}

describe('GraphView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hismartliteEx as any).webviews = {};
  });

  describe('constructor', () => {
    it('stores options, dataCtor, and handler', () => {
      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      expect(view).toBeDefined();
      expect(view.title).toBeUndefined();
    });
  });

  describe('createPanel', () => {
    it('creates a new panel when no existing panel', async () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>')) as any);

      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      const panel = await view.createPanel('/test/graph.json');

      expect(window.createWebviewPanel).toHaveBeenCalledWith(
        'computeGraph',
        'graph.json',
        expect.anything(),
        expect.objectContaining({ enableScripts: true }),
      );
      expect(panel).toBeDefined();
    });

    it('reuses existing panel when provided', async () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>')) as any);

      const existingPanel = createMockPanel();
      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      const panel = await view.createPanel('/test/graph.json', undefined, undefined, existingPanel as any);

      expect(window.createWebviewPanel).not.toHaveBeenCalled();
      expect(panel).toBe(existingPanel);
      expect(view.title).toBe('Test Panel');
    });

    it('uses magicName as title when provided', async () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>')) as any);

      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      await view.createPanel('/test/graph.json', undefined, undefined, undefined, 'CustomTitle');

      expect(window.createWebviewPanel).toHaveBeenCalledWith(
        'computeGraph',
        'CustomTitle',
        expect.anything(),
        expect.anything(),
      );
    });

    it('attaches graphData and metadata to panel', async () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>')) as any);

      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      const panel = await view.createPanel('/test/graph.json', 'hash123', '/cur', undefined, undefined, 'magic', 'subId', '/output', 'pathName') as any;

      expect(panel.graphData).toBeDefined();
      expect(panel.fsPath).toBe('/test/graph.json');
      expect(panel.funcHash).toBe('hash123');
      expect(panel.calleeOpMagic).toBe('magic');
      expect(panel.calleeOpSubgraphId).toBe('subId');
      expect(panel.outputDirPath).toBe('/output');
      expect(panel.pathName).toBe('pathName');
      expect(panel.curPath).toBe('/cur');
    });
  });

  describe('revive', () => {
    it('creates a GraphView from existing panel', () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html></html>')) as any);

      const panel = createMockPanel();
      const view = GraphView.revive(
        panel as any,
        TestData as any,
        BaseGraphMsgHandler as any,
        '/test/graph.json',
        'hash1',
        'magicName',
        '/cur',
        'opMagic',
        'opSubId',
        '/output',
        'pathName',
      );
      expect(view).toBeInstanceOf(GraphView);
    });
  });

  describe('reviveDiffGraph', () => {
    it('creates a GraphView for diff from existing panel', () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html></html>')) as any);

      const panel = createMockPanel();
      const view = GraphView.reviveDiffGraph(
        panel as any,
        TestData as any,
        BaseGraphMsgHandler as any,
        '/test/graph.json',
        'hash1',
        'diffName',
        '/cur',
      );
      expect(view).toBeInstanceOf(GraphView);
    });
  });

  describe('onMessage', () => {
    it('dispatches white-listed commands to handler', async () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>')) as any);

      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      const panel = await view.createPanel('/test/graph.json') as any;

      const msgHandler = panel.webview.onDidReceiveMessage.mock.calls[0][0];
      msgHandler({ command: 'loadMainData', type: 'test', paramObj: { data: 1 } });
      expect(BaseGraphMsgHandler.loadMainData).toHaveBeenCalledWith(panel, { data: 1 });
    });

    it('ignores non-white-listed commands', async () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>')) as any);

      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      await view.createPanel('/test/graph.json');

      const panel = (window.createWebviewPanel as any).mock.results[0].value;
      const msgHandler = panel.webview.onDidReceiveMessage.mock.calls[0][0];
      msgHandler({ command: 'unknownCommand', type: 'test', paramObj: {} });
    });
  });

  describe('dispose', () => {
    it('cleans up webviews and panel on dispose', async () => {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new Uint8Array(Buffer.from('<html>{{root}}{{staticPath}}{{ascTheme}}{{ascLang}}</html>')) as any);

      const options = { viewType: 'computeGraph', title: 'Compute Graph' };
      (hismartliteEx as any).webviews['Compute Graph'] = {};
      const view = new GraphView(options, TestData as any, BaseGraphMsgHandler as any);
      const panel = await view.createPanel('/test/graph.json') as any;

      const disposeHandler = panel.onDidDispose.mock.calls[0][0];
      disposeHandler();

      expect((hismartliteEx as any).webviews['Compute Graph']).toBeUndefined();
    });
  });
});
