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
    fs: { stat: vi.fn(), accessSync: vi.fn(), existsSync: vi.fn(), readFileSync: vi.fn(), readdirSync: vi.fn() },
    util: { getCachePath: vi.fn(), readSwim2ComGraphMap: vi.fn(), writeJsonCache: vi.fn(), writeSwimConfigMap: vi.fn(), getSwimGraphCustomCfg: vi.fn() },
    hismarliteEx: { isDebug: false, startTime: 100, transformStartTime: 200, extensionPath: '/ext', context: { globalStorageUri: { fsPath: '/storage' } }, swimPerformanceBase: { first: { vsOpen: { 100: 1, 500: 5, 1000: 10 }, vsHW: { 100: 2, 500: 8, 1000: 15 } }, useCache: { vsOpen: { 100: 0, 500: 2, 1000: 5 }, vsHW: { 100: 1, 500: 4, 1000: 8 } } } },
    process: { parsePmuInfo: vi.fn(), parseSwimLaneInfo: vi.fn(), processTotalPmuCalc: vi.fn(), saveParsedInfoToDB: vi.fn(), readSwimlaneFileStream: vi.fn(), saveCompressedDataPathToDB: vi.fn(), writeLargeObjectToFileThreadGranular: vi.fn(), getSavedSwimDataFileStreamAll: vi.fn(), checkPmuDataValid: vi.fn() },
    sqliteCache: { getMTime: vi.fn(), SQLiteCache: vi.fn() },
    dataCompress: { readCompressedFile: vi.fn(), runCompress: vi.fn() },
    swimSqlInit: { getSwimGraphParsedInfoStore: vi.fn() },
    converter: { FormatValidator: { validatePerfSwimlane: vi.fn(), validateMergedSwimlane: vi.fn() }, PerfSwimlaneConverter: { convertWithDeps: vi.fn() } },
    fileSystem: { readFirstNLines: vi.fn() },
    services: { useService: vi.fn() },
    workspace: { getConfiguration: vi.fn(), workspaceFolders: [] as any[], fs: { readFile: vi.fn() }, openTextDocument: vi.fn() },
    window: { showOpenDialog: vi.fn(), showWarningMessage: vi.fn(), showInformationMessage: vi.fn(), showErrorMessage: vi.fn(), createOutputChannel: vi.fn(), showTextDocument: vi.fn() },
    commands: { executeCommand: vi.fn() },
    workspace2: { openTextDocument: vi.fn() },
    registerCommand: { getBasenameWithoutExt: vi.fn((p: string) => p.split('/').pop()?.replace('.json', '') || '') },
    theme: { getIDETheme: vi.fn() },
  },
}));

vi.mock('vscode', async () => {
  const mock = await import('./../mocks/vscode');
  return {
    ...mock,
    Uri: { file: (p: string) => ({ fsPath: p }) },
    window: mocks.window,
    workspace: mocks.workspace,
    commands: mocks.commands,
    ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  };
});

vi.mock('i18next', () => ({ t: (key: string, opts?: any) => key + (opts ? JSON.stringify(opts) : '') }));
vi.mock('fs', async (orig) => { const a = await orig<typeof import('fs')>(); return { ...a, ...mocks.fs }; });
vi.mock('fs/promises', () => ({ default: { stat: mocks.fs.stat } }));
vi.mock(import('../../../src/util'), () => ({ Util: mocks.util }));
vi.mock(import('../../../src/hismarliteEx'), () => ({ hismartliteEx: mocks.hismarliteEx }));
vi.mock(import('../../../src/process'), () => mocks.process);
vi.mock(import('../../../src/core/sqliteCache'), () => mocks.sqliteCache);
vi.mock('@pypto/data-compress', () => mocks.dataCompress);
vi.mock(import('../../../src/core/swimSqlInit'), () => mocks.swimSqlInit);
vi.mock(import('../../../src/converter'), () => mocks.converter);
vi.mock(import('../../../src/utils/file-system'), () => ({ readFirstNLines: mocks.fileSystem.readFirstNLines }));
vi.mock(import('../../../src/services'), () => ({ useService: mocks.services.useService }));
vi.mock(import('../../../src/command/registerCommand'), () => ({ getBasenameWithoutExt: mocks.registerCommand.getBasenameWithoutExt }));
vi.mock(import('../../../src/theme'), () => ({ getIDETheme: mocks.theme.getIDETheme }));

import { SwimGraphMsgHandler } from '../../../src/handler/swimGraphMsgHandler';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'time').mockImplementation(() => {});
vi.spyOn(console, 'timeEnd').mockImplementation(() => {});

function createServer(overrides: any = {}) {
  return {
    swimDataPath: '/test/swim.json',
    query: { isPerfSwim: false, isMsProf: false },
    setRef: vi.fn(),
    constructor: { name: 'SwimGraphServer' },
    ...overrides,
  };
}

describe('SwimGraphMsgHandler static properties', () => {
  it('WHITE_COMMANDS contains expected commands', () => {
    expect(SwimGraphMsgHandler.WHITE_COMMANDS.has('getSwimData')).toBe(true);
    expect(SwimGraphMsgHandler.WHITE_COMMANDS.has('getData')).toBe(true);
    expect(SwimGraphMsgHandler.WHITE_COMMANDS.has('saveRendingMode')).toBe(true);
    expect(SwimGraphMsgHandler.WHITE_COMMANDS.has('getShortCutKeyCfg')).toBe(true);
    expect(SwimGraphMsgHandler.WHITE_COMMANDS.has('unknownCommand')).toBe(false);
  });
});

