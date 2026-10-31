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
import * as vscode from 'vscode';
import * as path from 'node:path';

const { mockExtensionContext, mockSampleManager, mockGetExtensionMode, mockGetPythonOutputChannel, mockRunPythonScript, mockReadWholeFileByTextDocument, mockWelcomeViewServer } = vi.hoisted(() => {
  const mockExtensionContext = {
    extensionPath: '/test/extension',
    extension: { packageJSON: { version: '1.0.0' } },
  };

  const mockSampleManager = {
    getSamplePath: vi.fn().mockReturnValue('/test/sample'),
  };

  const mockGetExtensionMode = vi.fn().mockReturnValue('development');
  const mockGetPythonOutputChannel = vi.fn().mockReturnValue({
    clear: vi.fn(),
    show: vi.fn(),
    appendLine: vi.fn(),
  });
  const mockRunPythonScript = vi.fn();
  const mockReadWholeFileByTextDocument = vi.fn().mockResolvedValue('print("hello")');

  const mockWelcomeViewServer = {
    completeResultsStep: vi.fn(),
    reductionResultsStep: vi.fn(),
    completeTreeColumnStep: vi.fn(),
    reductionTreeColumnStep: vi.fn(),
  };

  return { mockExtensionContext, mockSampleManager, mockGetExtensionMode, mockGetPythonOutputChannel, mockRunPythonScript, mockReadWholeFileByTextDocument, mockWelcomeViewServer };
});

vi.mock('../../../../src/extension', () => ({
  extensionContext: mockExtensionContext,
  sampleManager: mockSampleManager,
}));

vi.mock('../../../../src/services/welcome/run-python', () => ({
  getExtensionMode: (...args: any[]) => mockGetExtensionMode(...args),
  getPythonOutputChannel: (...args: any[]) => mockGetPythonOutputChannel(...args),
  runPythonScript: (...args: any[]) => mockRunPythonScript(...args),
}));

vi.mock('../../../../src/services/welcome/getPythonCode', () => ({
  readWholeFileByTextDocument: (...args: any[]) => mockReadWholeFileByTextDocument(...args),
}));

vi.mock('../../../../src/view/servers/welcom-server', () => ({
  WelcomeViewServer: mockWelcomeViewServer,
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

import {
  getInitPythonProject,
  isLinuxEnvironment,
  getMockDataPath,
  getUserRunRoot,
  getProgramPath,
  getSwimPath,
  getPluginVersion,
  getPythonFileCode,
  getThreeColumnSamplePath,
  completeResultsStep,
  reductionResultsStep,
  completeTreeColumnStep,
  reductionTreeColumnStep,
} from '../../../../src/services/welcome';

describe('welcome/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInitPythonProject', () => {
    it('should run python script in development mode', async () => {
      mockGetExtensionMode.mockReturnValue('development');
      mockRunPythonScript.mockResolvedValue(true);

      await getInitPythonProject();
      expect(mockRunPythonScript).toHaveBeenCalledWith(
        expect.any(Object),
        path.join('/test/extension', 'src', 'python-file', 'test_hello_world.py'),
        'https://pypi.tuna.tsinghua.edu.cn/simple',
      );
    });

    it('should run python script in production mode', async () => {
      mockGetExtensionMode.mockReturnValue('production');
      mockRunPythonScript.mockResolvedValue(true);

      await getInitPythonProject();
      expect(mockRunPythonScript).toHaveBeenCalledWith(
        expect.any(Object),
        path.join('/test/extension', 'webview-dist', 'python-file', 'test_hello_world.py'),
        'https://pypi.tuna.tsinghua.edu.cn/simple',
      );
    });

    it('should return early when extensionContext is null', async () => {
      const ext = await import('../../../../src/extension');
      const origCtx = ext.extensionContext;
      (ext as any).extensionContext = null;

      const result = await getInitPythonProject();
      expect(result).toBeUndefined();

      (ext as any).extensionContext = origCtx;
    });
  });

  describe('isLinuxEnvironment', () => {
    it('should return boolean', async () => {
      const result = await isLinuxEnvironment();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getMockDataPath', () => {
    it('should return development path in dev mode', () => {
      mockGetExtensionMode.mockReturnValue('development');
      const result = getMockDataPath();
      expect(result).toContain('src');
      expect(result).toContain('boot-mock-data');
    });

    it('should return production path in prod mode', () => {
      mockGetExtensionMode.mockReturnValue('production');
      const result = getMockDataPath();
      expect(result).toContain('webview-dist');
    });
  });

  describe('getUserRunRoot', () => {
    it('should return mock data path', async () => {
      mockGetExtensionMode.mockReturnValue('development');
      const result = await getUserRunRoot();
      expect(typeof result).toBe('string');
    });
  });

  describe('getProgramPath', () => {
    it('should return path to program.json', async () => {
      mockGetExtensionMode.mockReturnValue('development');
      const result = await getProgramPath();
      expect(result).toContain('program.json');
    });
  });

  describe('getSwimPath', () => {
    it('should return path to swimlane json', async () => {
      mockGetExtensionMode.mockReturnValue('development');
      const result = await getSwimPath();
      expect(result).toContain('merged_swimlane.json');
    });
  });

  describe('getPluginVersion', () => {
    it('should return plugin version', async () => {
      const result = await getPluginVersion();
      expect(result).toBe('1.0.0');
    });
  });

  describe('getPythonFileCode', () => {
    it('should return python file code', async () => {
      const result = await getPythonFileCode();
      expect(result).toBe('print("hello")');
    });
  });

  describe('getThreeColumnSamplePath', () => {
    it('should return sample path', async () => {
      const result = await getThreeColumnSamplePath();
      expect(result).toBe('/test/sample');
    });
  });

  describe('completeResultsStep', () => {
    it('should call WelcomeViewServer.completeResultsStep', async () => {
      await completeResultsStep();
      expect(mockWelcomeViewServer.completeResultsStep).toHaveBeenCalled();
    });
  });

  describe('reductionResultsStep', () => {
    it('should call WelcomeViewServer.reductionResultsStep', async () => {
      await reductionResultsStep();
      expect(mockWelcomeViewServer.reductionResultsStep).toHaveBeenCalled();
    });
  });

  describe('completeTreeColumnStep', () => {
    it('should call WelcomeViewServer.completeTreeColumnStep', async () => {
      await completeTreeColumnStep();
      expect(mockWelcomeViewServer.completeTreeColumnStep).toHaveBeenCalled();
    });
  });

  describe('reductionTreeColumnStep', () => {
    it('should call WelcomeViewServer.reductionTreeColumnStep', async () => {
      await reductionTreeColumnStep();
      expect(mockWelcomeViewServer.reductionTreeColumnStep).toHaveBeenCalled();
    });
  });
});
