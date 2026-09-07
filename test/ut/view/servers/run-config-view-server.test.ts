/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../../src/services/schema-config'), () => ({
  getConfigsTemplate: vi.fn(),
  getConfigsForRevise: vi.fn(),
  updateConfigsFile: vi.fn(),
}));

vi.mock(import('../../../../src/core/view/view-server'), () => {
  class MockViewServer {
    static _viewConfig: any = { apis: ['closeWebview'], refs: [] };
    _refMap = new Map<string, unknown>();
    _disposables: any[] = [];
    closeWebview = vi.fn();
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
    dispose() {}
  }
  return { ViewServer: MockViewServer, viewApi: () => () => {}, viewRefs: () => () => {} };
});

import { window, commands } from 'vscode';
import { RunConfigViewServer } from '../../../../src/view/servers/run-config-view-server';
import { getConfigsTemplate, getConfigsForRevise, updateConfigsFile } from '../../../../src/services/schema-config';

function createCtx() {
  return {
    viewType: 'editRunConfig',
    fileUri: { fsPath: '/test/config.yaml', path: '/test/config.yaml' },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
}

function createServer() {
  const ctx = createCtx();
  const server = new RunConfigViewServer(ctx as any);
  server.created(ctx as any);
  return server;
}

describe('RunConfigViewServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfigsTemplate).mockResolvedValue({ fields: [] } as never);
    vi.mocked(getConfigsForRevise).mockResolvedValue({ key: 'value' } as never);
    vi.mocked(updateConfigsFile).mockResolvedValue(true as never);
  });

  it('can be instantiated', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('created sets filename and filepath refs', () => {
    const server = createServer();

    expect(server.getRef('filename')).toBe('config.yaml');
    expect(server.getRef('filepath')).toBe('/test/config.yaml');
  });

  it('getSchema returns schema after template request resolves', async () => {
    const schema = { fields: [{ name: 'pass' }] };
    vi.mocked(getConfigsTemplate).mockResolvedValue(schema as never);
    const server = createServer();

    const result = await server.getSchema();

    expect(result).toBe(schema);
  });

  it('getSchema returns null when template is null', async () => {
    vi.mocked(getConfigsTemplate).mockResolvedValue(null as never);
    const server = createServer();

    const result = await server.getSchema();

    expect(result).toBeNull();
  });

  it('getConfigData returns revise data when schema exists', async () => {
    const server = createServer();

    const result = await server.getConfigData();

    expect(getConfigsForRevise).toHaveBeenCalledWith('/test/config.yaml', { fields: [] });
    expect(result).toEqual({ key: 'value' });
  });

  it('getConfigData returns empty object when schema is null', async () => {
    vi.mocked(getConfigsTemplate).mockResolvedValue(null as never);
    const server = createServer();

    const result = await server.getConfigData();

    expect(result).toEqual({});
    expect(getConfigsForRevise).not.toHaveBeenCalled();
  });

  it('saveConfigData returns false when schema is null', async () => {
    vi.mocked(getConfigsTemplate).mockResolvedValue(null as never);
    const server = createServer();

    const result = await server.saveConfigData({ key: 'value' });

    expect(result).toBe(false);
    expect(updateConfigsFile).not.toHaveBeenCalled();
  });

  it('saveConfigData shows success toast and returns true', async () => {
    const server = createServer();
    await server.getSchema();

    const result = await server.saveConfigData({ key: 'value' });

    expect(updateConfigsFile).toHaveBeenCalledWith('/test/config.yaml', { key: 'value' }, { fields: [] });
    expect(result).toBe(true);
    expect(window.showInformationMessage).toHaveBeenCalledWith('PyPTOToolkit.public.savingSuccess');
  });

  it('saveConfigData returns false without toast when save fails', async () => {
    vi.mocked(updateConfigsFile).mockResolvedValue(false as never);
    const server = createServer();
    await server.getSchema();

    const result = await server.saveConfigData({ key: 'value' });

    expect(result).toBe(false);
    expect(window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('cancelEdit closes webview when user confirms', async () => {
    vi.mocked(window.showInformationMessage).mockImplementation((...args: unknown[]) => args[2] as never);
    const server = createServer();

    await server.cancelEdit();

    expect(server.closeWebview).toHaveBeenCalled();
  });

  it('cancelEdit keeps webview when user cancels', async () => {
    vi.mocked(window.showInformationMessage).mockResolvedValue(undefined as never);
    const server = createServer();

    await server.cancelEdit();

    expect(server.closeWebview).not.toHaveBeenCalled();
  });

  it('openSourceFile opens the file via vscode.open command', () => {
    const server = createServer();

    server.openSourceFile();

    expect(commands.executeCommand).toHaveBeenCalledTimes(1);
    const [cmd, uri] = vi.mocked(commands.executeCommand).mock.calls[0];
    expect(cmd).toBe('vscode.open');
    expect(uri.fsPath).toBe('/test/config.yaml');
  });
});