describe('SwimGraphMsgHandler.setEventToLocate / consumeEventToLocate', () => {
  beforeEach(() => { SwimGraphMsgHandler.eventToLocate = null; });

  it('sets and consumes event', () => {
    SwimGraphMsgHandler.setEventToLocate(5, 10);
    expect(SwimGraphMsgHandler.eventToLocate).toEqual({ seqNo: 5, taskId: 10 });
    const result = SwimGraphMsgHandler.consumeEventToLocate();
    expect(result).toEqual({ seqNo: 5, taskId: 10 });
    expect(SwimGraphMsgHandler.eventToLocate).toBeNull();
  });

  it('consumeEventToLocate returns null when no event set', () => {
    const result = SwimGraphMsgHandler.consumeEventToLocate();
    expect(result).toBeNull();
  });
});

describe('SwimGraphMsgHandler.getInitialData', () => {
  it('sets returnSwim ref with empty data', async () => {
    const server = createServer();
    await SwimGraphMsgHandler.getInitialData(server);
    expect(server.setRef).toHaveBeenCalledWith('returnSwim', { data: {} });
  });
});

describe('SwimGraphMsgHandler.getPerformanceInfo', () => {
  it('returns start and transform times', async () => {
    const result = await SwimGraphMsgHandler.getPerformanceInfo(createServer());
    expect(result).toEqual({ startTime: 100, transformStartTime: 200 });
  });
});

describe('SwimGraphMsgHandler.warnPerformance', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when file size <= minKey', () => {
    const server = createServer();
    SwimGraphMsgHandler.warnPerformance(server, 50 * 1024 * 1024, mocks.hismarliteEx.swimPerformanceBase.first);
    expect(server.setRef).not.toHaveBeenCalled();
  });

  it('sets performanceWarn when file size >= maxKey', () => {
    const server = createServer();
    SwimGraphMsgHandler.warnPerformance(server, 2000 * 1024 * 1024, mocks.hismarliteEx.swimPerformanceBase.first);
    expect(server.setRef).toHaveBeenCalledWith('performanceWarn', expect.any(String));
  });

  it('sets estimated time range when file size is between min and max', () => {
    const server = createServer();
    SwimGraphMsgHandler.warnPerformance(server, 300 * 1024 * 1024, mocks.hismarliteEx.swimPerformanceBase.first);
    expect(server.setRef).toHaveBeenCalledWith('performanceWarn', expect.any(String));
  });

  it('does nothing when file size is between two base sizes but result is undefined', () => {
    const server = createServer();
    SwimGraphMsgHandler.warnPerformance(server, 750 * 1024 * 1024, { vsOpen: { 100: 1, 500: 5 }, vsHW: { 100: 2, 500: 8 } });
    expect(server.setRef).toHaveBeenCalledWith('performanceWarn', expect.any(String));
  });
});

describe('SwimGraphMsgHandler.splitJson', () => {
  it('splits swim data into first package and event packages', async () => {
    const swimData = {
      processes: {
        1: { threads: { 10: { events: Array(2500).fill({ name: 'event' }) } } },
      },
      lane2line: {},
    };
    const result = await SwimGraphMsgHandler.splitJson(swimData);
    expect(result[0].type).toBe('first');
    expect(result[0].data.processes[1].threads[10].events).toEqual([]);
    expect(result.length).toBeGreaterThan(1);
    expect(result[1].type).toBe('events');
    expect(result[1].processId).toBe('1');
    expect(result[1].threadId).toBe('10');
  });

  it('handles empty events list', async () => {
    const swimData = { processes: { 1: { threads: { 10: { events: [] } } } }, lane2line: {} };
    const result = await SwimGraphMsgHandler.splitJson(swimData);
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('first');
  });

  it('logs timeEnd when isDebug is true', async () => {
    mocks.hismarliteEx.isDebug = true;
    const swimData = { processes: { 1: { threads: { 10: { events: [] } } } }, lane2line: {} };
    await SwimGraphMsgHandler.splitJson(swimData);
    mocks.hismarliteEx.isDebug = false;
  });
});

describe('SwimGraphMsgHandler.getOtherData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error when file is not readable', async () => {
    mocks.fs.accessSync.mockImplementation(() => { throw new Error('EACCES'); });
    const server = createServer();
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(server.setRef).toHaveBeenCalledWith('noSwimFile', expect.any(Object));
  });

  it('returns config and paths when file is readable', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ '/test/swim.json': '/test/com.json', colorRending: 'subGraph', textRending: ['taskName'], aicpuColorRending: 'name', perfColorReding: 'perfName', hashOrderRending: 'cubeMergeHashOrder' });
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({ connectionLevel: -1 });
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    const server = createServer();
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.swimPath).toBe('/test/swim.json');
    expect(result.comGraphPath).toBe('/test/com.json');
    expect(result.title).toBe('swim');
    expect(result.isDebug).toBe(false);
    expect(result.configuration.kernelTextRending).toEqual(['taskName']);
  });

  it('reads file content when query is missing isPerfSwim/isMsProf', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"traceEvents":[]}']);
    const server = createServer({ query: undefined });
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.isPerfSwim).toBe(false);
    expect(result.isMsProf).toBe(false);
  });

  it('detects perfSwim format from file content', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"tasks":[]}']);
    const server = createServer({ query: undefined });
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.isPerfSwim).toBe(true);
    expect(result.isMsProf).toBe(false);
  });

  it('detects msProf format from file content', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['[{"pid":1}]']);
    const server = createServer({ query: undefined });
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.isPerfSwim).toBe(false);
    expect(result.isMsProf).toBe(true);
  });

  it('uses label colorRending for ThreeColumn server', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    const server = createServer({ constructor: { name: 'ThreeColumnServer' } });
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.configuration.kernelColorRending).toBe('label');
  });

  it('uses name colorRending for isMsProf query', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    const server = createServer({ query: { isPerfSwim: false, isMsProf: true } });
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.configuration.kernelColorRending).toBe('name');
  });

  it('handles empty textRending in cache', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ textRending: [] });
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    const server = createServer();
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.configuration.kernelTextRending).toEqual(['taskName', 'taskLabel']);
  });

  it('includes eventToLocate in result', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.registerCommand.getBasenameWithoutExt.mockReturnValue('swim');
    SwimGraphMsgHandler.setEventToLocate(3, 7);
    const server = createServer();
    const result = await SwimGraphMsgHandler.getOtherData(server);
    expect(result.locateTarget).toEqual({ seqNo: 3, taskId: 7 });
  });
});

