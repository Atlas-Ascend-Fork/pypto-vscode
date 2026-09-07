/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockEditorView } = vi.hoisted(() => ({
  mockEditorView: {
    open: vi.fn(),
    closeAll: vi.fn(),
    openServer: new Map<string, any>(),
  },
}));

vi.mock(import('../../../src/view'), () => ({
  useView: () => ({ editorView: mockEditorView }),
}));

vi.mock(import('../../../src/utils/file-system'), () => ({
  readFirstNLines: vi.fn().mockResolvedValue([]),
}));

vi.mock(import('../../../src/common/csvReader'), () => ({
  readCsv: vi.fn().mockResolvedValue(undefined),
  getCsvData: vi.fn(),
}));

vi.mock(import('../../../src/handler/swimGraphMsgHandler'), () => ({
  SwimGraphMsgHandler: {
    setEventToLocate: vi.fn(),
    consumeEventToLocate: vi.fn(),
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(true) };
});

const { mockPlatform, mockExec } = vi.hoisted(() => ({
  mockPlatform: vi.fn(),
  mockExec: vi.fn(),
}));

vi.mock('os', () => ({
  platform: () => mockPlatform(),
  default: { platform: () => mockPlatform() },
}));

vi.mock('child_process', () => ({
  exec: (...args: unknown[]) => mockExec(...args),
}));

import { RegisterCommand, getBasenameWithoutExt } from '../../../src/command/registerCommand';

import { commands, window, workspace, Uri } from 'vscode';

import { readFirstNLines } from '../../../src/utils/file-system';
import { useView } from '../../../src/view';
import { SwimGraphMsgHandler } from '../../../src/handler/swimGraphMsgHandler';
import * as fs from 'fs';

function createRegisterCommand() {
  const context = { subscriptions: [] as any[] };
  const instance = new RegisterCommand(context as any);
  const viewResult = useView();
  instance.register(viewResult);
  return { instance, context, editorView: mockEditorView };
}

describe('getBasenameWithoutExt', () => {
  it('extracts name from a normal file path', () => {
    expect(getBasenameWithoutExt('/home/user/graph.json')).toBe('graph');
  });

  it('extracts name from a file without extension', () => {
    expect(getBasenameWithoutExt('/home/user/README')).toBe('README');
  });

  it('extracts name from a multi-level directory path', () => {
    expect(getBasenameWithoutExt('/a/b/c/d/e/file.txt')).toBe('file');
  });

  it('handles dotfiles correctly', () => {
    expect(getBasenameWithoutExt('/home/user/.eslintrc')).toBe('.eslintrc');
  });

  it('handles files with multiple dots', () => {
    expect(getBasenameWithoutExt('/path/to/data.config.json')).toBe('data.config');
  });
});

describe('RegisterCommand.getCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers all 12 commands with correct command IDs', () => {
    const { context } = createRegisterCommand();
    const expectedIds = [
      'PyPTO.readCsv',
      'PyPTO.getCsvData',
      'PyPTO.Open.OpenGmMemoryVisualization',
      'PyPTO.Open.OpenRenderGraphForCurrent',
      'PyPTO.Open.OpenComGraphByFunchash',
      'PyPTO.Open.OpenDiffComGraphForCurrent',
      'PyPTO.Open.OpenComGraphForNodeSearch',
      'PyPTO.Open.OpenLinkageMode',
      'PyPTO.Open.OpenSwimGraph',
      'PyPTO.Open.CloseAllToolPages',
      'PyPto.Open.postLayoutData',
      'PyPTO.ExecuteRemoteCommand',
    ];
    expect(context.subscriptions).toHaveLength(12);
    expectedIds.forEach((id) => {
      expect(commands.registerCommand).toHaveBeenCalledWith(id, expect.any(Function));
    });
  });
});

describe('RegisterCommand.closeAllToolPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls editorView.closeAll', () => {
    const { instance } = createRegisterCommand();
    instance.closeAllToolPages();
    expect(mockEditorView.closeAll).toHaveBeenCalledTimes(1);
  });
});

