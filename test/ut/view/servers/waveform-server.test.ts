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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../../src/core/view/view-server'), () => {
  class MockViewServer {
    static _viewConfig: any = { apis: ['closeWebview'], refs: [] };
    _refMap = new Map<string, unknown>();
    constructor(ctx: any) {
      ctx.init.call(this);
    }
    created(_ctx: any) {}
    setRef(key: string, value: unknown) { this._refMap.set(key, value); }
    getRef(key: string) { return this._refMap.get(key); }
    closeWebview() {}
    dispose() {}
  }
  return { ViewServer: MockViewServer, viewApi: () => () => {}, viewRefs: () => () => {} };
});

vi.mock(import('../../../../src/converter/vcdConverter'), () => ({
  parseVcdStream: vi.fn(),
}));

import { WaveformServer } from '../../../../src/view/servers/waveform-server';
import { parseVcdStream } from '../../../../src/converter/vcdConverter';

function createServer(query: unknown = { _path: '/test/trace.vcd' }) {
  const ctx = {
    viewType: 'waveform',
    fileUri: { query },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
  return new WaveformServer(ctx as any);
}

function buildParsedData() {
  return {
    timescale: '1 ns',
    date: '2026-01-01',
    version: 'VCD writer',
    signals: [{ id: '!', name: 'clk', width: 1, type: 'wire', scope: 'top' }],
    signalTree: [{ name: 'top', type: 'module', children: [], signals: ['!'] }],
    timeRange: { start: 0, end: 100 },
    signalCount: 1,
    changeCount: 2,
    changes: new Map<string, [number, string][]>([['!', [[0, '0'], [10, '1']]]]),
  };
}

describe('WaveformServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('safeParse returns parsed object for valid JSON', () => {
    const server = createServer('{}');
    expect(server.safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('safeParse returns empty object for invalid JSON', () => {
    const server = createServer('{}');
    expect(server.safeParse('bad')).toEqual({});
  });

  it('parses string query in constructor', () => {
    const server = createServer(JSON.stringify({ _path: '/test/from-string.vcd' }));
    expect(server.query).toEqual({ _path: '/test/from-string.vcd' });
  });

  it('keeps object query as-is in constructor', () => {
    const query = { _path: '/test/object.vcd' };
    const server = createServer(query);
    expect(server.query).toBe(query);
  });

  it('defaults query to empty object when fileUri is missing', () => {
    const ctx = { viewType: 'waveform', init: vi.fn(), setRef: vi.fn(), closeWebview: vi.fn() };
    const server = new WaveformServer(ctx as any);
    expect(server.query).toEqual({});
  });

  it('created triggers loadWaveformData and publishes WaveformData', async () => {
    vi.mocked(parseVcdStream).mockResolvedValue(buildParsedData() as any);
    const server = createServer();

    server.created({} as any);

    await vi.waitFor(() => expect(server.getRef('WaveformData')).toBeDefined());
    expect(parseVcdStream).toHaveBeenCalledWith('/test/trace.vcd');
  });

  it('loadWaveformData sets ErrorMessage when path is empty', async () => {
    const server = createServer({});
    await server.loadWaveformData();
    expect(server.getRef('ErrorMessage')).toEqual({ data: '文件路径为空' });
    expect(parseVcdStream).not.toHaveBeenCalled();
  });

  it('loadWaveformData publishes parsed data with changes converted to object', async () => {
    vi.mocked(parseVcdStream).mockResolvedValue(buildParsedData() as any);
    const server = createServer();

    await server.loadWaveformData();

    expect(server.getRef('WaveformData')).toEqual({
      timescale: '1 ns',
      date: '2026-01-01',
      version: 'VCD writer',
      signals: [{ id: '!', name: 'clk', width: 1, type: 'wire', scope: 'top' }],
      signalTree: [{ name: 'top', type: 'module', children: [], signals: ['!'] }],
      timeRange: { start: 0, end: 100 },
      signalCount: 1,
      changeCount: 2,
      changes: { '!': [[0, '0'], [10, '1']] },
    });
  });

  it('loadWaveformData sets ErrorMessage when parsing fails', async () => {
    vi.mocked(parseVcdStream).mockRejectedValue(new Error('boom'));
    const server = createServer();

    await server.loadWaveformData();

    expect(server.getRef('ErrorMessage')).toEqual({ data: '解析 VCD 文件失败: boom' });
    expect(server.getRef('WaveformData')).toBeUndefined();
  });

  it('getSignalChanges returns empty object when no cached data', async () => {
    const server = createServer();
    const result = await server.getSignalChanges({ signalIds: ['!'], startTime: 0, endTime: 100 });
    expect(result).toEqual({});
  });

  it('getSignalChanges returns changes only for existing signal ids', async () => {
    vi.mocked(parseVcdStream).mockResolvedValue(buildParsedData() as any);
    const server = createServer();
    await server.loadWaveformData();

    const result = await server.getSignalChanges({ signalIds: ['!', 'missing'], startTime: 0, endTime: 100 });

    expect(result).toEqual({ '!': [[0, '0'], [10, '1']] });
  });

  it('onDisposed clears cached data', async () => {
    vi.mocked(parseVcdStream).mockResolvedValue(buildParsedData() as any);
    const server = createServer();
    await server.loadWaveformData();

    (server as any).onDisposed();

    const result = await server.getSignalChanges({ signalIds: ['!'], startTime: 0, endTime: 100 });
    expect(result).toEqual({});
  });
});
