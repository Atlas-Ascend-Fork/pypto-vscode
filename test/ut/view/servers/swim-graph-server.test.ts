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

const { mocks } = vi.hoisted(() => ({
  mocks: {
    viewServer: { viewApi: () => (target: any, key: string) => {}, viewRefs: () => (target: any) => {}, ViewServer: class { _refMap = new Map(); constructor() {} setRef(k: string, v: unknown) { this._refMap.set(k, v); } getRef(k: string) { return this._refMap.get(k); } closeWebview() {} onDisposed() {} created() {} }, Disposable: class { constructor(fn: () => void) { this._dispose = fn; } _dispose: () => void = () => {}; dispose() { this._dispose(); } } },
    viewServerContext: { ViewServerContext: class { viewType = 'swimGraph'; fileUri: any = {}; init = function() {}; setRef = function() {}; closeWebview = function() {}; } },
    swimGraphMsgHandler: {
      getInitialData: vi.fn(), getData: vi.fn(), getSwimData: vi.fn(), getOtherData: vi.fn(),
      getPerformanceInfo: vi.fn(), getCompressedData: vi.fn(), bindComGraphJson: vi.fn(),
      unbindComGraph: vi.fn(), jumpToComGraph: vi.fn(), openBoundComGraph: vi.fn(),
      jumpRawMagic: vi.fn(), showMessage: vi.fn(), saveRendingMode: vi.fn(),
      changeUserCfgConnection: vi.fn(), changeUserCfgPerformance: vi.fn(),
      changeUserCfgIsMixMode: vi.fn(), getShortCutKeyCfg: vi.fn(),
    },
    downloadFileCheck: { setSaveDir: vi.fn(), getCurrentPlatform: vi.fn(), saveFile: vi.fn(), checkFilePath: vi.fn() },
    hismarliteEx: { startTime: 0, transformStartTime: 0 },
    stream: { Readable: { from: vi.fn(), toWeb: vi.fn() } },
    fs: {},
  },
}));

vi.mock('vscode', async () => {
  const mock = await import('./../../mocks/vscode');
  return { ...mock, Disposable: mocks.viewServer.Disposable };
});

vi.mock(import('../../../../src/core/view/view-server'), () => ({
  viewApi: mocks.viewServer.viewApi,
  viewRefs: mocks.viewServer.viewRefs,
  ViewServer: mocks.viewServer.ViewServer,
}));

vi.mock(import('../../../../src/core/view/view-server-context'), () => ({
  ViewServerContext: mocks.viewServerContext.ViewServerContext,
}));

vi.mock(import('../../../../src/handler/swimGraphMsgHandler'), () => ({
  SwimGraphMsgHandler: mocks.swimGraphMsgHandler,
}));

vi.mock('node:fs', () => ({ default: mocks.fs }));

vi.mock('node:stream', () => ({ default: mocks.stream }));

vi.mock(import('../../../../src/common/downloadFileCheck'), () => mocks.downloadFileCheck);

vi.mock(import('../../../../src/hismarliteEx'), () => ({ hismartliteEx: mocks.hismarliteEx }));

import { SwimGraphServer } from '../../../../src/view/servers/swim-graph-server';

function createServer(queryOverride?: any) {
  const ctx = new mocks.viewServerContext.ViewServerContext();
  if (queryOverride === undefined) {
    ctx.fileUri = { query: undefined };
  } else {
    ctx.fileUri = { query: queryOverride ?? { _path: '/test/swim.json' } };
  }
  return new SwimGraphServer(ctx as any);
}

describe('SwimGraphServer constructor', () => {
  it('initializes with object query', () => {
    const server = createServer({ _path: '/test/swim.json', isPerfSwim: true });
    expect(server.title).toBe('Swim Lane Graph');
    expect(server.isReveal).toBe(false);
    expect(server.swimDataPath).toBe('/test/swim.json');
    expect(server.query.isPerfSwim).toBe(true);
    expect(server.handler).toBeDefined();
  });

  it('initializes with string query (JSON)', () => {
    const server = createServer('{"_path":"/test/swim.json"}');
    expect(server.swimDataPath).toBe('/test/swim.json');
  });

  it('initializes with undefined query', () => {
    const server = createServer(undefined);
    expect(server.query).toEqual({});
  });

  it('initializes with null fileUri', () => {
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = undefined;
    const server = new SwimGraphServer(ctx as any);
    expect(server.query).toEqual({});
  });

  it('safeParse returns {} on invalid JSON', () => {
    const server = createServer();
    expect(server.safeParse('invalid')).toEqual({});
  });

  it('safeParse parses valid JSON', () => {
    const server = createServer();
    expect(server.safeParse('{"key":"value"}')).toEqual({ key: 'value' });
  });
});