describe('RegisterCommand.openView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFirstNLines).mockResolvedValue([] as any);
  });

  it('routes to computeGraph when content contains entryhash', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"entryhash":true}'] as any);
    const uri = Uri.file('/test/graph.json');
    await instance.openView('computeGraph', uri);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'computeGraph',
      expect.objectContaining({ fsPath: '/test/graph.json' }),
      expect.objectContaining({
        query: expect.objectContaining({ funcHash: undefined }),
        title: 'graph',
      }),
    );
  });

  it('routes to swimGraph when content contains traceEvents', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"traceEvents":[]}'] as any);
    const uri = Uri.file('/test/trace.json');
    await instance.openView('computeGraph', uri);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'swimGraph',
      uri,
      expect.objectContaining({
        title: 'trace',
        query: { isPerfSwim: false, isMsProf: false },
      }),
    );
  });

  it('routes to swimGraph when content contains tasks', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"tasks":[]}'] as any);
    const uri = Uri.file('/test/tasks.json');
    await instance.openView('computeGraph', uri);
    expect(mockEditorView.open).toHaveBeenCalledWith('swimGraph', uri, expect.any(Object));
  });

  it('routes to swimGraph for msprof format (array starting with [ and containing pid)', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['[{"pid":1}]'] as any);
    const uri = Uri.file('/test/msprof.json');
    await instance.openView('computeGraph', uri);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'swimGraph',
      uri,
      expect.objectContaining({
        query: { isPerfSwim: false, isMsProf: true },
      }),
    );
  });

  it('routes to memory trace path when filename matches _OoO_Memory_Trace.json', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"other":"data"}'] as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const uri = Uri.file('/test/trace_OoO_Memory_Trace.json');
    await instance.openView('computeGraph', uri);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'computeGraph',
      expect.objectContaining({ fsPath: '/test/trace.json' }),
      expect.objectContaining({
        query: expect.objectContaining({ memoryPath: '/test/trace_OoO_Memory_Trace.json' }),
      }),
    );
  });

  it('shows error message when memory trace file has no matching com graph', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"other":"data"}'] as any);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const uri = Uri.file('/test/trace_OoO_Memory_Trace.json');
    await instance.openView('computeGraph', uri);
    expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.memoryTraceFileNoComGraph');
  });

  it('routes to gmMemoryVisual when filename is memory_usage_visualization.json', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"other":"data"}'] as any);
    const uri = Uri.file('/test/memory_usage_visualization.json');
    await instance.openView('computeGraph', uri);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'computeGraph',
      expect.objectContaining({ fsPath: '/test/memory_usage_visualization.json' }),
      expect.objectContaining({ query: {}, title: 'memory_usage_visualization' }),
    );
  });

  it('defaults to gmMemoryVisual when routeName is falsy for memory_usage_visualization.json', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"other":"data"}'] as any);
    const uri = Uri.file('/test/memory_usage_visualization.json');
    await instance.openView('', uri);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'gmMemoryVisual',
      expect.objectContaining({ fsPath: '/test/memory_usage_visualization.json' }),
      expect.objectContaining({ query: {}, title: 'memory_usage_visualization' }),
    );
  });

  it('shows information message when content does not match any known format', async () => {
    const { instance } = createRegisterCommand();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"unknown":"format"}'] as any);
    const uri = Uri.file('/test/unknown.json');
    await instance.openView('computeGraph', uri);
    expect(window.showInformationMessage).toHaveBeenCalledWith('pypto.cannotRender');
  });
});

describe('RegisterCommand.registerCloseAllToolPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls closeAllToolPages via command callback', () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.CloseAllToolPages',
    );
    expect(callArgs).toBeDefined();
    const handler = callArgs![1] as () => void;
    handler();
    expect(mockEditorView.closeAll).toHaveBeenCalledTimes(1);
  });
});

describe('RegisterCommand.registerPostLayoutData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls server.renderLayout with correct data when server exists', () => {
    const { instance } = createRegisterCommand();
    const fakeServer = { renderLayout: vi.fn() };
    mockEditorView.openServer.set('server1', fakeServer);
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPto.Open.postLayoutData',
    );
    expect(callArgs).toBeDefined();
    const handler = callArgs![1] as (id: string, data: any) => void;
    handler('server1&&infoStr', { layout: 'data' });
    expect(fakeServer.renderLayout).toHaveBeenCalledWith({ layout: 'data' }, 'infoStr');
    mockEditorView.openServer.clear();
  });

  it('does nothing when serverId does not match any server', () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPto.Open.postLayoutData',
    );
    const handler = callArgs![1] as (id: string, data: any) => void;
    expect(() => handler('nonexistent&&info', {})).not.toThrow();
  });

  it('handles id without && separator gracefully', () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPto.Open.postLayoutData',
    );
    const handler = callArgs![1] as (id: string, data: any) => void;
    expect(() => handler('nosplit', {})).not.toThrow();
  });
});

