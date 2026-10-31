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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import * as os from 'node:os';

const { mockExtensionContext, mockExec, mockSpawn, mockFs } = vi.hoisted(() => {
  const mockExtensionContext = {
    extensionPath: '/test/extension',
  };

  const mockExec = vi.fn();
  const mockSpawn = vi.fn();

  const mockFs = {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
      copyFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };

  return { mockExtensionContext, mockExec, mockSpawn, mockFs };
});

vi.mock('../../../../src/extension', () => ({
  extensionContext: mockExtensionContext,
}));

vi.mock('child_process', () => ({
  exec: (...args: any[]) => mockExec(...args),
  spawn: (...args: any[]) => mockSpawn(...args),
}));

vi.mock('fs', () => mockFs);

import { getPythonOutputChannel, executePythonFile, getExtensionMode, runPythonScript } from '../../../../src/services/welcome/run-python';

describe('welcome/run-python', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPythonOutputChannel', () => {
    it('should create and return an output channel', () => {
      const channel = getPythonOutputChannel();
      expect(channel).toBeDefined();
      expect(vscode.window.createOutputChannel).toHaveBeenCalled();
    });
  });

  describe('executePythonFile', () => {
    it('should return success result when execution succeeds', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, 'output', '');
      });

      const result = await executePythonFile('/test/file.py', '/test');
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('output');
    });

    it('should return failure result when execution fails', async () => {
      const error = new Error('exec error') as any;
      mockExec.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(error, '', 'error output');
      });

      const result = await executePythonFile('/test/file.py', '/test');
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('error output');
    });
  });

  describe('getExtensionMode', () => {
    it('should return development when extension isDevelopment is true', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        isDevelopment: true,
      } as any);

      expect(getExtensionMode()).toBe('development');
    });

    it('should return production when extension isDevelopment is false', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        isDevelopment: false,
      } as any);

      expect(getExtensionMode()).toBe('production');
    });

    it('should return production as fallback', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      mockFs.existsSync.mockReturnValue(false);
      mockExtensionContext.extensionPath = '/test/extension';

      expect(getExtensionMode()).toBe('production');
    });

    it('should detect development mode from .vscode directory', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      mockFs.existsSync.mockReturnValue(true);
      mockExtensionContext.extensionPath = '/test/extension';

      expect(getExtensionMode()).toBe('development');
    });

    it('should detect production mode from extensions install path', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      mockFs.existsSync.mockReturnValue(false);
      mockExtensionContext.extensionPath = '/home/user/.vscode/extensions/pypto-1.0.0';

      expect(getExtensionMode()).toBe('production');
    });
  });

  describe('runPythonScript', () => {
    let mockChannel: any;

    beforeEach(() => {
      mockChannel = {
        appendLine: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
      } as any;
      mockFs.existsSync.mockReturnValue(false);
      mockFs.promises.copyFile.mockResolvedValue(undefined);
      mockFs.promises.mkdir.mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.mocked(vscode.workspace).workspaceFolders = undefined;
      vi.useRealTimers();
    });

    function makeFakeChild() {
      const child = new EventEmitter() as any;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      return child;
    }

    function mockExecBranchByCommand(pipShowError: Error | null, runError: Error | null, stdout = 'ok') {
      mockExec.mockImplementation((cmd: string, optsOrCb: any, cb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
        if (cmd.includes('pip show')) {
          callback(pipShowError, '', '');
        } else {
          callback(runError, stdout, '');
        }
      });
    }

    function getPythonRunCalls() {
      return mockExec.mock.calls.filter(([command]) => !String(command).includes('pip show'));
    }

    it('runs the workspace copy with the demo directory as cwd', async () => {
      mockExecBranchByCommand(null, null);
      const workspaceRoot = path.join(path.sep, 'workspace with spaces');
      vi.mocked(vscode.workspace).workspaceFolders = [{ uri: { fsPath: workspaceRoot } }] as any;

      const result = await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      const copiedPath = path.join(workspaceRoot, '.pypto', 'welcome', 'hello_world.py');
      expect(result).toBe(true);
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(path.dirname(copiedPath), { recursive: true });
      expect(mockFs.promises.copyFile).toHaveBeenCalledWith('/test/file.py', copiedPath);
      expect(getPythonRunCalls()).toHaveLength(1);
      const [command, options] = getPythonRunCalls()[0];
      expect(command).toContain(`"${copiedPath}"`);
      expect(options.cwd).toBe(path.dirname(copiedPath));
    });

    it('falls back to the plugin file when no workspace is opened', async () => {
      mockExecBranchByCommand(null, null);
      vi.mocked(vscode.workspace).workspaceFolders = undefined;

      const result = await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      expect(result).toBe(true);
      expect(mockFs.promises.copyFile).not.toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(getPythonRunCalls()).toHaveLength(1);
      const [command, options] = getPythonRunCalls()[0];
      expect(command).toContain('"/test/file.py"');
      expect(options.cwd).toBe(os.tmpdir());
    });

    it('should run python script and log output', async () => {
      mockExec.mockImplementation((cmd: string, optsOrCb: any, cb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
        if (callback) callback(null, 'ok', '');
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.copyFile.mockResolvedValue(undefined);

      await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');
      expect(mockChannel.appendLine).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, optsOrCb: any, cb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
        if (callback) callback(new Error('fail'), '', 'error');
      });

      await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');
      expect(mockChannel.appendLine).toHaveBeenCalled();
    });

    it('streams install logs and succeeds when exit code is zero', async () => {
      mockExecBranchByCommand(new Error('not installed'), null);
      let fakeChild: any;
      mockSpawn.mockImplementation(() => {
        fakeChild = makeFakeChild();
        Promise.resolve().then(() => {
          fakeChild.stdout.emit('data', Buffer.from('Collecting numpy\n'));
          fakeChild.stderr.emit('data', Buffer.from('WARNING: using legacy resolver'));
          fakeChild.emit('exit', 0);
        });
        return fakeChild;
      });

      await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      expect(mockSpawn).toHaveBeenCalled();
      const logged = mockChannel.appendLine.mock.calls.map((args: any[]) => args[0]).join('\n');
      expect(logged).toContain('[PyPTOToolkit.welcome.runPython.Installation.log] Collecting numpy');
      expect(logged).toContain('PyPTOToolkit.welcome.runPython.Installation.warning');
      expect(logged).toContain('install numpy, torch success');
    });

    it('marks install failed when stderr contains error', async () => {
      mockExecBranchByCommand(new Error('not installed'), null);
      let fakeChild: any;
      mockSpawn.mockImplementation(() => {
        fakeChild = makeFakeChild();
        Promise.resolve().then(() => {
          fakeChild.stderr.emit('data', Buffer.from('ERROR: could not find a version'));
          fakeChild.emit('exit', 0);
        });
        return fakeChild;
      });

      await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      const logged = mockChannel.appendLine.mock.calls.map((args: any[]) => args[0]).join('\n');
      expect(logged).toContain('[PyPTOToolkit.welcome.runPython.Installation.error] ERROR: could not find a version');
      expect(logged).toContain('install err(0)');
    });

    it('marks install failed on non-zero exit code', async () => {
      mockExecBranchByCommand(new Error('not installed'), null);
      let fakeChild: any;
      mockSpawn.mockImplementation(() => {
        fakeChild = makeFakeChild();
        Promise.resolve().then(() => fakeChild.emit('exit', 1));
        return fakeChild;
      });

      await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      const logged = mockChannel.appendLine.mock.calls.map((args: any[]) => args[0]).join('\n');
      expect(logged).toContain('install err(1)');
    });

    it('kills the install process on timeout', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      mockExecBranchByCommand(new Error('not installed'), null);
      let fakeChild: any;
      mockSpawn.mockImplementation(() => {
        fakeChild = makeFakeChild();
        return fakeChild;
      });

      const runPromise = runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');
      await vi.advanceTimersByTimeAsync(120001);
      await runPromise;

      expect(fakeChild.kill).toHaveBeenCalled();
      const logged = mockChannel.appendLine.mock.calls.map((args: any[]) => args[0]).join('\n');
      expect(logged).toContain('PyPTOToolkit.welcome.runPython.install.timeOut');
    });

    it('reports install failure when the process fails to spawn', async () => {
      mockExecBranchByCommand(new Error('not installed'), null);
      let fakeChild: any;
      mockSpawn.mockImplementation(() => {
        fakeChild = makeFakeChild();
        Promise.resolve().then(() => fakeChild.emit('error', new Error('spawn python ENOENT')));
        return fakeChild;
      });

      await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      const logged = mockChannel.appendLine.mock.calls.map((args: any[]) => args[0]).join('\n');
      expect(logged).toContain('PyPTOToolkit.welcome.runPython.Installation.variables');
    });

    it('copies python file into demo directory with incrementing names', async () => {
      mockExecBranchByCommand(null, null);
      vi.mocked(vscode.workspace).workspaceFolders = [{ uri: { fsPath: '/ws' } }] as any;
      mockFs.existsSync.mockImplementation((p: any) => String(p).endsWith('hello_world.py'));

      const result = await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      const incrementalPath = path.join('/ws', '.pypto', 'welcome', 'hello_world(1).py');
      expect(mockFs.promises.copyFile).toHaveBeenCalledWith('/test/file.py', incrementalPath);
      expect(result).toBe(true);
      const [command, options] = getPythonRunCalls()[0];
      expect(command).toContain(`"${incrementalPath}"`);
      expect(options.cwd).toBe(path.dirname(incrementalPath));
      const logged = mockChannel.appendLine.mock.calls.map((args: any[]) => args[0]).join('\n');
      expect(logged).toContain('/ws');
    });

    it('falls back to the plugin file in multi-root workspaces', async () => {
      mockExecBranchByCommand(null, null);
      vi.mocked(vscode.workspace).workspaceFolders = [
        { uri: { fsPath: '/ws1' } },
        { uri: { fsPath: '/ws2' } },
      ] as any;

      const result = await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      expect(result).toBe(true);
      expect(mockFs.promises.copyFile).not.toHaveBeenCalled();
      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(getPythonRunCalls()).toHaveLength(1);
      expect(getPythonRunCalls()[0][0]).toContain('"/test/file.py"');
    });

    it('shows error message and falls back when copying fails', async () => {
      mockExecBranchByCommand(null, null);
      vi.mocked(vscode.workspace).workspaceFolders = [{ uri: { fsPath: '/ws' } }] as any;
      mockFs.promises.copyFile.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      expect(result).toBe(true);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('EACCES'));
      expect(getPythonRunCalls()).toHaveLength(1);
      expect(getPythonRunCalls()[0][0]).toContain('"/test/file.py"');
    });

    it('shows error message and falls back when creating demo directory fails', async () => {
      mockExecBranchByCommand(null, null);
      vi.mocked(vscode.workspace).workspaceFolders = [{ uri: { fsPath: '/ws' } }] as any;
      mockFs.promises.mkdir.mockRejectedValue(new Error('EPERM: operation not permitted'));

      const result = await runPythonScript(mockChannel, '/test/file.py', 'https://pypi.org/simple');

      expect(result).toBe(true);
      expect(mockFs.promises.copyFile).not.toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('EPERM'));
      expect(getPythonRunCalls()).toHaveLength(1);
    });
  });
});
