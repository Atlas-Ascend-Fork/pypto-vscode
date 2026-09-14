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

vi.mock(import('../../../src/core/view/view-server'), () => {
  const { Disposable } = require('vscode');
  class MockViewServer extends Disposable {
    static _viewConfig: any = { apis: ['closeWebview'], refs: [] };
    _refMap = new Map<string, unknown>();
    constructor(ctx: any) {
      super(() => {});
      ctx.init.call(this);
    }
    created(_ctx: any) {}
    setRef(key: string, value: unknown) { this._refMap.set(key, value); }
    getRef(key: string) { return this._refMap.get(key); }
    closeWebview() {}
  }
  return { ViewServer: MockViewServer, viewApi: () => () => {}, viewRefs: () => () => {} };
});

import { workspace, window } from 'vscode';
import { GmMemoryVisualServer, readJsonText, onDidGmMemoryVisualReady } from '../../../../src/view/servers/gm-memory-visual-server';

describe('readJsonText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads file and returns UTF-8 string', async () => {
    const content = '{"data": "test"}';
    vi.mocked(workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode(content));
    const timings = { decode: 0, fileRead: 0 };
    const result = await readJsonText('/test/data.json', timings);
    expect(result).toBe(content);
    expect(timings.fileRead).toBeGreaterThanOrEqual(0);
    expect(timings.decode).toBeGreaterThanOrEqual(0);
  });

  it('returns undefined for empty path', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await readJsonText('');
    expect(result).toBeUndefined();
    spy.mockRestore();
  });

  it('shows error message when file read fails', async () => {
    vi.mocked(workspace.fs.readFile).mockRejectedValue(new Error('file not found'));
    const result = await readJsonText('/missing.json');
    expect(result).toBeUndefined();
    expect(window.showErrorMessage).toHaveBeenCalled();
  });
});

describe('GmMemoryVisualServer', () => {
  function createServer(query: unknown = { _path: '/test/data.json' }) {
    const ctx = {
      viewType: 'gmMemoryVisual',
      fileUri: { query },
      init: vi.fn(),
      setRef: vi.fn(),
      closeWebview: vi.fn(),
    };
    return new GmMemoryVisualServer(ctx as any);
  }

  it('safeParse returns parsed object for valid JSON', () => {
    const ctx = { viewType: 'gmMemoryVisual', fileUri: { query: '{}' }, init: vi.fn(), setRef: vi.fn(), closeWebview: vi.fn() };
    const server = new GmMemoryVisualServer(ctx as any);
    expect(server.safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('safeParse returns empty object for invalid JSON', () => {
    const ctx = { viewType: 'gmMemoryVisual', fileUri: { query: '{}' }, init: vi.fn(), setRef: vi.fn(), closeWebview: vi.fn() };
    const server = new GmMemoryVisualServer(ctx as any);
    expect(server.safeParse('bad')).toEqual({});
  });

  it('parses string query in constructor', () => {
    const server = createServer(JSON.stringify({ _path: '/test/from-string.json' }));
    expect(server.query).toEqual({ _path: '/test/from-string.json' });
  });

  it('created triggers data load and publishes data then null', async () => {
    vi.clearAllMocks();
    vi.mocked(workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{"tensors":[]}'));
    const server = createServer();

    server.created({} as any);
    await vi.waitFor(() => expect(server.getRef('GmMemoryVisualData')).toBeNull());
  });

  it('getGmMemoryVisualData sets raw data when benchmark env is absent', async () => {
    vi.clearAllMocks();
    vi.mocked(workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{"tensors":[]}'));

    const server = createServer();
    await server.getGmMemoryVisualData();

    expect(server.getRef('GmMemoryVisualData')).toBeNull();
  });

  it('getGmMemoryVisualData wraps data with performance flag when benchmark env is set', async () => {
    vi.clearAllMocks();
    vi.stubEnv('GM_MEMORY_BENCHMARK_PATH', '1');
    try {
      vi.mocked(workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{"tensors":[]}'));

      const server = createServer();
      const setRefSpy = vi.fn();
      (server as any).setRef = setRefSpy;

      await server.getGmMemoryVisualData();

      expect(setRefSpy).toHaveBeenNthCalledWith(1, 'GmMemoryVisualData', { data: '{"tensors":[]}', performance: true });
      expect(setRefSpy).toHaveBeenNthCalledWith(2, 'GmMemoryVisualData', null);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('reportGmMemoryVisualReady fires event with timings and payload', async () => {
    vi.clearAllMocks();
    vi.mocked(workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{}'));

    const readyListener = vi.fn();
    const disposable = onDidGmMemoryVisualReady(readyListener);
    try {
      const server = createServer();
      await server.getGmMemoryVisualData();

      await server.reportGmMemoryVisualReady({
        tensorCount: 5,
        regionCount: 3,
        hasChart: true,
        performance: { fingerprint: {}, marks: {}, stages: {} },
      });

      expect(readyListener).toHaveBeenCalledTimes(1);
      const event = readyListener.mock.calls[0][0];
      expect(event).toMatchObject({
        fsPath: '/test/data.json',
        tensorCount: 5,
        regionCount: 3,
        hasChart: true,
      });
      expect(event.timings).toMatchObject({ decode: expect.any(Number), fileRead: expect.any(Number), publicationToReady: expect.any(Number), total: expect.any(Number) });
      expect(event.webviewPerformance).toEqual({ fingerprint: {}, marks: {}, stages: {} });
    } finally {
      disposable.dispose();
    }
  });
});