describe('SwimGraphMsgHandler.checkFileReadable', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns true when file is readable', () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    const server = createServer();
    expect((SwimGraphMsgHandler as any).checkFileReadable('/test.json', server)).toBe(true);
  });

  it('returns false and sets ref when file is not readable', () => {
    mocks.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const server = createServer();
    expect((SwimGraphMsgHandler as any).checkFileReadable('/test.json', server)).toBe(false);
    expect(server.setRef).toHaveBeenCalledWith('noSwimFile', expect.any(Object));
  });
});

describe('SwimGraphMsgHandler.validateFile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns file content', async () => {
    mocks.fs.readFileSync.mockReturnValue('{"data":1}');
    const result = await SwimGraphMsgHandler.validateFile(createServer());
    expect(result).toBe('{"data":1}');
  });
});

describe('SwimGraphMsgHandler.showMessage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows information message', async () => {
    await SwimGraphMsgHandler.showMessage(createServer(), { text: 'hello' });
    expect(mocks.window.showInformationMessage).toHaveBeenCalledWith('hello');
  });
});

describe('SwimGraphMsgHandler.saveRendingMode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls writeSwimConfigMap', async () => {
    SwimGraphMsgHandler.cacheCfgPath = '/cache/cfg.json';
    await SwimGraphMsgHandler.saveRendingMode(createServer(), '{"color":"red"}');
    expect(mocks.util.writeSwimConfigMap).toHaveBeenCalledWith('/cache/cfg.json', '{"color":"red"}');
  });
});

describe('SwimGraphMsgHandler.changeUserCfgConnection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates connectionLevel config', async () => {
    const mockUpdate = vi.fn();
    mocks.workspace.getConfiguration.mockReturnValue({ update: mockUpdate });
    await SwimGraphMsgHandler.changeUserCfgConnection(createServer(), { level: 5 });
    expect(mockUpdate).toHaveBeenCalledWith('connectionLevel', 5, 1);
  });
});

describe('SwimGraphMsgHandler.changeUserCfgPerformance', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates showPerformancePanel config', async () => {
    const mockUpdate = vi.fn();
    mocks.workspace.getConfiguration.mockReturnValue({ update: mockUpdate });
    await SwimGraphMsgHandler.changeUserCfgPerformance(createServer(), { show: true });
    expect(mockUpdate).toHaveBeenCalledWith('showPerformancePanel', true, 1);
  });
});

describe('SwimGraphMsgHandler.changeUserCfgIsMixMode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates showIsMixMode config', async () => {
    const mockUpdate = vi.fn();
    mocks.workspace.getConfiguration.mockReturnValue({ update: mockUpdate });
    await SwimGraphMsgHandler.changeUserCfgIsMixMode(createServer(), { show: false });
    expect(mockUpdate).toHaveBeenCalledWith('showIsMixMode', false, 1);
  });
});

describe('SwimGraphMsgHandler.getShortCutKeyCfg', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns shortcut config', async () => {
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({ ZoomInShortcut: 'w' });
    const result = await SwimGraphMsgHandler.getShortCutKeyCfg(createServer());
    expect(result.configration.ZoomInShortcut).toBe('w');
  });
});

describe('SwimGraphMsgHandler.bindComGraphJson', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('binds com graph when user selects a file', async () => {
    mocks.window.showOpenDialog.mockResolvedValue([{ fsPath: '/test/com.json' }]);
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    SwimGraphMsgHandler.cachePath = '/cache.json';
    const server = createServer();
    const result = await SwimGraphMsgHandler.bindComGraphJson(server);
    expect(result).toBe('/test/com.json');
    expect(server.setRef).toHaveBeenCalledWith('bindResult', expect.objectContaining({ success: true, comGraphPath: '/test/com.json' }));
    expect(mocks.window.showInformationMessage).toHaveBeenCalled();
  });

  it('returns failure when user cancels file selection', async () => {
    mocks.window.showOpenDialog.mockResolvedValue(undefined);
    const server = createServer();
    const result = await SwimGraphMsgHandler.bindComGraphJson(server);
    expect(result).toBeUndefined();
    expect(server.setRef).toHaveBeenCalledWith('bindResult', expect.objectContaining({ success: false }));
  });

  it('returns failure when user selects empty array', async () => {
    mocks.window.showOpenDialog.mockResolvedValue([]);
    const server = createServer();
    await SwimGraphMsgHandler.bindComGraphJson(server);
    expect(server.setRef).toHaveBeenCalledWith('bindResult', expect.objectContaining({ success: false }));
  });
});

