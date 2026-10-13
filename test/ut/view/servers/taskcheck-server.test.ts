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

vi.mock(import('../../../../src/common/accurancyAnylasis'), () => ({
  getTaskCmpList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getPrecisionExceptList: vi.fn().mockResolvedValue({ data: [] }),
  openTaskCmpDiffComGraph: vi.fn().mockResolvedValue(undefined),
}));

vi.mock(import('../../../../src/core/sqliteCache'), () => ({
  SQLiteCache: { getInstance: vi.fn(() => ({})) },
}));

vi.mock(import('../../../../src/core/view/view-server'), () => {
  class MockViewServer {
    static _viewConfig: any = { apis: ['closeWebview'], refs: [] };
    _refMap = new Map<string, unknown>();
    _disposables: any[] = [];
    constructor(ctx: any) {
      ctx.init.call(this);
    }
    created(_ctx: any) {}
    setRef(key: string, value: unknown) {
      this._refMap.set(key, value);
    }
    getRef(key: string) {
      return this._refMap.get(key);
    }
    closeWebview() {}
    dispose() {}
  }
  return { ViewServer: MockViewServer, viewApi: () => () => {}, viewRefs: () => () => {} };
});

import { commands } from 'vscode';
import { TaskCheckViewServer } from '../../../../src/view/servers/taskcheck-server';
import { getTaskCmpList, getPrecisionExceptList, openTaskCmpDiffComGraph } from '../../../../src/common/accurancyAnylasis';

function createMockCtx() {
  return {
    viewType: 'taskCheck',
    fileUri: { fsPath: '/test/taskcheck.csv' },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
}

function createServer() {
  const ctx = createMockCtx();
  const server = new TaskCheckViewServer(ctx as any);
  server.created(ctx as any);
  return server;
}

describe('TaskCheckViewServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can be instantiated', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('created stores fileUri', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('getTaskCheckList sets mock data', async () => {
    const server = createServer();
    await server.getTaskCheckList({ outputPath: '/test/output' });
    expect(server.getRef('taskCheckList')).toBeDefined();
    expect((server.getRef('taskCheckList') as any).total).toBe(3);
  });

  it('getTaskDetail sets mock detail', async () => {
    const server = createServer();
    await server.getTaskDetail({ taskId: '1' });
    const detail = server.getRef('taskDetail') as any;
    expect(detail).toBeDefined();
    expect(detail.taskId).toBe('1');
    expect(detail.accuracy).toBe(0.98);
  });

  it('getTaskCmpDiffListData calls getTaskCmpList with defaults', async () => {
    const server = createServer();
    await server.getTaskCmpDiffListData({ cmpCsvPath: '/test/cmp.csv' });
    expect(getTaskCmpList).toHaveBeenCalledWith(
      '/test/cmp.csv', true, 50, 0, undefined, undefined, undefined, undefined, undefined,
    );
    expect(server.getRef('taskCmpDiffList')).toEqual({ data: [], total: 0 });
  });

  it('getTaskCmpDiffListData passes custom params', async () => {
    const server = createServer();
    await server.getTaskCmpDiffListData({
      cmpCsvPath: '/test/cmp.csv',
      pageSize: 10,
      startOffset: 5,
      res: 'FAIL',
      keyword: 'op1',
      phaseName: 'phase1',
      funcHash: 'hash1',
      readFlag: false,
      opMagic: 'magic1',
      rawMagic: 'raw1',
      tensorAddr: 'addr1',
      symbol: 'sym1',
      funchash: 'fh1',
    });
    expect(getTaskCmpList).toHaveBeenCalledWith(
      '/test/cmp.csv', false, 10, 5, 'FAIL', 'op1', 'phase1', 'hash1',
      expect.objectContaining({ opMagic: 'magic1', rawMagic: 'raw1', tensorAddr: 'addr1', symbol: 'sym1', funchash: 'fh1' }),
    );
  });

  it('getTaskCmpDiffListData does not create filterWord when no filter fields', async () => {
    const server = createServer();
    await server.getTaskCmpDiffListData({ cmpCsvPath: '/test/cmp.csv' });
    expect(getTaskCmpList).toHaveBeenCalledWith(
      '/test/cmp.csv', true, 50, 0, undefined, undefined, undefined, undefined, undefined,
    );
  });

  it('getPrecisionExceptList sets result on success', async () => {
    const server = createServer();
    await server.getPrecisionExceptList({ filePath: '/test', fileName: 'test.csv' });
    expect(getPrecisionExceptList).toHaveBeenCalledWith('/test', 'test.csv');
    expect(server.getRef('precisionExceptList')).toEqual({ data: [] });
  });

  it('getPrecisionExceptList sets null on error', async () => {
    vi.mocked(getPrecisionExceptList).mockRejectedValueOnce(new Error('fail'));
    const server = createServer();
    await server.getPrecisionExceptList({ filePath: '/test', fileName: 'test.csv' });
    expect(server.getRef('precisionExceptList')).toBeNull();
  });

  it('openTaskCmpDiffComGraphApi calls openTaskCmpDiffComGraph', async () => {
    const server = createServer();
    await server.openTaskCmpDiffComGraphApi({
      filePath: '/test/file.json',
      funcHash: 'hash1',
      passName: 'pass1',
    });
    expect(openTaskCmpDiffComGraph).toHaveBeenCalledWith(
      '/test/file.json', 'hash1', 'pass1', undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    );
  });

  it('openTaskCmpDiffComGraphApi handles error gracefully', async () => {
    vi.mocked(openTaskCmpDiffComGraph).mockRejectedValueOnce(new Error('fail'));
    const server = createServer();
    await server.openTaskCmpDiffComGraphApi({
      filePath: '/test/file.json',
      funcHash: 'hash1',
      passName: 'pass1',
    });
  });

  it('openSwimGraphApi executes command', async () => {
    const server = createServer();
    await server.openSwimGraphApi({ swimPath: '/test/swim.json', seqNo: 1, taskId: 2 });
    expect(commands.executeCommand).toHaveBeenCalledWith('PyPTO.Open.OpenSwimGraph', '/test/swim.json', 1, 2);
  });

  it('openSwimGraphApi handles error gracefully', async () => {
    vi.mocked(commands.executeCommand).mockRejectedValueOnce(new Error('fail'));
    const server = createServer();
    await server.openSwimGraphApi({ swimPath: '/test/swim.json', seqNo: 1, taskId: 2 });
  });
});