describe('RegisterCommand.registerOpenComGraphForNodeSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"entryhash":true}'] as any);
  });

  it('opens computeGraph with search params when uri is provided', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenComGraphForNodeSearch',
    );
    const handler = callArgs![1] as (uri: any, funcHash: string | undefined, nodeMagic: string) => Promise<void>;
    const uri = Uri.file('/test/graph.json');
    await handler(uri, 'abc123', '5');
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'computeGraph',
      expect.objectContaining({ fsPath: '/test/graph.json' }),
      expect.objectContaining({
        query: expect.objectContaining({ funcHash: 'abc123', isSearch: true, nodeMagic: '5' }),
      }),
    );
  });

  it('defaults nodeMagic to -1 when not provided', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenComGraphForNodeSearch',
    );
    const handler = callArgs![1] as (uri: any, funcHash: string | undefined, nodeMagic: string) => Promise<void>;
    const uri = Uri.file('/test/graph.json');
    await handler(uri, undefined, undefined as any);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'computeGraph',
      expect.any(Object),
      expect.objectContaining({
        query: expect.objectContaining({ funcHash: undefined, isSearch: true, nodeMagic: '-1' }),
      }),
    );
  });

  it('returns early when uri is undefined and no active text editor', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenComGraphForNodeSearch',
    );
    const handler = callArgs![1] as (uri: any, funcHash: string | undefined, nodeMagic: string) => Promise<void>;
    await handler(undefined, undefined, '1');
    expect(mockEditorView.open).not.toHaveBeenCalled();
  });

  it('uses active text editor uri when uri is undefined', async () => {
    createRegisterCommand();
    window.activeTextEditor = { document: { uri: { fsPath: '/test/active.json' } } } as any;
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenComGraphForNodeSearch',
    );
    const handler = callArgs![1] as (uri: any, funcHash: string | undefined, nodeMagic: string) => Promise<void>;
    await handler(undefined, 'hash', '1');
    expect(mockEditorView.open).toHaveBeenCalled();
    window.activeTextEditor = undefined;
  });
});

describe('RegisterCommand.registerOpenLinkageMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens threeColumnGraph when uri is provided', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenLinkageMode',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    const uri = Uri.file('/test/code.py');
    await handler(uri);
    expect(mockEditorView.open).toHaveBeenCalledWith('threeColumnGraph', uri);
  });

  it('returns early when uri is undefined and no active text editor', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenLinkageMode',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(mockEditorView.open).not.toHaveBeenCalled();
  });

  it('uses active text editor uri when uri is undefined', async () => {
    createRegisterCommand();
    window.activeTextEditor = { document: { uri: { fsPath: '/test/active.py' } } } as any;
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenLinkageMode',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(mockEditorView.open).toHaveBeenCalledWith('threeColumnGraph', expect.objectContaining({ fsPath: '/test/active.py' }));
    window.activeTextEditor = undefined;
  });
});

describe('RegisterCommand.registerReadCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads csv file when user selects a file', async () => {
    const { readCsv, getCsvData } = await import('../../../src/common/csvReader');
    createRegisterCommand();
    vi.mocked(window.showOpenDialog).mockResolvedValue([{ fsPath: '/test/data.csv' }] as any);
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.readCsv',
    );
    const handler = callArgs![1] as () => Promise<void>;
    await handler();
    expect(readCsv).toHaveBeenCalledWith('/test/data.csv', 4);
    expect(getCsvData).toHaveBeenCalledWith('/test/data.csv', 4);
  });

  it('returns early when user cancels file selection', async () => {
    const { readCsv } = await import('../../../src/common/csvReader');
    createRegisterCommand();
    vi.mocked(window.showOpenDialog).mockResolvedValue(undefined);
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.readCsv',
    );
    const handler = callArgs![1] as () => Promise<void>;
    await handler();
    expect(readCsv).not.toHaveBeenCalled();
  });
});

describe('RegisterCommand.registerGetCsvData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getCsvData with empty string', async () => {
    const { getCsvData } = await import('../../../src/common/csvReader');
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.getCsvData',
    );
    const handler = callArgs![1] as () => Promise<void>;
    await handler();
    expect(getCsvData).toHaveBeenCalledWith('');
  });
});

