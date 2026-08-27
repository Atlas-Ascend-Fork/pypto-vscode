import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

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

      expect(getExtensionMode()).toBe('production');
    });

    it('should detect development mode from .vscode directory', () => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);
      mockFs.existsSync.mockReturnValue(true);

      expect(getExtensionMode()).toBe('development');
    });
  });

  describe('runPythonScript', () => {
    it('should run python script and log output', async () => {
      mockExec.mockImplementation((cmd: string, optsOrCb: any, cb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
        if (callback) callback(null, 'ok', '');
      });

      const mockChannel = {
        appendLine: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
      } as any;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.copyFile.mockResolvedValue(undefined);

      await runPythonScript(mockChannel, '/test/file.py', '/test', 'https://pypi.org/simple');
      expect(mockChannel.appendLine).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, optsOrCb: any, cb?: any) => {
        const callback = typeof optsOrCb === 'function' ? optsOrCb : cb;
        if (callback) callback(new Error('fail'), '', 'error');
      });

      const mockChannel = {
        appendLine: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
      } as any;

      await runPythonScript(mockChannel, '/test/file.py', '/test', 'https://pypi.org/simple');
      expect(mockChannel.appendLine).toHaveBeenCalled();
    });
  });
});
