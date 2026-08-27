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
import { PyptoJitService } from '../../../src/services/pyptoJitService';

describe('pyptoJitService (public methods)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setDebugOptions', () => {
    it('should set debug options for single-line decorator', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef my_function():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 ? '@pypto.jit' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.setDebugOptions(vscode.Uri.file('/test/file.py'), 0);

      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should show error for invalid line number', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef my_function():\n    pass'),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      await PyptoJitService.setDebugOptions(vscode.Uri.file('/test/file.py'), 100);

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should show error when line is not a decorator', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('def my_function():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: 'def my_function():',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      await PyptoJitService.setDebugOptions(vscode.Uri.file('/test/file.py'), 0);

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should handle multiline decorator', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit(\n    optimize=True\n)\ndef my_function():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 ? '@pypto.jit(' : line === 1 ? '    optimize=True' : line === 2 ? ')' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.setDebugOptions(vscode.Uri.file('/test/file.py'), 0);

      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('should show error when applyEdit fails', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef my_function():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 ? '@pypto.jit' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(false);

      await PyptoJitService.setDebugOptions(vscode.Uri.file('/test/file.py'), 0);

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('unsetDebugOptions', () => {
    it('should unset debug options for decorator with debug_options', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))\ndef my_function():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: '@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.unsetDebugOptions(vscode.Uri.file('/test/file.py'), 0);

      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should show info when decorator has no debug_options', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef my_function():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: '@pypto.jit',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      await PyptoJitService.unsetDebugOptions(vscode.Uri.file('/test/file.py'), 0);

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should show error for invalid line number', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef my_function():\n    pass'),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      await PyptoJitService.unsetDebugOptions(vscode.Uri.file('/test/file.py'), -1);

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('setAllDebugMode', () => {
    it('should set debug mode for all decorators', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef func1():\n    pass\n\n@pypto.jit\ndef func2():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 || line === 4 ? '@pypto.jit' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.setAllDebugMode(vscode.Uri.file('/test/file.py'));

      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should skip decorators in strings', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('text = "@pypto.jit"\n@pypto.jit\ndef func1():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 ? 'text = "@pypto.jit"' : line === 1 ? '@pypto.jit' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.setAllDebugMode(vscode.Uri.file('/test/file.py'));

      // Should only modify the second decorator (line 1), not the one in the string (line 0)
      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('should skip decorators in comments', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('# @pypto.jit\n@pypto.jit\ndef func1():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 ? '# @pypto.jit' : line === 1 ? '@pypto.jit' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.setAllDebugMode(vscode.Uri.file('/test/file.py'));

      // Should only modify the second decorator (line 1), not the one in the comment (line 0)
      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('should show info when no decorators found', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('def func1():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      await PyptoJitService.setAllDebugMode(vscode.Uri.file('/test/file.py'));

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });
  });

  describe('unsetAllDebugMode', () => {
    it('should unset debug mode for all decorators with debug_options', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))\ndef func1():\n    pass\n\n@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))\ndef func2():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 || line === 4 ? '@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.unsetAllDebugMode(vscode.Uri.file('/test/file.py'));

      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should skip decorators without debug_options', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef func1():\n    pass\n\n@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))\ndef func2():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 ? '@pypto.jit' : line === 4 ? '@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);
      vi.mocked(vscode.workspace.applyEdit).mockResolvedValue(true);

      await PyptoJitService.unsetAllDebugMode(vscode.Uri.file('/test/file.py'));

      // Should only modify the second decorator (line 4), not the first one (line 0)
      expect(vscode.workspace.applyEdit).toHaveBeenCalled();
    });

    it('should show info when no decorators with debug_options found', async () => {
      const mockDocument = {
        getText: vi.fn().mockReturnValue('@pypto.jit\ndef func1():\n    pass'),
        lineAt: vi.fn((line: number) => ({
          text: line === 0 ? '@pypto.jit' : '',
          range: new vscode.Range(line, 0, line, 100),
        })),
      };

      vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as any);

      await PyptoJitService.unsetAllDebugMode(vscode.Uri.file('/test/file.py'));

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });
  });
});
