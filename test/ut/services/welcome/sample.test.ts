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

const { mockExtensionContext, mockGetExtensionMode, mockFs } = vi.hoisted(() => {
  const mockExtensionContext = {
    extensionPath: '/test/extension',
    globalStorageUri: { fsPath: '/test/storage' },
  };

  const mockGetExtensionMode = vi.fn().mockReturnValue('development');

  const mockFs = {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    rmdirSync: vi.fn(),
  };

  return { mockExtensionContext, mockGetExtensionMode, mockFs };
});

vi.mock('../../../../src/extension', () => ({
  extensionContext: mockExtensionContext,
}));

vi.mock('../../../../src/services/welcome/run-python', () => ({
  getExtensionMode: (...args: any[]) => mockGetExtensionMode(...args),
}));

vi.mock('fs', () => mockFs);

import { SampleManager, SampleDataStatus } from '../../../../src/services/welcome/sample';

describe('welcome/sample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
  });

  describe('SampleDataStatus', () => {
    it('should have correct enum values', () => {
      expect(SampleDataStatus.Init).toBe('Init');
      expect(SampleDataStatus.Process).toBe('Process');
      expect(SampleDataStatus.Succ).toBe('Succ');
      expect(SampleDataStatus.Fail).toBe('Fail');
    });
  });

  describe('SampleManager', () => {
    it('should create instance in development mode', () => {
      mockGetExtensionMode.mockReturnValue('development');
      const manager = new SampleManager();
      expect(manager).toBeDefined();
    });

    it('should create instance in production mode', () => {
      mockGetExtensionMode.mockReturnValue('production');
      const manager = new SampleManager();
      expect(manager).toBeDefined();
    });

    it('should create storage directory if not exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      new SampleManager();
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    describe('getStatus', () => {
      it('should return Init when status file does not exist', () => {
        mockFs.existsSync.mockReturnValue(false);
        const manager = new SampleManager();
        expect(manager.getStatus()).toBe(SampleDataStatus.Init);
      });

      it('should return status from file', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('Succ');
        const manager = new SampleManager();
        expect(manager.getStatus()).toBe(SampleDataStatus.Succ);
      });

      it('should return Init on read error', () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockImplementation(() => { throw new Error('read error'); });
        const manager = new SampleManager();
        expect(manager.getStatus()).toBe(SampleDataStatus.Init);
      });
    });

    describe('updateStatus', () => {
      it('should write status to file', () => {
        const manager = new SampleManager();
        manager.updateStatus(SampleDataStatus.Process);
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });

      it('should create directory if not exists', () => {
        mockFs.existsSync.mockReturnValue(false);
        const manager = new SampleManager();
        manager.updateStatus(SampleDataStatus.Succ);
        expect(mockFs.mkdirSync).toHaveBeenCalled();
      });

      it('should handle write errors gracefully', () => {
        mockFs.writeFileSync.mockImplementation(() => { throw new Error('write error'); });
        const manager = new SampleManager();
        expect(() => manager.updateStatus(SampleDataStatus.Fail)).not.toThrow();
      });
    });

    describe('getSamplePath', () => {
      it('should return target data path', () => {
        const manager = new SampleManager();
        const path = manager.getSamplePath();
        expect(path).toContain('rundata_20251224101343');
      });
    });

    describe('prepare', () => {
      it('should copy data and update status', async () => {
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('{}');
        vi.mocked(vscode.workspace.fs.copy).mockResolvedValue(undefined);

        const manager = new SampleManager();
        await manager.prepare();

        expect(mockFs.rmdirSync).toHaveBeenCalled();
      });

      it('should handle lock contention when already completed', async () => {
        let callCount = 0;
        mockFs.mkdirSync.mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            const err: any = new Error('EEXIST');
            err.code = 'EEXIST';
            throw err;
          }
        });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('Succ');

        const manager = new SampleManager();
        await manager.prepare();
      });
    });
  });
});
