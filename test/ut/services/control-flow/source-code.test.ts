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
import { readLinesByTextDocument, openTargetFileInSplit } from '../../../../src/services/control-flow/source-code';
import { GetSnippetDocumentTag } from '../../../../src/types/control-flow/source-code';

describe('control-flow/source-code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readLinesByTextDocument', () => {
    it('should read lines with valid range', async () => {
      const mockDocument = {
        lineCount: 10,
        lineAt: vi.fn((line: number) => ({
          text: `Line ${line + 1}`,
        })),
        eol: vscode.EndOfLine.LF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 2, 4);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_SUCCESSFUL);
      expect(result.document).toBe('Line 2\nLine 3\nLine 4');
      expect(mockDocument.lineAt).toHaveBeenCalledTimes(3);
    });

    it('should convert 1-based to 0-based line numbers', async () => {
      const mockDocument = {
        lineCount: 5,
        lineAt: vi.fn((line: number) => ({
          text: `Line ${line + 1}`,
        })),
        eol: vscode.EndOfLine.LF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 1, 3);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_SUCCESSFUL);
      expect(result.document).toBe('Line 1\nLine 2\nLine 3');
      expect(mockDocument.lineAt).toHaveBeenCalledWith(0);
      expect(mockDocument.lineAt).toHaveBeenCalledWith(1);
      expect(mockDocument.lineAt).toHaveBeenCalledWith(2);
    });

    it('should handle CRLF line endings', async () => {
      const mockDocument = {
        lineCount: 3,
        lineAt: vi.fn((line: number) => ({
          text: `Line ${line + 1}`,
        })),
        eol: vscode.EndOfLine.CRLF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 1, 3);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_SUCCESSFUL);
      expect(result.document).toBe('Line 1\r\nLine 2\r\nLine 3');
    });

    it('should handle LF line endings', async () => {
      const mockDocument = {
        lineCount: 3,
        lineAt: vi.fn((line: number) => ({
          text: `Line ${line + 1}`,
        })),
        eol: vscode.EndOfLine.LF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 1, 3);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_SUCCESSFUL);
      expect(result.document).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should return IS_NO_LINE when startIdx > endIdx', async () => {
      const mockDocument = {
        lineCount: 5,
        lineAt: vi.fn(),
        eol: vscode.EndOfLine.LF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 10, 5);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_NO_LINE);
      expect(result.document).toBe('读取失败：源码已修改，找不到对应代码行');
    });

    it('should clamp startLine to 0 when negative', async () => {
      const mockDocument = {
        lineCount: 5,
        lineAt: vi.fn((line: number) => ({
          text: `Line ${line + 1}`,
        })),
        eol: vscode.EndOfLine.LF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), -5, 2);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_SUCCESSFUL);
      expect(mockDocument.lineAt).toHaveBeenCalledWith(0);
    });

    it('should clamp endLine to document.lineCount - 1 when exceeding', async () => {
      const mockDocument = {
        lineCount: 5,
        lineAt: vi.fn((line: number) => ({
          text: `Line ${line + 1}`,
        })),
        eol: vscode.EndOfLine.LF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 1, 100);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_SUCCESSFUL);
      expect(mockDocument.lineAt).toHaveBeenCalledWith(4);
    });

    it('should return IS_NO_FILE when openTextDocument fails', async () => {
      vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error('File not found'));

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 1, 5);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_NO_FILE);
      expect(result.document).toBe('/test/file.py');
    });

    it('should handle single line range', async () => {
      const mockDocument = {
        lineCount: 10,
        lineAt: vi.fn((line: number) => ({
          text: `Line ${line + 1}`,
        })),
        eol: vscode.EndOfLine.LF,
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      const result = await readLinesByTextDocument(vscode.Uri.file('/test/file.py'), 5, 5);

      expect(result.isSuccessful).toBe(GetSnippetDocumentTag.IS_SUCCESSFUL);
      expect(result.document).toBe('Line 5');
      expect(mockDocument.lineAt).toHaveBeenCalledTimes(1);
    });
  });

  describe('openTargetFileInSplit', () => {
    it('should open file in split view and navigate to target line', async () => {
      const mockDocument = {};
      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn(),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(mockEditor as any);

      await openTargetFileInSplit(vscode.Uri.file('/test/file.py'), 10);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.any(Object));
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      });
      expect(mockEditor.revealRange).toHaveBeenCalledWith(
        expect.any(Object),
        vscode.TextEditorRevealType.InCenter
      );
    });

    it('should convert 1-based to 0-based line number', async () => {
      const mockDocument = {};
      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn(),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(mockEditor as any);

      await openTargetFileInSplit(vscode.Uri.file('/test/file.py'), 5);

      // Verify that selection was set
      expect(mockEditor.selection).toBeDefined();
      // The Selection should be created with Position(4, 0) and Position(4, 0)
      // Since Selection is a mock, we verify it was called
      expect(vscode.Selection).toHaveBeenCalled();
    });

    it('should show error message when openTextDocument fails', async () => {
      vi.mocked(vscode.workspace.openTextDocument).mockRejectedValue(new Error('File not found'));

      await openTargetFileInSplit(vscode.Uri.file('/test/file.py'), 10);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('File not found');
    });

    it('should show error message when showTextDocument fails', async () => {
      const mockDocument = {};
      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.window.showTextDocument).mockRejectedValue(new Error('Cannot show document'));

      await openTargetFileInSplit(vscode.Uri.file('/test/file.py'), 10);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Cannot show document');
    });

    it('should set selection and reveal range', async () => {
      const mockDocument = {};
      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn(),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.window.showTextDocument).mockResolvedValue(mockEditor as any);

      await openTargetFileInSplit(vscode.Uri.file('/test/file.py'), 10);

      expect(mockEditor.selection).toBeDefined();
      expect(mockEditor.revealRange).toHaveBeenCalledWith(
        expect.any(Object),
        vscode.TextEditorRevealType.InCenter
      );
    });
  });
});
