/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect } from 'vitest';
import {
  functionNodeToExecuteFunction,
  getFunctionName,
  getLanguageIdByFilePath,
} from '../../../../src/services/control-flow/utils';
import type { FunctionNode } from '../../../../src/types/control-flow';

describe('control-flow/utils', () => {
  describe('functionNodeToExecuteFunction', () => {
    it('should transform function node to execute function with valid input', () => {
      const functionNode: FunctionNode = {
        funcmagic: 123,
        rawname: 'test_function',
        hash: 'abc123',
      } as FunctionNode;

      const result = functionNodeToExecuteFunction(functionNode);

      expect(result).toEqual({
        magic: 123,
        magicName: 'test_function',
        hash: 'abc123',
      });
    });

    it('should handle function node with _root suffix', () => {
      const functionNode: FunctionNode = {
        funcmagic: 456,
        rawname: 'main_root',
        hash: 'def456',
      } as FunctionNode;

      const result = functionNodeToExecuteFunction(functionNode);

      expect(result).toEqual({
        magic: 456,
        magicName: 'main',
        hash: 'def456',
      });
    });

    it('should preserve all required properties', () => {
      const functionNode: FunctionNode = {
        funcmagic: 789,
        rawname: 'complex_function_name',
        hash: 'xyz789',
      } as FunctionNode;

      const result = functionNodeToExecuteFunction(functionNode);

      expect(result.magic).toBe(789);
      expect(result.magicName).toBe('complex_function_name');
      expect(result.hash).toBe('xyz789');
    });
  });

  describe('getFunctionName', () => {
    it('should remove _root suffix from rawname', () => {
      const functionNode: FunctionNode = {
        rawname: 'main_root',
      } as FunctionNode;

      const result = getFunctionName(functionNode);

      expect(result).toBe('main');
    });

    it('should return rawname unchanged if no _root suffix', () => {
      const functionNode: FunctionNode = {
        rawname: 'regular_function',
      } as FunctionNode;

      const result = getFunctionName(functionNode);

      expect(result).toBe('regular_function');
    });

    it('should handle empty rawname', () => {
      const functionNode: FunctionNode = {
        rawname: '',
      } as FunctionNode;

      const result = getFunctionName(functionNode);

      expect(result).toBe('');
    });

    it('should only remove _root at the end', () => {
      const functionNode: FunctionNode = {
        rawname: 'root_function_root',
      } as FunctionNode;

      const result = getFunctionName(functionNode);

      expect(result).toBe('root_function');
    });

    it('should not remove _root in the middle', () => {
      const functionNode: FunctionNode = {
        rawname: 'my_root_function',
      } as FunctionNode;

      const result = getFunctionName(functionNode);

      expect(result).toBe('my_root_function');
    });
  });

  describe('getLanguageIdByFilePath', () => {
    it('should return "python" for .py files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.py')).toBe('python');
      expect(getLanguageIdByFilePath('C:\\Users\\test\\script.py')).toBe('python');
    });

    it('should return "cpp" for .cpp files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.cpp')).toBe('cpp');
    });

    it('should return "c" for .c files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.c')).toBe('c');
    });

    it('should return "jsonc" for .json files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.json')).toBe('jsonc');
    });

    it('should return "plaintext" for unknown extensions', () => {
      expect(getLanguageIdByFilePath('/path/to/file.unknown')).toBe('plaintext');
      expect(getLanguageIdByFilePath('/path/to/file.xyz')).toBe('plaintext');
    });

    it('should handle paths with multiple dots', () => {
      expect(getLanguageIdByFilePath('/path/to/my.file.name.py')).toBe('python');
      expect(getLanguageIdByFilePath('/path/to/config.test.json')).toBe('jsonc');
    });

    it('should handle paths without extensions', () => {
      expect(getLanguageIdByFilePath('/path/to/README')).toBe('plaintext');
      expect(getLanguageIdByFilePath('/path/to/Makefile')).toBe('plaintext');
    });

    it('should handle TypeScript files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.ts')).toBe('typescript');
      expect(getLanguageIdByFilePath('/path/to/file.tsx')).toBe('typescriptreact');
    });

    it('should handle JavaScript files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.js')).toBe('javascript');
      expect(getLanguageIdByFilePath('/path/to/file.jsx')).toBe('javascriptreact');
    });

    it('should handle web frontend files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.vue')).toBe('vue');
      expect(getLanguageIdByFilePath('/path/to/file.html')).toBe('html');
      expect(getLanguageIdByFilePath('/path/to/file.css')).toBe('css');
      expect(getLanguageIdByFilePath('/path/to/file.scss')).toBe('scss');
    });

    it('should handle backend/script files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.java')).toBe('java');
      expect(getLanguageIdByFilePath('/path/to/file.go')).toBe('go');
      expect(getLanguageIdByFilePath('/path/to/file.rs')).toBe('rust');
      expect(getLanguageIdByFilePath('/path/to/file.rb')).toBe('ruby');
    });

    it('should handle data format files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.yaml')).toBe('yaml');
      expect(getLanguageIdByFilePath('/path/to/file.yml')).toBe('yaml');
      expect(getLanguageIdByFilePath('/path/to/file.xml')).toBe('xml');
      expect(getLanguageIdByFilePath('/path/to/file.csv')).toBe('csv');
    });

    it('should handle documentation files', () => {
      expect(getLanguageIdByFilePath('/path/to/file.md')).toBe('markdown');
      expect(getLanguageIdByFilePath('/path/to/file.txt')).toBe('plaintext');
    });

    it('should be case-insensitive for extensions', () => {
      expect(getLanguageIdByFilePath('/path/to/file.PY')).toBe('python');
      expect(getLanguageIdByFilePath('/path/to/file.JSON')).toBe('jsonc');
      expect(getLanguageIdByFilePath('/path/to/file.Ts')).toBe('typescript');
    });

    it('should handle Windows and Unix paths', () => {
      expect(getLanguageIdByFilePath('C:\\Users\\test\\file.py')).toBe('python');
      expect(getLanguageIdByFilePath('/home/user/file.py')).toBe('python');
      expect(getLanguageIdByFilePath('file.py')).toBe('python');
    });
  });
});
