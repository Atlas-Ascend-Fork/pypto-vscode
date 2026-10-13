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
import { DataFileController } from '../../../../../src/core/store/sql-store/data-file-controller';
import { SqlStoreManager } from '../../../../../src/core/store/sql-store/sql-store-manager';
import { isFileUriExists } from '../../../../../src/utils/file-system';

vi.mock('../../../../../src/utils/file-system', () => ({
  isFileUriExists: vi.fn(),
}));

describe('DataFileController', () => {
  let mockStoreManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

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
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(JSON.stringify(testData)));
      (isFileUriExists as any).mockResolvedValue(true);

      const result = await controller.read('test.json');
      expect(result).toEqual(testData);
    });

    it('should return undefined if file does not exist', async () => {
      const controller = new DataFileController<any>('test_store');
      (isFileUriExists as any).mockResolvedValue(false);

      const result = await controller.read('test.json');
      expect(result).toBeUndefined();
    });

    it('should return undefined if JSON parsing fails', async () => {
      const controller = new DataFileController<any>('test_store');
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from('invalid json'));
      (isFileUriExists as any).mockResolvedValue(true);

      const result = await controller.read('test.json');
      expect(result).toBeUndefined();
    });

    it('should revive Date objects from JSON', async () => {
      const controller = new DataFileController<any>('test_store');
      const testData = { id: 1, createdAt: '2024-01-01T12:00:00.000Z' };
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from(JSON.stringify(testData)));
      (isFileUriExists as any).mockResolvedValue(true);

      const result = await controller.read('test.json');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.getFullYear()).toBe(2024);
      expect(result.createdAt.getMonth()).toBe(0); // January is 0
      expect(result.createdAt.getDate()).toBe(1);
    });
  });

  describe('write', () => {
    it('should write JSON file', async () => {
      const controller = new DataFileController<any>('test_store');
      const testData = { id: 1, name: 'test' };

      await controller.write(testData, 'test.json');

      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1].toString());
      expect(writtenData).toEqual(testData);
    });

    it('should serialize Date objects to ISO string', async () => {
      const controller = new DataFileController<any>('test_store');
      const testDate = new Date('2024-01-01T12:00:00.000Z');
      const testData = { id: 1, createdAt: testDate };

      await controller.write(testData, 'test.json');

      const writeCall = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1].toString());
      expect(writtenData.createdAt).toBe('2024-01-01T12:00:00.000Z');
    });
  });

  describe('delete', () => {
    it('should delete file', async () => {
      const controller = new DataFileController<any>('test_store');

      await controller.delete('test.json');

      expect(vscode.workspace.fs.delete).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should delete store directory recursively', async () => {
      const controller = new DataFileController<any>('test_store');

      await controller.clear();

      expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(
        expect.any(Object),
        { recursive: true }
      );
    });
  });
});