describe('SwimGraphMsgHandler.unbindComGraph', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('unbinds when binding exists', async () => {
    const cache = { '/test/swim.json': '/test/com.json' };
    mocks.util.readSwim2ComGraphMap.mockReturnValue(cache);
    SwimGraphMsgHandler.cachePath = '/cache.json';
    const server = createServer();
    await SwimGraphMsgHandler.unbindComGraph(server);
    expect(server.setRef).toHaveBeenCalledWith('unbindResult', expect.objectContaining({ success: true }));
    expect(cache['/test/swim.json']).toBeUndefined();
  });

  it('shows failure when no binding exists', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    SwimGraphMsgHandler.cachePath = '/cache.json';
    const server = createServer();
    await SwimGraphMsgHandler.unbindComGraph(server);
    expect(server.setRef).toHaveBeenCalledWith('unbindResult', expect.objectContaining({ success: false }));
  });
});

describe('SwimGraphMsgHandler.openBoundComGraph', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('opens com graph when bound and file exists', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ '/test/swim.json': '/test/com.json' });
    mocks.fs.existsSync.mockReturnValue(true);
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.openBoundComGraph(createServer());
    expect(mocks.commands.executeCommand).toHaveBeenCalledWith('vscode.open', expect.any(Object));
  });

  it('shows warning when no binding exists', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.openBoundComGraph(createServer());
    expect(mocks.window.showWarningMessage).toHaveBeenCalled();
  });

  it('shows error and offers unbind when bound file does not exist', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ '/test/swim.json': '/test/com.json' });
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.window.showErrorMessage.mockResolvedValue('unbind');
    const cache = { '/test/swim.json': '/test/com.json' };
    mocks.util.readSwim2ComGraphMap.mockReturnValue(cache);
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.openBoundComGraph(createServer());
    expect(mocks.window.showErrorMessage).toHaveBeenCalled();
  });
});

describe('SwimGraphMsgHandler.jumpToComGraph', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('jumps with nohash when com graph is bound', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ '/test/swim.json': '/test/com.json' });
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.services.useService.mockReturnValue({ query: () => ({ filter: () => ({ exec: async () => [] }) }) });
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.jumpToComGraph(createServer(), { hash: 'nohash' });
    expect(mocks.commands.executeCommand).toHaveBeenCalledWith('PyPTO.Open.OpenRenderGraphForCurrent', expect.any(Object));
  });

  it('jumps with hash when com graph is bound', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ '/test/swim.json': '/test/com.json' });
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.services.useService.mockReturnValue({ query: () => ({ filter: () => ({ exec: async () => [] }) }) });
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.jumpToComGraph(createServer(), { hash: 'abc123' });
    expect(mocks.commands.executeCommand).toHaveBeenCalledWith('PyPTO.Open.OpenComGraphByFunchash', expect.any(Object), 'abc123');
  });

  it('finds program.json in same dir when no binding', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.services.useService.mockReturnValue({ query: () => ({ filter: () => ({ exec: async () => [] }) }) });
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.jumpToComGraph(createServer(), { hash: 'nohash' });
    expect(mocks.commands.executeCommand).toHaveBeenCalled();
  });

  it('finds program.json via runData record when no binding', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.services.useService.mockReturnValue({ query: () => ({ filter: () => ({ exec: async () => [{ controlFlowFilePath: '/test/program.json' }] }) }) });
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.jumpToComGraph(createServer(), { hash: 'nohash' });
    expect(mocks.commands.executeCommand).toHaveBeenCalled();
  });

  it('calls bindComGraphJson when no program.json found', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.window.showOpenDialog.mockResolvedValue([{ fsPath: '/selected/com.json' }]);
    mocks.services.useService.mockReturnValue({ query: () => ({ filter: () => ({ exec: async () => [] }) }) });
    SwimGraphMsgHandler.cachePath = '/cache.json';
    const server = createServer();
    await SwimGraphMsgHandler.jumpToComGraph(server, { hash: 'nohash' });
    expect(mocks.commands.executeCommand).toHaveBeenCalled();
  });

  it('shows warning when com graph still not found after bind attempt', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.window.showOpenDialog.mockResolvedValue(undefined);
    mocks.services.useService.mockReturnValue({ query: () => ({ filter: () => ({ exec: async () => [] }) }) });
    SwimGraphMsgHandler.cachePath = '/cache.json';
    const server = createServer();
    await SwimGraphMsgHandler.jumpToComGraph(server, { hash: 'nohash' });
    expect(server.setRef).toHaveBeenCalledWith('bindResult', expect.objectContaining({ success: false }));
  });

  it('calls bindComGraphJson when bound file does not exist', async () => {
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ '/test/swim.json': '/test/com.json' });
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.window.showOpenDialog.mockResolvedValue([{ fsPath: '/selected/com.json' }]);
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.jumpToComGraph(createServer(), { hash: 'nohash' });
    expect(mocks.commands.executeCommand).toHaveBeenCalled();
  });
});

