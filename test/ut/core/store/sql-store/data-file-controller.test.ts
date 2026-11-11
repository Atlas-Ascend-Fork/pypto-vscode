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
import * as fs from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { DataFileController } from '../../../../../src/core/store/sql-store/data-file-controller';
import { SqlStoreManager } from '../../../../../src/core/store/sql-store/sql-store-manager';

describe('DataFileController', () => {
  let mockStoreManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    mockStoreManager = {
      toUri: vi.fn((storeName: string) => ({ fsPath: `/store/${storeName}` })),
    };
    vi.spyOn(SqlStoreManager, 'getInstance').mockReturnValue(mockStoreManager as any);
  });

  describe('constructor', () => {
    it('should create store directory', () => {
      new DataFileController('test_store');
      expect(mockStoreManager.toUri).toHaveBeenCalledWith('test_store');
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
    });
  });

  describe('read', () => {
    it('should read and parse JSON file', async () => {
      const controller = new DataFileController<any>('test_store');
      const testData = { id: 1, name: 'test' };
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(testData));

      const result = await controller.read('test.json');
      expect(result).toEqual(testData);
    });

    it('should return undefined if file does not exist', async () => {
      const controller = new DataFileController<any>('test_store');
      vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));

      const result = await controller.read('test.json');
      expect(result).toBeUndefined();
    });

    it('should return undefined if JSON parsing fails', async () => {
      const controller = new DataFileController<any>('test_store');
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json');

      const result = await controller.read('test.json');
      expect(result).toBeUndefined();
    });

    it('should revive Date objects from JSON', async () => {
      const controller = new DataFileController<any>('test_store');
      const testData = { id: 1, createdAt: '2024-01-01T12:00:00.000Z' };
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(testData));

      const result = await controller.read('test.json');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.getFullYear()).toBe(2024);
      expect(result.createdAt.getMonth()).toBe(0);
      expect(result.createdAt.getDate()).toBe(1);
    });
  });

  describe('write', () => {
    it('should write JSON file', async () => {
      const controller = new DataFileController<any>('test_store');
      const testData = { id: 1, name: 'test' };
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await controller.write(testData, 'test.json');

      expect(writeSpy).toHaveBeenCalled();
      const writtenData = JSON.parse(writeSpy.mock.calls[0][1] as string);
      expect(writtenData).toEqual(testData);
    });

    it('should serialize Date objects to ISO string', async () => {
      const controller = new DataFileController<any>('test_store');
      const testDate = new Date('2024-01-01T12:00:00.000Z');
      const testData = { id: 1, createdAt: testDate };
      const writeSpy = vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      await controller.write(testData, 'test.json');

      const writtenData = JSON.parse(writeSpy.mock.calls[0][1] as string);
      expect(writtenData.createdAt).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('delete', () => {
    it('should delete file', async () => {
      const controller = new DataFileController<any>('test_store');
      const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      await controller.delete('test.json');

      expect(unlinkSpy).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should delete store directory recursively and recreate it', async () => {
      const controller = new DataFileController<any>('test_store');
      const rmSpy = vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

      await controller.clear();

      expect(rmSpy).toHaveBeenCalledWith('/store/test_store', { recursive: true, force: true });
      expect(mkdirSpy).toHaveBeenCalledWith('/store/test_store', { recursive: true });
    });

    it('should not throw when directory removal fails', async () => {
      const controller = new DataFileController<any>('test_store');
      vi.spyOn(fs.promises, 'rm').mockRejectedValue(new Error('ENOENT'));
      const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

      await controller.clear();

      expect(mkdirSpy).toHaveBeenCalledWith('/store/test_store', { recursive: true });
    });
  });
});