describe('SwimGraphServer.created', () => {
  it('does nothing (no-op)', () => {
    const server = createServer();
    expect(() => server.created({} as any)).not.toThrow();
  });
});

describe('SwimGraphServer API methods - handler delegation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getInitialData delegates to handler', async () => {
    const server = createServer();
    await server.getInitialData();
    expect(mocks.swimGraphMsgHandler.getInitialData).toHaveBeenCalledWith(server);
  });

  it('getData returns stream when data is array', async () => {
    mocks.swimGraphMsgHandler.getData.mockResolvedValue([{ type: 'first' }]);
    mocks.stream.Readable.from.mockReturnValue({ readable: true });
    mocks.stream.Readable.toWeb.mockReturnValue({ webStream: true });
    const server = createServer();
    const result = await server.getData();
    expect(mocks.stream.Readable.toWeb).toHaveBeenCalled();
    expect(result).toEqual({ webStream: true });
    expect(mocks.hismarliteEx.startTime).toBeGreaterThan(0);
    expect(mocks.hismarliteEx.transformStartTime).toBeGreaterThan(0);
  });

  it('getData returns data directly when not array', async () => {
    mocks.swimGraphMsgHandler.getData.mockResolvedValue({ data: 'non-array' });
    const server = createServer();
    const result = await server.getData();
    expect(result).toEqual({ data: 'non-array' });
  });

  it('getSwimData delegates and returns stream', async () => {
    mocks.swimGraphMsgHandler.getSwimData.mockResolvedValue([{ type: 'events' }]);
    mocks.stream.Readable.from.mockReturnValue({ readable: true });
    mocks.stream.Readable.toWeb.mockReturnValue({ webStream: true });
    const server = createServer();
    const result = await server.getSwimData();
    expect(mocks.stream.Readable.toWeb).toHaveBeenCalled();
    expect(result).toEqual({ webStream: true });
  });

  it('getOtherData delegates to handler', async () => {
    mocks.swimGraphMsgHandler.getOtherData.mockResolvedValue({ config: {} });
    const server = createServer();
    const result = await server.getOtherData();
    expect(result).toEqual({ config: {} });
  });

  it('getPerformanceInfo delegates to handler', async () => {
    mocks.swimGraphMsgHandler.getPerformanceInfo.mockResolvedValue({ startTime: 1 });
    const server = createServer();
    const result = await server.getPerformanceInfo();
    expect(result).toEqual({ startTime: 1 });
  });

  it('getCompressedData delegates to handler', async () => {
    mocks.swimGraphMsgHandler.getCompressedData.mockResolvedValue({ compressed: true });
    const server = createServer();
    const result = await server.getCompressedData();
    expect(result).toEqual({ compressed: true });
  });

  it('bindComGraphJson delegates to handler', async () => {
    const server = createServer();
    await server.bindComGraphJson();
    expect(mocks.swimGraphMsgHandler.bindComGraphJson).toHaveBeenCalledWith(server);
  });

  it('unbindComGraph delegates to handler', async () => {
    const server = createServer();
    await server.unbindComGraph();
    expect(mocks.swimGraphMsgHandler.unbindComGraph).toHaveBeenCalledWith(server);
  });

  it('jumpToComGraph delegates to handler with paramObj', async () => {
    const server = createServer();
    await server.jumpToComGraph({ paramObj: { hash: 'abc' } });
    expect(mocks.swimGraphMsgHandler.jumpToComGraph).toHaveBeenCalledWith(server, { hash: 'abc' });
  });

  it('openBoundComGraph delegates to handler', async () => {
    const server = createServer();
    await server.openBoundComGraph();
    expect(mocks.swimGraphMsgHandler.openBoundComGraph).toHaveBeenCalledWith(server);
  });

  it('jumpRawMagic delegates to handler with paramObj', async () => {
    const server = createServer();
    await server.jumpRawMagic({ paramObj: { rawmagic: 1 } });
    expect(mocks.swimGraphMsgHandler.jumpRawMagic).toHaveBeenCalledWith(server, { rawmagic: 1 });
  });

  it('showMessage delegates to handler with paramObj', async () => {
    const server = createServer();
    await server.showMessage({ paramObj: { text: 'hello' } });
    expect(mocks.swimGraphMsgHandler.showMessage).toHaveBeenCalledWith(server, { text: 'hello' });
  });

  it('saveRendingMode delegates to handler with paramObj', async () => {
    const server = createServer();
    await server.saveRendingMode({ paramObj: '{"color":"red"}' });
    expect(mocks.swimGraphMsgHandler.saveRendingMode).toHaveBeenCalledWith(server, '{"color":"red"}');
  });

  it('changeUserCfgConnection delegates to handler with paramObj', async () => {
    const server = createServer();
    await server.changeUserCfgConnection({ paramObj: { level: 5 } });
    expect(mocks.swimGraphMsgHandler.changeUserCfgConnection).toHaveBeenCalledWith(server, { level: 5 });
  });

  it('changeUserCfgPerformance delegates to handler with paramObj', async () => {
    const server = createServer();
    await server.changeUserCfgPerformance({ paramObj: { show: true } });
    expect(mocks.swimGraphMsgHandler.changeUserCfgPerformance).toHaveBeenCalledWith(server, { show: true });
  });

  it('changeUserCfgIsMixMode delegates to handler with paramObj', async () => {
    const server = createServer();
    await server.changeUserCfgIsMixMode({ paramObj: { show: false } });
    expect(mocks.swimGraphMsgHandler.changeUserCfgIsMixMode).toHaveBeenCalledWith(server, { show: false });
  });

  it('getShortCutKeyCfg delegates to handler', async () => {
    mocks.swimGraphMsgHandler.getShortCutKeyCfg.mockResolvedValue({ configration: {} });
    const server = createServer();
    const result = await server.getShortCutKeyCfg();
    expect(result).toEqual({ configration: {} });
  });
});