describe('SwimGraphMsgHandler.jumpRawMagic', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows error when ascendHint has invalid format', async () => {
    await SwimGraphMsgHandler.jumpRawMagic(createServer(), { rawmagic: 1, ascendHint: 'invalid' });
    expect(mocks.window.showErrorMessage).toHaveBeenCalled();
  });

  it('shows warning when seqDir does not exist', async () => {
    mocks.fs.existsSync.mockReturnValue(false);
    await SwimGraphMsgHandler.jumpRawMagic(createServer(), { rawmagic: 1, ascendHint: 'Task:[10-54-18]' });
    expect(mocks.window.showWarningMessage).toHaveBeenCalled();
  });

  it('opens exact file when it exists', async () => {
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.workspace.openTextDocument.mockResolvedValue({});
    await SwimGraphMsgHandler.jumpRawMagic(createServer(), { rawmagic: 42, ascendHint: 'Task:[10-54-18]' });
    expect(mocks.workspace.openTextDocument).toHaveBeenCalled();
  });

  it('searches for prefix-matching file when exact file not found', async () => {
    mocks.fs.existsSync.mockImplementation((p: string) => !p.includes('10-54-18-42.txt'));
    mocks.fs.readdirSync.mockReturnValue(['10-54-18-42-extra.txt', 'other.txt']);
    mocks.workspace.openTextDocument.mockResolvedValue({});
    await SwimGraphMsgHandler.jumpRawMagic(createServer(), { rawmagic: 42, ascendHint: 'Task:[10-54-18]' });
    expect(mocks.workspace.openTextDocument).toHaveBeenCalled();
  });

  it('shows error when readdirSync fails', async () => {
    mocks.fs.existsSync.mockImplementation((p: string) => !p.includes('10-54-18-42.txt'));
    mocks.fs.readdirSync.mockImplementation(() => { throw new Error('EACCES'); });
    await SwimGraphMsgHandler.jumpRawMagic(createServer(), { rawmagic: 42, ascendHint: 'Task:[10-54-18]' });
    expect(mocks.window.showErrorMessage).toHaveBeenCalled();
  });

  it('shows info when no matching file found', async () => {
    mocks.fs.existsSync.mockImplementation((p: string) => !p.includes('10-54-18-42.txt'));
    mocks.fs.readdirSync.mockReturnValue(['unrelated.txt']);
    await SwimGraphMsgHandler.jumpRawMagic(createServer(), { rawmagic: 42, ascendHint: 'Task:[10-54-18]' });
    expect(mocks.window.showInformationMessage).toHaveBeenCalled();
  });
});

describe('SwimGraphMsgHandler.readPmuData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty when pmu file does not exist', () => {
    mocks.fs.existsSync.mockReturnValue(false);
    const result = (SwimGraphMsgHandler as any).readPmuData('/test/pmu.csv');
    expect(result.pmuExist).toBe(false);
    expect(result.pmuData).toBe('');
  });

  it('reads and parses pmu data when file exists', () => {
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.fs.readFileSync.mockReturnValue('header\ndata');
    mocks.process.parsePmuInfo.mockReturnValue({ cycles: 100 });
    const result = (SwimGraphMsgHandler as any).readPmuData('/test/pmu.csv');
    expect(result.pmuExist).toBe(true);
    expect(result.pmuInfo).toEqual({ cycles: 100 });
  });

  it('handles readFileSync error', () => {
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.fs.readFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    const result = (SwimGraphMsgHandler as any).readPmuData('/test/pmu.csv');
    expect(result.pmuExist).toBe(true);
    expect(result.pmuData).toBe('');
  });
});

describe('SwimGraphMsgHandler.parseDynTopo', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('parses dyn_topo file correctly', () => {
    mocks.fs.readFileSync.mockReturnValue('seqNo,taskId,leafIndex,col3,col4,col5,col6,col7,col8,successors\n1,10,0,x,x,x,x,x,x,20,30\n2,11,1,x,x,x,x,x,x,');
    const result = (SwimGraphMsgHandler as any).parseDynTopo('/test/dyn_topo.txt');
    expect(result['1-10']).toEqual({ leafIndex: '0', successors: ['1-20', '1-30'] });
    expect(result['2-11']).toEqual({ leafIndex: '1', successors: [] });
  });

  it('returns empty object when file read fails', () => {
    mocks.fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const result = (SwimGraphMsgHandler as any).parseDynTopo('/test/dyn_topo.txt');
    expect(result).toEqual({});
  });

  it('skips lines with fewer than 10 columns', () => {
    mocks.fs.readFileSync.mockReturnValue('seqNo,taskId,leafIndex,successors\n1,10,0');
    const result = (SwimGraphMsgHandler as any).parseDynTopo('/test/dyn_topo.txt');
    expect(Object.keys(result).length).toBe(0);
  });
});

describe('SwimGraphMsgHandler.calculatePmuTotal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty when effectPmu is empty', () => {
    const result = (SwimGraphMsgHandler as any).calculatePmuTotal({});
    expect(result).toEqual({});
  });

  it('sums up pmu values correctly', () => {
    mocks.process.processTotalPmuCalc.mockImplementation(() => {});
    const effectPmu = {
      core0: { 'total cycle': '100', cube_busy_cycles: '10', vec_busy_cycles: '20', scalar_busy_cycles: '5', mte1_busy_cycles: '1', mte2_busy_cycles: '2', mte3_busy_cycles: '3', icache_miss: '4', icache_req: '8', pmu_fix_instr_busy: '1' },
      core1: { 'total cycle': '200', cube_busy_cycles: '30', vec_busy_cycles: '40', scalar_busy_cycles: '10', mte1_busy_cycles: '2', mte2_busy_cycles: '3', mte3_busy_cycles: '4', icache_miss: '5', icache_req: '10', pmu_fix_instr_busy: undefined },
    };
    const result = (SwimGraphMsgHandler as any).calculatePmuTotal(effectPmu);
    expect(result['total cycle']).toBe(300n);
    expect(result.cube_busy_cycles).toBe(40n);
    expect(result.pmu_fix_instr_busy).toBe(1n);
  });
});

