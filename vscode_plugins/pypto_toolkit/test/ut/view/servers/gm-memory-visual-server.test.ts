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
import { GmMemoryVisualServer, readJsonText } from '../../../../src/view/servers/gm-memory-visual-server';

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
});
