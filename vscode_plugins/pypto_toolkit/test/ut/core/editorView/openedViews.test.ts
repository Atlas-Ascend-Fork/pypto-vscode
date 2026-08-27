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
import { OpenedViews } from '../../../../src/core/editorView/openedViews';

describe('OpenedViews', () => {
  let openedViews: OpenedViews;
  let mockWebviewPanel: any;

  beforeEach(() => {
    openedViews = new OpenedViews();
    mockWebviewPanel = {
      reveal: vi.fn(),
      onDidDispose: vi.fn((callback) => {
        (mockWebviewPanel as any)._disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
    };
  });

  describe('set', () => {
    it('should register webview panel', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      expect(openedViews.has('testView', uri)).toBe(true);
    });

    it('should register dispose callback', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      expect(mockWebviewPanel.onDidDispose).toHaveBeenCalled();
    });

    it('should remove panel from map when disposed', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      // Simulate dispose
      (mockWebviewPanel as any)._disposeCallback();

      expect(openedViews.has('testView', uri)).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true when panel exists', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      expect(openedViews.has('testView', uri)).toBe(true);
    });

    it('should return false when panel does not exist', () => {
      const uri = vscode.Uri.file('/test/file.json');

      expect(openedViews.has('testView', uri)).toBe(false);
    });

    it('should return false for different viewType', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      expect(openedViews.has('otherView', uri)).toBe(false);
    });

    it('should return false for different uri', () => {
      const uri1 = vscode.Uri.file('/test/file1.json');
      const uri2 = vscode.Uri.file('/test/file2.json');
      openedViews.set('testView', uri1, mockWebviewPanel as vscode.WebviewPanel);

      expect(openedViews.has('testView', uri2)).toBe(false);
    });
  });

  describe('reveal', () => {
    it('should reveal existing panel', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      openedViews.reveal('testView', uri);

      expect(mockWebviewPanel.reveal).toHaveBeenCalled();
    });

    it('should reveal panel with specified viewColumn', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      openedViews.reveal('testView', uri, vscode.ViewColumn.Beside);

      expect(mockWebviewPanel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.Beside);
    });

    it('should not throw when panel does not exist', () => {
      const uri = vscode.Uri.file('/test/file.json');

      expect(() => openedViews.reveal('testView', uri)).not.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete existing panel', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      const result = openedViews.delete('testView', uri);

      expect(result).toBe(true);
      expect(openedViews.has('testView', uri)).toBe(false);
    });

    it('should return false when panel does not exist', () => {
      const uri = vscode.Uri.file('/test/file.json');

      const result = openedViews.delete('testView', uri);

      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all opened panels', () => {
      const uri1 = vscode.Uri.file('/test/file1.json');
      const uri2 = vscode.Uri.file('/test/file2.json');
      const mockPanel1 = { ...mockWebviewPanel };
      const mockPanel2 = { ...mockWebviewPanel };

      openedViews.set('testView1', uri1, mockPanel1 as vscode.WebviewPanel);
      openedViews.set('testView2', uri2, mockPanel2 as vscode.WebviewPanel);

      const result = openedViews.getAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('viewType');
      expect(result[0]).toHaveProperty('uri');
      expect(result[0]).toHaveProperty('viewPanel');
    });

    it('should return empty array when no panels are opened', () => {
      const result = openedViews.getAll();

      expect(result).toHaveLength(0);
    });

    it('should return correct viewType and uri', () => {
      const uri = vscode.Uri.file('/test/file.json');
      openedViews.set('testView', uri, mockWebviewPanel as vscode.WebviewPanel);

      const result = openedViews.getAll();

      expect(result[0].viewType).toBe('testView');
      expect(result[0].uri).toBeDefined();
    });
  });
});