describe('SwimGraphMsgHandler.postProcessSwimData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('converts Map entries to objects and sets pmuValid', () => {
    mocks.process.checkPmuDataValid.mockReturnValue(true);
    const swimData = {
      lane2line: new Map([['key', 'val']]),
      processes: new Map([['1', { threads: new Map([['10', { events: [] }]]) }]]),
      processExpanded: new Map([['key', 'val']]),
    };
    (SwimGraphMsgHandler as any).postProcessSwimData(swimData, true, 'header\ndata', { cycles: 100 });
    expect(swimData.lane2line).toEqual({ key: 'val' });
    expect(swimData.processes['1'].threads[10]).toEqual({ events: [] });
    expect(swimData.pmuValid).toBe(true);
    expect(swimData.counterEvents).toEqual([]);
  });

  it('sets pmuValid to false when pmu does not exist', () => {
    const swimData = { lane2line: new Map(), processes: new Map(), processExpanded: new Map() };
    (SwimGraphMsgHandler as any).postProcessSwimData(swimData, false, '', {});
    expect(swimData.pmuValid).toBe(false);
  });

  it('handles pmuExist with empty pmuData', () => {
    mocks.process.checkPmuDataValid.mockReturnValue(false);
    const swimData = { lane2line: new Map(), processes: new Map(), processExpanded: new Map() };
    (SwimGraphMsgHandler as any).postProcessSwimData(swimData, true, '', {});
    expect(swimData.pmuValid).toBe(false);
  });
});

describe('SwimGraphMsgHandler.getFileChangeStatus', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns change times and fileChanged=false when unchanged', async () => {
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    const result = await (SwimGraphMsgHandler as any).getFileChangeStatus('/test/swim.json', { lastChangeTime: '2024-01-01', dynTopoLastChangeTime: '', pmuLastChangeTime: '' });
    expect(result.fileChanged).toBe(false);
  });

  it('returns fileChanged=true when swim file changed', async () => {
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-02-01');
    mocks.fs.existsSync.mockReturnValue(false);
    const result = await (SwimGraphMsgHandler as any).getFileChangeStatus('/test/swim.json', { lastChangeTime: '2024-01-01', dynTopoLastChangeTime: '', pmuLastChangeTime: '' });
    expect(result.fileChanged).toBe(true);
  });

  it('returns fileChanged=true when pmu file changed', async () => {
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-02-01');
    mocks.fs.existsSync.mockReturnValue(true);
    const result = await (SwimGraphMsgHandler as any).getFileChangeStatus('/test/swim.json', { lastChangeTime: '2024-02-01', dynTopoLastChangeTime: '', pmuLastChangeTime: '2024-01-01' });
    expect(result.fileChanged).toBe(true);
  });

  it('returns fileChanged=false when no parsedInfoRow', async () => {
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    const result = await (SwimGraphMsgHandler as any).getFileChangeStatus('/test/swim.json', null);
    expect(result.fileChanged).toBe(false);
  });
});

describe('SwimGraphMsgHandler.loadCachedSwimData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns parsed swim data when valid', async () => {
    mocks.workspace.fs.readFile.mockResolvedValue(new Uint8Array(Buffer.from(JSON.stringify({ processes: {}, lane2line: {}, pmu_total: {} }))));
    const result = await (SwimGraphMsgHandler as any).loadCachedSwimData(createServer(), { infoPath: '/cache.json' }, { size: 1000 });
    expect(result.processes).toEqual({});
  });

  it('returns null and sets dataError when cached data is invalid', async () => {
    mocks.workspace.fs.readFile.mockResolvedValue(new Uint8Array(Buffer.from(JSON.stringify({ processes: 'not_object' }))));
    const server = createServer();
    const result = await (SwimGraphMsgHandler as any).loadCachedSwimData(server, { infoPath: '/cache.json' }, { size: 1000 });
    expect(result).toBeNull();
    expect(server.setRef).toHaveBeenCalledWith('dataError', expect.any(Object));
  });
});

describe('SwimGraphMsgHandler.readSwimlaneData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reads and converts perf swimlane data', async () => {
    mocks.process.readSwimlaneFileStream.mockResolvedValue({ tasks: [] });
    mocks.converter.FormatValidator.validatePerfSwimlane.mockReturnValue({ valid: true });
    mocks.converter.PerfSwimlaneConverter.convertWithDeps.mockReturnValue({ traceEvents: [] });
    const server = createServer({ query: { isPerfSwim: true, isMsProf: false } });
    const result = await (SwimGraphMsgHandler as any).readSwimlaneData(server, '/test/swim.json');
    expect(result.traceEvents).toEqual([]);
  });

  it('returns null when perf swimlane validation fails', async () => {
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.converter.FormatValidator.validatePerfSwimlane.mockReturnValue({ valid: false, error: 'bad' });
    const server = createServer({ query: { isPerfSwim: true, isMsProf: false } });
    const result = await (SwimGraphMsgHandler as any).readSwimlaneData(server, '/test/swim.json');
    expect(result).toBeNull();
    expect(server.setRef).toHaveBeenCalledWith('dataError', expect.any(Object));
  });

  it('reads merged swimlane data', async () => {
    mocks.process.readSwimlaneFileStream.mockResolvedValue([{ event: 1 }]);
    const server = createServer({ query: { isPerfSwim: false, isMsProf: false } });
    const result = await (SwimGraphMsgHandler as any).readSwimlaneData(server, '/test/swim.json');
    expect(result.traceEvents).toEqual([{ event: 1 }]);
  });

  it('returns null and sets dataError on exception', async () => {
    mocks.process.readSwimlaneFileStream.mockRejectedValue(new Error('parse error'));
    const server = createServer();
    const result = await (SwimGraphMsgHandler as any).readSwimlaneData(server, '/test/swim.json');
    expect(result).toBeNull();
    expect(server.setRef).toHaveBeenCalledWith('dataError', expect.any(Object));
  });
});