describe('RegisterCommand.registerOpenGmMemoryVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens gmMemoryVisual when uri points to memory_usage_visualization.json', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenGmMemoryVisualization',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    const uri = Uri.file('/test/memory_usage_visualization.json');
    await handler(uri);
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'gmMemoryVisual',
      expect.objectContaining({ fsPath: '/test/memory_usage_visualization.json' }),
      expect.objectContaining({ query: {}, title: 'memory_usage_visualization' }),
    );
  });

  it('shows information message when filename does not match', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenGmMemoryVisualization',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    const uri = Uri.file('/test/other.json');
    await handler(uri);
    expect(window.showInformationMessage).toHaveBeenCalledWith('pypto.cannotRender');
    expect(mockEditorView.open).not.toHaveBeenCalled();
  });

  it('shows information message when uri is undefined and no active editor', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenGmMemoryVisualization',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(window.showInformationMessage).toHaveBeenCalledWith('pypto.cannotRender');
  });

  it('uses active text editor uri when uri is undefined', async () => {
    createRegisterCommand();
    window.activeTextEditor = { document: { uri: { fsPath: '/test/memory_usage_visualization.json' } } } as any;
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenGmMemoryVisualization',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(mockEditorView.open).toHaveBeenCalled();
    window.activeTextEditor = undefined;
  });
});

describe('RegisterCommand.registerOpenRenderGraphForCurrent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"entryhash":true}'] as any);
  });

  it('opens computeGraph when uri is provided', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenRenderGraphForCurrent',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    const uri = Uri.file('/test/graph.json');
    await handler(uri);
    expect(mockEditorView.open).toHaveBeenCalled();
  });

  it('shows error message when uri is undefined and no active editor', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenRenderGraphForCurrent',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.entry.fileTooLarge');
  });

  it('uses active text editor uri when uri is undefined', async () => {
    createRegisterCommand();
    window.activeTextEditor = { document: { uri: { fsPath: '/test/active.json' } } } as any;
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenRenderGraphForCurrent',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(mockEditorView.open).toHaveBeenCalled();
    window.activeTextEditor = undefined;
  });
});

describe('RegisterCommand.registerOpenComGraphByFunchash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"entryhash":true}'] as any);
  });

  it('opens computeGraph with funcHash and extra params', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenComGraphByFunchash',
    );
    const handler = callArgs![1] as (uri: any, funcHash: string, fileType?: string, cmpCsvPath?: string, loopInfo?: string, rootFuncHash?: string, pathFunchash?: string) => Promise<void>;
    const uri = Uri.file('/test/graph.json');
    await handler(uri, 'hash1', 'type1', '/cmp.csv', 'loop1', 'rootHash', 'pathHash');
    expect(mockEditorView.open).toHaveBeenCalledWith(
      'computeGraph',
      expect.any(Object),
      expect.objectContaining({
        query: expect.objectContaining({
          funcHash: 'hash1',
          fileType: 'type1',
          outputPath: '/cmp.csv',
          loopInfo: 'loop1',
          rootFuncHash: 'rootHash',
          pathFunchash: 'pathHash',
        }),
      }),
    );
  });

  it('returns early when uri is undefined', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenComGraphByFunchash',
    );
    const handler = callArgs![1] as (uri: any, ...rest: any[]) => Promise<void>;
    await handler(undefined, 'hash1');
    expect(mockEditorView.open).not.toHaveBeenCalled();
  });
});

describe('RegisterCommand.registerOpenDiffComGraphForCurrent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readFirstNLines).mockResolvedValue(['{"entryhash":true}'] as any);
  });

  it('opens diffGraph when uri is provided', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenDiffComGraphForCurrent',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    const uri = Uri.file('/test/graph.json');
    await handler(uri);
    expect(mockEditorView.open).toHaveBeenCalled();
  });

  it('returns early when uri is undefined and no active editor', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenDiffComGraphForCurrent',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(mockEditorView.open).not.toHaveBeenCalled();
  });

  it('uses active text editor uri when uri is undefined', async () => {
    createRegisterCommand();
    window.activeTextEditor = { document: { uri: { fsPath: '/test/active.json' } } } as any;
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenDiffComGraphForCurrent',
    );
    const handler = callArgs![1] as (uri: any) => Promise<void>;
    await handler(undefined);
    expect(mockEditorView.open).toHaveBeenCalled();
    window.activeTextEditor = undefined;
  });
});

