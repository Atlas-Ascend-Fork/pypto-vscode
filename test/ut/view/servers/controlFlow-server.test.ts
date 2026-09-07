/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPlatform = vi.fn();
const mockExec = vi.fn();

vi.mock('os', () => ({
  platform: (...args: unknown[]) => mockPlatform(...args),
  default: { platform: (...args: unknown[]) => mockPlatform(...args) },
}));

vi.mock('child_process', () => ({
  exec: (...args: unknown[]) => mockExec(...args),
}));

vi.mock(import('../../../../src/common/accurancyAnylasis'), () => ({
  getResDataSum: vi.fn(),
  getPassInfoOfSinglePath: vi.fn(),
  setCurAccuFilePath: vi.fn(),
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
  return {
    ViewServer: MockViewServer,
    viewApi: () => () => {},
    viewRefs: () => () => {},
  };
});

import { workspace, window } from 'vscode';
import { ControlFlowViewServer } from '../../../../src/view/servers/controlFlow-server';
import { getResDataSum, getPassInfoOfSinglePath, setCurAccuFilePath } from '../../../../src/common/accurancyAnylasis';

function createServer() {
  const ctx = {
    viewType: 'controlFlow',
    fileUri: { fsPath: '/test/flow.json', query: undefined },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
  const server = new ControlFlowViewServer(ctx as any);
  server.created(ctx as any);
  return server;
}

let savedEnv: NodeJS.ProcessEnv;

describe('ControlFlowViewServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue('linux');
    mockExec.mockImplementation((cmd: string, _opts: unknown, cb: (error: Error | null, stdout?: string, stderr?: string) => void) => {
      if (typeof cb !== 'function') {
        return;
      }
      cb(null, '', '');
    });
    savedEnv = { ...process.env };
    (workspace as { workspaceFolders?: unknown }).workspaceFolders = undefined;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('can be instantiated', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('getAccurancyResult delegates to getResDataSum and sets ref', async () => {
    const res = { summary: 'ok' };
    vi.mocked(getResDataSum).mockResolvedValue(res as never);
    const server = createServer();

    await server.getAccurancyResult({
      controwFlowFilePath: '/test/flow.json',
      computeGraphDirPath: '/test/graph',
      flowVerifyPath: '/test/verify',
    });

    expect(getResDataSum).toHaveBeenCalledWith('/test/flow.json', '/test/verify', '/test/graph');
    expect(server.getRef('accurancyResult')).toBe(res);
  });

  it('getPathPassResult delegates to getPassInfoOfSinglePath and sets ref', async () => {
    const res = { passes: [1, 2] };
    vi.mocked(getPassInfoOfSinglePath).mockResolvedValue(res as never);
    const server = createServer();

    await server.getPathPassResult({ controwFlowFilePath: '/test/flow.json', funcMagicName: 'magic1' });

    expect(getPassInfoOfSinglePath).toHaveBeenCalledWith('/test/flow.json', 'magic1');
    expect(server.getRef('pathPassResult')).toBe(res);
  });

  it('setCurAccuFilePathApi delegates to setCurAccuFilePath', async () => {
    vi.mocked(setCurAccuFilePath).mockResolvedValue(undefined as never);
    const server = createServer();

    await server.setCurAccuFilePathApi({ filePath: '/test/accu.csv', fileType: 'csv' });

    expect(setCurAccuFilePath).toHaveBeenCalledWith({ filePath: '/test/accu.csv', fileType: 'csv' });
  });

  it('setCurAccuFilePathApi swallows errors from setCurAccuFilePath', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(setCurAccuFilePath).mockRejectedValue(new Error('boom') as never);
    const server = createServer();

    await server.setCurAccuFilePathApi({ filePath: '/test/accu.csv', fileType: 'csv' });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  describe('executeRemoteCommand', () => {
    it('rejects on non-linux platform', async () => {
      mockPlatform.mockReturnValue('win32');
      const server = createServer();

      const result = await server.executeRemoteCommand();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(-1);
      expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.linuxOnly');
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('rejects when remote_tool.sh is unavailable', async () => {
      mockExec.mockImplementation((cmd: string, _opts: unknown, cb: (error: Error | null) => void) => {
        if (cmd.startsWith('remote_tool.sh -h')) {
          cb(new Error('not found'));
        }
      });
      const server = createServer();

      const result = await server.executeRemoteCommand();

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('pypto.remoteTool.notTargetEnv');
      expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.notTargetEnv');
    });

    it('rejects when workspace folder is missing', async () => {
      const server = createServer();

      const result = await server.executeRemoteCommand();

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Environment variables missing: workspace folder');
      expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.envVarMissing');
    });

    it('rejects when user home env vars are missing', async () => {
      (workspace as { workspaceFolders?: unknown }).workspaceFolders = [{ uri: { fsPath: '/test/ws' } }];
      delete process.env.PYPTO_HOME;
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      const server = createServer();

      const result = await server.executeRemoteCommand();

      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Environment variables missing: PYPTO_HOME/HOME/USERPROFILE');
      expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.envVarMissing');
    });

    it('executes command and reports success', async () => {
      (workspace as { workspaceFolders?: unknown }).workspaceFolders = [{ uri: { fsPath: '/test/ws' } }];
      process.env.PYPTO_HOME = '/home/tester';
      mockExec.mockImplementation((cmd: string, _opts: unknown, cb: (error: null, stdout: string, stderr: string) => void) => {
        cb(null, 'done ', ' ');
      });
      const server = createServer();

      const result = await server.executeRemoteCommand();

      expect(result).toEqual({ success: true, stdout: 'done', stderr: '', exitCode: 0 });
      expect(window.showInformationMessage).toHaveBeenCalledWith('pypto.remoteTool.execSuccess');
    });

    it('reports failure with exit code when exec errors', async () => {
      (workspace as { workspaceFolders?: unknown }).workspaceFolders = [{ uri: { fsPath: '/test/ws' } }];
      process.env.PYPTO_HOME = '/home/tester';
      mockExec.mockImplementation((cmd: string, _opts: unknown, cb: (error: unknown, stdout: string, stderr: string) => void) => {
        if (cmd.startsWith('remote_tool.sh -h')) {
          cb(null, '', '');
        } else {
          cb({ code: 2 }, '', 'server error ');
        }
      });
      const server = createServer();

      const result = await server.executeRemoteCommand();

      expect(result).toEqual({ success: false, stdout: '', stderr: 'server error', exitCode: 2 });
      expect(window.showErrorMessage).toHaveBeenCalledWith('pypto.remoteTool.execFailed');
    });

    it('defaults exit code to 1 when error has no code', async () => {
      (workspace as { workspaceFolders?: unknown }).workspaceFolders = [{ uri: { fsPath: '/test/ws' } }];
      process.env.PYPTO_HOME = '/home/tester';
      mockExec.mockImplementation((cmd: string, _opts: unknown, cb: (error: unknown, stdout: string, stderr: string) => void) => {
        if (cmd.startsWith('remote_tool.sh -h')) {
          cb(null, '', '');
        } else {
          cb(new Error('killed'), '', '');
        }
      });
      const server = createServer();

      const result = await server.executeRemoteCommand();

      expect(result.exitCode).toBe(1);
    });
  });
});