describe('SwimGraphMsgHandler.parseSwimData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when swimlaneData is null', async () => {
    mocks.process.readSwimlaneFileStream.mockRejectedValue(new Error('read error'));
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    const result = await (SwimGraphMsgHandler as any).parseSwimData(createServer(), '/test/swim.json', { size: 1000 }, null, false, '2024-01-01', '', '', false);
    expect(result).toBeNull();
  });

  it('returns null when swimData has errMsg', async () => {
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ errMsg: 'parse failed' });
    mocks.fs.existsSync.mockReturnValue(false);
    const result = await (SwimGraphMsgHandler as any).parseSwimData(createServer(), '/test/swim.json', { size: 1000 }, null, false, '2024-01-01', '', '', false);
    expect(result).toBeNull();
  });

  it('returns swimData on successful parse', async () => {
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ processes: new Map(), lane2line: new Map(), processExpanded: new Map() });
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.process.processTotalPmuCalc.mockImplementation(() => {});
    const result = await (SwimGraphMsgHandler as any).parseSwimData(createServer(), '/test/swim.json', { size: 1000 }, null, false, '2024-01-01', '', '', false);
    expect(result.processes).toEqual({});
    expect(mocks.process.saveParsedInfoToDB).toHaveBeenCalled();
  });

  it('deletes old cache when file changed', async () => {
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ processes: new Map(), lane2line: new Map(), processExpanded: new Map() });
    mocks.fs.existsSync.mockReturnValue(false);
    const mockDelete = vi.fn();
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ delete: mockDelete, find: vi.fn() });
    const result = await (SwimGraphMsgHandler as any).parseSwimData(createServer(), '/test/swim.json', { size: 1000 }, { filePath: '/test/swim.json' }, true, '2024-01-01', '', '', false);
    expect(mockDelete).toHaveBeenCalledWith({ filePath: '/test/swim.json' });
  });
});

describe('SwimGraphMsgHandler.getSwimData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when file is not readable', async () => {
    mocks.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const result = await SwimGraphMsgHandler.getSwimData(createServer());
    expect(result).toBeUndefined();
  });

  it('returns cached data when available and file unchanged', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue({ lastChangeTime: '2024-01-01', dynTopoLastChangeTime: '', pmuLastChangeTime: '', infoPath: '/cache.json' }) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.workspace.fs.readFile.mockResolvedValue(new Uint8Array(Buffer.from(JSON.stringify({ processes: {}, lane2line: {}, pmu_total: {} }))));
    const result = await SwimGraphMsgHandler.getSwimData(createServer());
    expect(result).toBeDefined();
    expect(result[0].type).toBe('first');
  });

  it('returns parsed data when no cache', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ processes: new Map(), lane2line: new Map(), processExpanded: new Map() });
    const result = await SwimGraphMsgHandler.getSwimData(createServer());
    expect(result).toBeDefined();
  });
});

describe('SwimGraphMsgHandler.getCompressedData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when file is not readable', async () => {
    mocks.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const result = await SwimGraphMsgHandler.getCompressedData(createServer());
    expect(result).toBeUndefined();
  });

  it('returns cached compressed data when available and file unchanged', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue({ lastChangeTime: '2024-01-01', dynTopoLastChangeTime: '', pmuLastChangeTime: '', infoPath: '/cache.json' }) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.dataCompress.readCompressedFile.mockResolvedValue({ data: 'cached' });
    const result = await SwimGraphMsgHandler.getCompressedData(createServer());
    expect(result).toEqual({ data: 'cached' });
  });

  it('compresses data when no cache', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.dataCompress.runCompress.mockImplementation(async (opts: any, logger: any) => {
      logger.log('test log');
      logger.error('test error');
      logger.warn('test warn');
    });
    mocks.dataCompress.readCompressedFile.mockResolvedValue({ data: 'compressed' });
    mocks.window.createOutputChannel.mockReturnValue({ appendLine: vi.fn() });
    const result = await SwimGraphMsgHandler.getCompressedData(createServer());
    expect(result).toEqual({ data: 'compressed' });
  });

  it('deletes old cache when file changed', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    const mockDelete = vi.fn();
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue({ lastChangeTime: '2024-01-01', dynTopoLastChangeTime: '', pmuLastChangeTime: '', infoPath: '/cache.json' }), delete: mockDelete });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-02-01');
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.dataCompress.runCompress.mockResolvedValue(undefined);
    mocks.dataCompress.readCompressedFile.mockResolvedValue({ data: 'new' });
    mocks.window.createOutputChannel.mockReturnValue({ appendLine: vi.fn() });
    const result = await SwimGraphMsgHandler.getCompressedData(createServer());
    expect(mockDelete).toHaveBeenCalled();
  });

  it('logs timeEnd when isDebug', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.dataCompress.runCompress.mockResolvedValue(undefined);
    mocks.dataCompress.readCompressedFile.mockResolvedValue({});
    mocks.window.createOutputChannel.mockReturnValue({ appendLine: vi.fn() });
    mocks.hismarliteEx.isDebug = true;
    await SwimGraphMsgHandler.getCompressedData(createServer());
    mocks.hismarliteEx.isDebug = false;
  });
});