describe('SwimGraphServer file/system methods', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('setSaveDir sets SaveDirPath ref', async () => {
    mocks.downloadFileCheck.setSaveDir.mockResolvedValue('/selected/dir');
    const server = createServer();
    await server.setSaveDir();
    expect(server.getRef('SaveDirPath')).toEqual({ dir: '/selected/dir' });
  });

  it('checkSys sets CheckSysResult ref', async () => {
    mocks.downloadFileCheck.getCurrentPlatform.mockReturnValue('linux');
    const server = createServer();
    await server.checkSys();
    expect(server.getRef('CheckSysResult')).toEqual({ sustem: 'linux' });
  });

  it('saveFile sets SaveFileResult ref when result is truthy', async () => {
    mocks.downloadFileCheck.saveFile.mockResolvedValue({ success: true });
    const server = createServer();
    await server.saveFile({ data: 'test' });
    expect(server.getRef('SaveFileResult')).toEqual({ success: true });
  });

  it('saveFile does nothing when result is falsy', async () => {
    mocks.downloadFileCheck.saveFile.mockResolvedValue(null);
    const server = createServer();
    await server.saveFile({ data: 'test' });
    expect(server.getRef('SaveFileResult')).toBeUndefined();
  });

  it('checkFilePath sets CheckFilePathResult ref', async () => {
    mocks.downloadFileCheck.checkFilePath.mockResolvedValue({ valid: true });
    const server = createServer();
    await server.checkFilePath({ path: '/test' });
    expect(server.getRef('CheckFilePathResult')).toEqual({ valid: true });
  });
});

describe('SwimGraphServer.locateNode', () => {
  it('sets locateNodeResult ref with seqNo, taskId, and timestamp', () => {
    const server = createServer();
    server.locateNode(5, 10);
    const result = server.getRef('locateNodeResult');
    expect(result.seqNo).toBe(5);
    expect(result.taskId).toBe(10);
    expect(result.timestamp).toBeGreaterThan(0);
  });
});