describe('RegisterCommand.registerOpenSwimGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditorView.openServer.clear();
  });

  it('returns early when swimPath is empty', async () => {
    createRegisterCommand();
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenSwimGraph',
    );
    const handler = callArgs![1] as (swimPath: string, seqNo: number, taskId: number) => Promise<void>;
    await handler('', 0, 0);
    expect(mockEditorView.open).not.toHaveBeenCalled();
  });

  it('reuses existing server when swimDataPath matches', async () => {
    createRegisterCommand();
    const locateNode = vi.fn();
    mockEditorView.openServer.set('s1', {
      swimDataPath: '/data/swim.json',
      locateNode,
    });
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenSwimGraph',
    );
    const handler = callArgs![1] as (swimPath: string, seqNo: number, taskId: number) => Promise<void>;
    await handler('/data/swim.json', 5, 10);
    expect(locateNode).toHaveBeenCalledWith(5, 10);
    expect(SwimGraphMsgHandler.setEventToLocate).not.toHaveBeenCalled();
  });

  it('sets event to locate when no existing server matches', async () => {
    createRegisterCommand();
    mockEditorView.openServer.set('s1', {
      swimDataPath: '/data/swim.json',
      locateNode: vi.fn(),
    });
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenSwimGraph',
    );
    const handler = callArgs![1] as (swimPath: string, seqNo: number, taskId: number) => Promise<void>;
    await handler('/data/other.json', 1, 2);
    expect(SwimGraphMsgHandler.setEventToLocate).toHaveBeenCalledWith(1, 2);
  });

  it('consumes event and locates node when server appears after open', async () => {
    createRegisterCommand();
    const locateNode = vi.fn();
    mockEditorView.open.mockImplementation(async () => {
      mockEditorView.openServer.set('s2', {
        swimDataPath: '/data/newswim.json',
        locateNode,
      });
    });
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(
      ([id]) => id === 'PyPTO.Open.OpenSwimGraph',
    );
    const handler = callArgs![1] as (swimPath: string, seqNo: number, taskId: number) => Promise<void>;
    await handler('/data/newswim.json', 7, 8);
    expect(SwimGraphMsgHandler.consumeEventToLocate).toHaveBeenCalledTimes(1);
    expect(locateNode).toHaveBeenCalledWith(7, 8);
    mockEditorView.open.mockReset();
  });
});

describe('PyPTO.ExecuteRemoteCommand handler', () => {
  let savedEnv: NodeJS.ProcessEnv;

  function getRemoteHandler() {
    const callArgs = vi.mocked(commands.registerCommand).mock.calls.find(([id]) => id === 'PyPTO.ExecuteRemoteCommand');
    return callArgs![1] as () => Promise<void>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    savedEnv = { ...process.env };
    mockPlatform.mockReturnValue('linux');
    mockExec.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (error: Error | null, stdout?: string, stderr?: string) => void;
      if (typeof cb === 'function') {
        cb(null, '', '');
      }
    });
    (workspace as { workspaceFolders?: unknown }).workspaceFolders = [{ uri: { fsPath: '/test/ws' } }];
    process.env.PYPTO_HOME = '/home/tester';
  });

  afterEach(() => {
    process.env = savedEnv;
    (workspace as { workspaceFolders?: unknown }).workspaceFolders = undefined;
  });

  it('rejects on non-linux platform without probing environment', async () => {
    mockPlatform.mockReturnValue('win32');
    createRegisterCommand();

    await getRemoteHandler()();

    expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.linuxOnly');
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('rejects when remote_tool.sh is unavailable', async () => {
    mockExec.mockImplementation((cmd: string, _opts: unknown, cb: (error: Error | null) => void) => {
      if (cmd.startsWith('remote_tool.sh -h')) {
        cb(new Error('not found'));
      }
    });
    createRegisterCommand();

    await getRemoteHandler()();

    expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.notTargetEnv');
  });

  it('rejects when workspace folder is missing', async () => {
    (workspace as { workspaceFolders?: unknown }).workspaceFolders = undefined;
    createRegisterCommand();

    await getRemoteHandler()();

    expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.envVarMissing');
  });

  it('rejects when user home env vars are missing', async () => {
    delete process.env.PYPTO_HOME;
    delete process.env.HOME;
    delete process.env.USERPROFILE;
    createRegisterCommand();

    await getRemoteHandler()();

    expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.envVarMissing');
  });

  it('executes sync command and reports success', async () => {
    mockExec.mockImplementation((_cmd: string, _opts: unknown, cb: (error: null, stdout: string, stderr: string) => void) => {
      cb(null, 'done ', ' ');
    });
    createRegisterCommand();

    await getRemoteHandler()();

    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining("remote_tool.sh exec --command 'mkdir -p /test/ws /home/tester/.pypto'"),
      expect.objectContaining({ timeout: 300000 }),
      expect.any(Function),
    );
    expect(window.showInformationMessage).toHaveBeenCalledWith('pypto.remoteTool.execSuccess');
  });

  it('reports failure with exit code when exec errors', async () => {
    mockExec.mockImplementation((cmd: string, _opts: unknown, cb: (error: unknown, stdout: string, stderr: string) => void) => {
      if (cmd.startsWith('remote_tool.sh -h')) {
        cb(null, '', '');
      } else {
        cb({ code: 3 }, '', 'ssh failure ');
      }
    });
    createRegisterCommand();

    await getRemoteHandler()();

    expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.execFailed');
  });
});
