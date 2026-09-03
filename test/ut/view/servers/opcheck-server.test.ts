/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../../src/common/accurancyAnylasis'), () => ({
  getCmpDiffList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getPrecisionExceptList: vi.fn().mockResolvedValue({ data: [] }),
  setCurAccuFilePath: vi.fn().mockResolvedValue(undefined),
  openCmpDiffComGraph: vi.fn().mockResolvedValue(undefined),
  getCmpErrorList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getAccuFilePath: vi.fn().mockResolvedValue({ filePath: '/test/accu.csv' }),
  getTaskCmpList: vi.fn().mockResolvedValue({ data: [], total: 0 }),
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

import { OpCheckViewServer } from '../../../../src/view/servers/opcheck-server';
import { getCmpDiffList, getPrecisionExceptList, setCurAccuFilePath, openCmpDiffComGraph, getCmpErrorList, getAccuFilePath, getTaskCmpList } from '../../../../src/common/accurancyAnylasis';

function createMockCtx() {
  return {
    viewType: 'opCheck',
    fileUri: { fsPath: '/test/opcheck.csv' },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
}

function createServer() {
  const ctx = createMockCtx();
  const server = new OpCheckViewServer(ctx as any);
  server.created(ctx as any);
  return server;
}

describe('OpCheckViewServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can be instantiated', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('getCmpDiffListData calls getCmpDiffList with defaults', async () => {
    const server = createServer();
    await server.getCmpDiffListData({ cmpCsvPath: '/test/cmp.csv' });
    expect(getCmpDiffList).toHaveBeenCalledWith('/test/cmp.csv', true, 50, 0, undefined, undefined);
    expect(server.getRef('cmpDiffList')).toEqual({ data: [], total: 0 });
  });

  it('getCmpDiffListData passes custom params', async () => {
    const server = createServer();
    await server.getCmpDiffListData({
      cmpCsvPath: '/test/cmp.csv',
      pageSize: 10,
      startOffset: 5,
      res: 'FAIL',
      keyword: 'op1',
      readFlag: false,
    });
    expect(getCmpDiffList).toHaveBeenCalledWith('/test/cmp.csv', false, 10, 5, 'FAIL', 'op1');
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

  it('setCurAccuFilePathApi calls setCurAccuFilePath', async () => {
    const server = createServer();
    await server.setCurAccuFilePathApi({ filePath: '/test/file.csv', fileType: 'csv' });
    expect(setCurAccuFilePath).toHaveBeenCalledWith({ filePath: '/test/file.csv', fileType: 'csv' });
  });

  it('setCurAccuFilePathApi handles error gracefully', async () => {
    vi.mocked(setCurAccuFilePath).mockRejectedValueOnce(new Error('fail'));
    const server = createServer();
    await server.setCurAccuFilePathApi({ filePath: '/test/file.csv', fileType: 'csv' });
  });

  it('openCmpDiffComGraphApi calls openCmpDiffComGraph', async () => {
    const server = createServer();
    await server.openCmpDiffComGraphApi({
      filePath: '/test/file.json',
      funcHash: 'hash1',
      passName: 'pass1',
      funcMagicName: 'magic1',
    });
    expect(openCmpDiffComGraph).toHaveBeenCalledWith(
      '/test/file.json', 'hash1', 'pass1', 'magic1', undefined, undefined, '/test/file.json', undefined, undefined, undefined,
    );
  });

  it('openCmpDiffComGraphApi handles error gracefully', async () => {
    vi.mocked(openCmpDiffComGraph).mockRejectedValueOnce(new Error('fail'));
    const server = createServer();
    await server.openCmpDiffComGraphApi({
      filePath: '/test/file.json',
      funcHash: 'hash1',
      passName: 'pass1',
      funcMagicName: 'magic1',
    });
  });

  it('getCmpErrorListData calls getCmpErrorList', async () => {
    const server = createServer();
    await server.getCmpErrorListData({});
    expect(getAccuFilePath).toHaveBeenCalled();
    expect(getCmpErrorList).toHaveBeenCalled();
    expect(server.getRef('cmpErrorList')).toEqual({ data: [], total: 0 });
  });

  it('getCmpErrorListData passes custom params', async () => {
    const server = createServer();
    await server.getCmpErrorListData({
      pageSize: 10,
      startOffset: 5,
      res: 'FAIL',
      keyword: 'op1',
      readFlag: false,
      comgraphPath: '/test/com.json',
    });
    expect(getCmpErrorList).toHaveBeenCalledWith('/test/accu.csv', '/test/com.json', false, 10, 5, 'op1');
  });

  it('getTaskCmpDiffListData calls getTaskCmpList', async () => {
    const server = createServer();
    await server.getTaskCmpDiffListData({ cmpCsvPath: '/test/cmp.csv' });
    expect(getTaskCmpList).toHaveBeenCalledWith('/test/cmp.csv', true, 50, 0, undefined, undefined, undefined, undefined, undefined, undefined);
    expect(server.getRef('taskCmpDiffList')).toEqual({ data: [], total: 0 });
  });

  it('getTaskCmpDiffListData passes filterWord', async () => {
    const server = createServer();
    await server.getTaskCmpDiffListData({
      cmpCsvPath: '/test/cmp.csv',
      filterWord: { rawMagic: 'raw1', opMagic: 'op1', tensorAddr: 'addr1' },
      rootFuncHash: 'hash1',
    });
    expect(getTaskCmpList).toHaveBeenCalledWith(
      '/test/cmp.csv', true, 50, 0, undefined, undefined, undefined, undefined,
      { rawMagic: 'raw1', opMagic: 'op1', tensorAddr: 'addr1' },
      'hash1',
    );
  });

  it('getTaskCmpErrorListData calls getTaskCmpList with FAIL', async () => {
    const server = createServer();
    await server.getTaskCmpErrorListData({});
    expect(getAccuFilePath).toHaveBeenCalled();
    expect(getTaskCmpList).toHaveBeenCalledWith('/test/accu.csv', true, 50, 0, 'FAIL', undefined, undefined, undefined, undefined);
    expect(server.getRef('taskCmpErrorList')).toEqual({ data: [], total: 0 });
  });

  it('getTaskCmpErrorListData passes custom params', async () => {
    const server = createServer();
    await server.getTaskCmpErrorListData({
      pageSize: 10,
      startOffset: 5,
      keyword: 'op1',
      readFlag: false,
      filterWord: { rawMagic: 'raw1', opMagic: 'op1', tensorAddr: 'addr1' },
    });
    expect(getTaskCmpList).toHaveBeenCalledWith(
      '/test/accu.csv', false, 10, 5, 'FAIL', 'op1', undefined, undefined,
      { rawMagic: 'raw1', opMagic: 'op1', tensorAddr: 'addr1' },
    );
  });
});
