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
import * as vscode from 'vscode';
import { readWholeFileByTextDocument } from '../../../../src/services/welcome/getPythonCode';

describe('welcome/getPythonCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readWholeFileByTextDocument', () => {
    it('should read whole file content successfully', async () => {
      const mockContent = 'print("Hello, World!")';
      const mockDocument = {
        getText: vi.fn().mockReturnValue(mockContent),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readWholeFileByTextDocument(vscode.Uri.file('/test/file.py'));

      expect(result).toBe(mockContent);
      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.any(Object));
      expect(mockDocument.getText).toHaveBeenCalled();
    });

    it('should return default content when openTextDocument fails', async () => {
      vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error('File not found'));

      const result = await readWholeFileByTextDocument(vscode.Uri.file('/test/file.py'));

      expect(result).toContain('#!/usr/bin/env python3');
      expect(result).toContain('Softmax Example for PyPTO');
    });

    it('should return default content when getText fails', async () => {
      const mockDocument = {
        getText: vi.fn().mockImplementation(() => {
          throw new Error('Cannot read text');
        }),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readWholeFileByTextDocument(vscode.Uri.file('/test/file.py'));

      expect(result).toContain('#!/usr/bin/env python3');
      expect(result).toContain('Softmax Example for PyPTO');
    });

    it('should handle empty file content', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue(''),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readWholeFileByTextDocument(vscode.Uri.file('/test/file.py'));

      expect(result).toBe('');
    });

    it('should handle large file content', async () => {
      const largeContent = 'x'.repeat(10000);
      const mockDocument = {
        getText: vi.fn().mockReturnValue(largeContent),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readWholeFileByTextDocument(vscode.Uri.file('/test/file.py'));

      expect(result).toBe(largeContent);
      expect(result.length).toBe(10000);
    });

    it('should handle multiline content', async () => {
      const multilineContent = 'line1\nline2\nline3\nline4';
      const mockDocument = {
        getText: vi.fn().mockReturnValue(multilineContent),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readWholeFileByTextDocument(vscode.Uri.file('/test/file.py'));

      expect(result).toBe(multilineContent);
      expect(result.split('\n')).toHaveLength(4);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'def test():\n    return "Hello\\nWorld"';
      const mockDocument = {
        getText: vi.fn().mockReturnValue(specialContent),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readWholeFileByTextDocument(vscode.Uri.file('/test/file.py'));

      expect(result).toBe(specialContent);
    });

    it('should call openTextDocument with correct URI', async () => {
      const testUri = vscode.Uri.file('/path/to/test.py');
      const mockDocument = {
        getText: vi.fn().mockReturnValue('content'),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      await readWholeFileByTextDocument(testUri);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(testUri);
    });
  });
});
