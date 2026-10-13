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
import { Readable } from 'stream';

// Mock fs module
vi.mock('fs', () => ({
  createReadStream: vi.fn(),
}));

import * as fs from 'fs';
import { isFilePathExists, isFileUriExists, deleteFile, readFirstNLines } from '../../../src/utils/file-system';

describe('file-system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isFilePathExists', () => {
    it('should return true when file exists', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({ type: 1, ctime: 0, mtime: 0, size: 100 });
      const result = await isFilePathExists('/test/file.txt');
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(new Error('File not found'));
      const result = await isFilePathExists('/test/nonexistent.txt');
      expect(result).toBe(false);
    });
  });

  describe('isFileUriExists', () => {
    it('should return true when URI exists', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({ type: 1, ctime: 0, mtime: 0, size: 100 });
      const uri = vscode.Uri.file('/test/file.txt');
      const result = await isFileUriExists(uri);
      expect(result).toBe(true);
    });

    it('should return false when URI does not exist', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(new Error('File not found'));
      const uri = vscode.Uri.file('/test/nonexistent.txt');
      const result = await isFileUriExists(uri);
      expect(result).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete file when it exists', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({ type: 1, ctime: 0, mtime: 0, size: 100 });
      vi.mocked(vscode.workspace.fs.delete).mockResolvedValueOnce(undefined);
      
      const uri = vscode.Uri.file('/test/file.txt');
      await deleteFile(uri);
      
      expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(uri, { recursive: true });
    });

    it('should not delete file when it does not exist', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValueOnce(new Error('File not found'));
      
      const uri = vscode.Uri.file('/test/nonexistent.txt');
      await deleteFile(uri);
      
      expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();
    });

    it('should handle delete error gracefully', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValueOnce({ type: 1, ctime: 0, mtime: 0, size: 100 });
      vi.mocked(vscode.workspace.fs.delete).mockRejectedValueOnce(new Error('Delete failed'));
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const uri = vscode.Uri.file('/test/file.txt');
      await deleteFile(uri);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('readFirstNLines', () => {
    it('should read first N lines from file', async () => {
      const mockStream = new Readable();
      mockStream.push('line1\nline2\nline3\nline4\nline5\n');
      mockStream.push(null);
      
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const result = await readFirstNLines('/test/file.txt', 3);
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('should return all lines when file has fewer than N lines', async () => {
      const mockStream = new Readable();
      mockStream.push('line1\nline2\n');
      mockStream.push(null);
      
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const result = await readFirstNLines('/test/file.txt', 10);
      expect(result).toEqual(['line1', 'line2']);
    });

    it('should handle empty file', async () => {
      const mockStream = new Readable();
      mockStream.push(null);
      
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const result = await readFirstNLines('/test/empty.txt', 5);
      expect(result).toEqual([]);
    });

    it('should handle read error', async () => {
      const mockStream = new Readable();
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const promise = readFirstNLines('/test/file.txt', 5);
      mockStream.destroy(new Error('Read error'));
      
      await expect(promise).rejects.toThrow('Read error');
    });

    it('should handle file with CRLF line endings', async () => {
      const mockStream = new Readable();
      mockStream.push('line1\r\nline2\r\nline3\r\n');
      mockStream.push(null);
      
      (fs.createReadStream as any).mockReturnValue(mockStream);
      
      const result = await readFirstNLines('/test/file.txt', 2);
      expect(result).toEqual(['line1', 'line2']);
    });
  });
});