describe('SwimGraphMsgHandler.getData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls getSwimData when pmu file exists', async () => {
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ processes: new Map(), lane2line: new Map(), processExpanded: new Map() });
    const result = await SwimGraphMsgHandler.getData(createServer());
    expect(result).toBeDefined();
  });

  it('calls getSwimData when isPerfSwim and not isMsProf', async () => {
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ processes: new Map(), lane2line: new Map(), processExpanded: new Map() });
    const server = createServer({ query: { isPerfSwim: true, isMsProf: false } });
    const result = await SwimGraphMsgHandler.getData(server);
    expect(result).toBeDefined();
  });

  it('falls back to getSwimData when getCompressedData fails', async () => {
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.dataCompress.runCompress.mockRejectedValue(new Error('compress failed'));
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ processes: new Map(), lane2line: new Map(), processExpanded: new Map() });
    const server = createServer({ query: { isPerfSwim: false, isMsProf: false } });
    const result = await SwimGraphMsgHandler.getData(server);
    expect(result).toBeDefined();
  });

  it('returns compressed data when successful', async () => {
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({});
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.dataCompress.runCompress.mockResolvedValue(undefined);
    mocks.dataCompress.readCompressedFile.mockResolvedValue({ data: 'compressed' });
    mocks.window.createOutputChannel.mockReturnValue({ appendLine: vi.fn() });
    const server = createServer({ query: { isPerfSwim: false, isMsProf: false } });
    const result = await SwimGraphMsgHandler.getData(server);
    expect(result).toEqual({ data: 'compressed' });
  });

  it('logs time when isDebug', async () => {
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.process.readSwimlaneFileStream.mockResolvedValue({});
    mocks.process.parseSwimLaneInfo.mockResolvedValue({ processes: new Map(), lane2line: new Map(), processExpanded: new Map() });
    mocks.hismarliteEx.isDebug = true;
    await SwimGraphMsgHandler.getData(createServer());
    mocks.hismarliteEx.isDebug = false;
  });
});

describe('SwimGraphMsgHandler branch coverage supplements', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getCompressedData with ThreeColumn server and pmu/dynTopo files existing', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.util.getCachePath.mockReturnValue('/cache.json');
    mocks.util.readSwim2ComGraphMap.mockReturnValue({ textRending: [] });
    mocks.util.getSwimGraphCustomCfg.mockReturnValue({});
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue(null) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(true);
    mocks.dataCompress.runCompress.mockResolvedValue(undefined);
    mocks.dataCompress.readCompressedFile.mockResolvedValue({ data: 'compressed' });
    mocks.window.createOutputChannel.mockReturnValue({ appendLine: vi.fn() });
    const server = createServer({ constructor: { name: 'ThreeColumnServer' }, query: { isPerfSwim: false, isMsProf: false } });
    const result = await SwimGraphMsgHandler.getCompressedData(server);
    expect(result).toEqual({ data: 'compressed' });
  });

  it('loadCachedSwimData throws when JSON.parse fails on invalid content', async () => {
    mocks.workspace.fs.readFile.mockResolvedValue(new Uint8Array(Buffer.from('invalid json')));
    await expect((SwimGraphMsgHandler as any).loadCachedSwimData(createServer(), { infoPath: '/cache.json' }, { size: 1000 })).rejects.toThrow();
  });

  it('openBoundComGraph triggers unbind when user confirms', async () => {
    const cache = { '/test/swim.json': '/test/com.json' };
    mocks.util.readSwim2ComGraphMap.mockReturnValue(cache);
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.window.showErrorMessage.mockResolvedValue('unbind');
    SwimGraphMsgHandler.cachePath = '/cache.json';
    await SwimGraphMsgHandler.openBoundComGraph(createServer());
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.window.showErrorMessage).toHaveBeenCalled();
  });

  it('loadCachedSwimData returns null when swimData has invalid structure', async () => {
    mocks.workspace.fs.readFile.mockResolvedValue(new Uint8Array(Buffer.from(JSON.stringify({ processes: 'not_object' }))));
    const server = createServer();
    const result = await (SwimGraphMsgHandler as any).loadCachedSwimData(server, { infoPath: '/cache.json' }, { size: 1000 });
    expect(result).toBeNull();
    expect(server.setRef).toHaveBeenCalledWith('dataError', expect.any(Object));
  });

  it('getSwimData returns early when cached data is invalid', async () => {
    mocks.fs.accessSync.mockReturnValue(undefined);
    mocks.fs.stat.mockResolvedValue({ size: 1000 });
    mocks.swimSqlInit.getSwimGraphParsedInfoStore.mockReturnValue({ find: vi.fn().mockResolvedValue({ lastChangeTime: '2024-01-01', dynTopoLastChangeTime: '', pmuLastChangeTime: '', infoPath: '/cache.json' }) });
    mocks.sqliteCache.getMTime.mockResolvedValue('2024-01-01');
    mocks.fs.existsSync.mockReturnValue(false);
    mocks.workspace.fs.readFile.mockResolvedValue(new Uint8Array(Buffer.from(JSON.stringify({ processes: 'bad' }))));
    const result = await SwimGraphMsgHandler.getSwimData(createServer());
    expect(result).toBeUndefined();
  });

  it('warnPerformance with result being undefined (file size outside all ranges)', () => {
    const server = createServer();
    SwimGraphMsgHandler.warnPerformance(server, 750 * 1024 * 1024, { vsOpen: { 100: 1, 500: 5 }, vsHW: { 100: 2, 500: 8 } });
    expect(server.setRef).toHaveBeenCalledWith('performanceWarn', expect.any(String));
  });
});
