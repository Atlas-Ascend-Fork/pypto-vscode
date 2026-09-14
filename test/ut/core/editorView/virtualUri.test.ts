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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect } from 'vitest';
import { toVirtualUri, fromVirtualUri } from '../../../../src/core/editorView/virtualUri';
import * as vscode from 'vscode';

describe('virtualUri', () => {
  describe('toVirtualUri', () => {
    it('should create virtual URI with path and viewType', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const result = toVirtualUri(uri, 'computeGraph');
      expect(result.query).toContain('_path');
      expect(result.query).toContain('/test/file.json');
      expect(result.query).toContain('_viewType');
      expect(result.query).toContain('computeGraph');
    });

    it('should include query parameters', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const query = { funcHash: 'abc123', nodeMagic: '5' };
      const result = toVirtualUri(uri, 'computeGraph', query);
      expect(result.query).toContain('funcHash');
      expect(result.query).toContain('abc123');
      expect(result.query).toContain('nodeMagic');
      expect(result.query).toContain('5');
    });

    it('should handle empty query', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const result = toVirtualUri(uri, 'computeGraph', {});
      expect(result.query).toContain('_path');
      expect(result.query).toContain('_viewType');
    });

    it('should handle undefined query', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const result = toVirtualUri(uri, 'computeGraph');
      expect(result.query).toContain('_path');
      expect(result.query).toContain('_viewType');
    });

    it('should preserve original URI properties', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const result = toVirtualUri(uri, 'computeGraph');
      expect(result.fsPath).toBe('/test/file.json');
    });
  });

  describe('fromVirtualUri', () => {
    it('should parse virtual URI correctly', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const virtualUri = toVirtualUri(uri, 'computeGraph', { funcHash: 'abc123' });
      const result = fromVirtualUri(virtualUri);
      expect(result._path).toBe('/test/file.json');
      expect(result._viewType).toBe('computeGraph');
      expect(result.funcHash).toBe('abc123');
    });

    it('should handle empty query', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const virtualUri = toVirtualUri(uri, 'computeGraph');
      const result = fromVirtualUri(virtualUri);
      expect(result._path).toBe('/test/file.json');
      expect(result._viewType).toBe('computeGraph');
    });

    it('should throw error for invalid JSON', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const invalidUri = uri.with({ query: 'invalid json' });
      expect(() => fromVirtualUri(invalidUri)).toThrow('VirtualUri参数解析失败');
    });

    it('should handle complex query parameters', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const query = {
        funcHash: 'abc123',
        nodeMagic: '5',
        isSearch: true,
        nested: { foo: 'bar' },
      };
      const virtualUri = toVirtualUri(uri, 'computeGraph', query);
      const result = fromVirtualUri(virtualUri);
      expect(result._path).toBe('/test/file.json');
      expect(result._viewType).toBe('computeGraph');
      expect(result.funcHash).toBe('abc123');
      expect(result.nodeMagic).toBe('5');
      expect(result.isSearch).toBe(true);
      expect(result.nested).toEqual({ foo: 'bar' });
    });

    it('should handle round-trip conversion', () => {
      const uri = vscode.Uri.file('/test/file.json');
      const query = { funcHash: 'abc123', nodeMagic: '5' };
      const virtualUri = toVirtualUri(uri, 'computeGraph', query);
      const result = fromVirtualUri(virtualUri);
      const reconstructedUri = toVirtualUri(
        vscode.Uri.file(result._path),
        result._viewType,
        result
      );
      const result2 = fromVirtualUri(reconstructedUri);
      expect(result2._path).toBe(result._path);
      expect(result2._viewType).toBe(result._viewType);
      expect(result2.funcHash).toBe(result.funcHash);
      expect(result2.nodeMagic).toBe(result.nodeMagic);
    });
  });
});
