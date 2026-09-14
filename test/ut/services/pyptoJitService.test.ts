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
import { PyptoJitService } from '../../../src/services/pyptoJitService';

describe('pyptoJitService', () => {
  describe('transformDecoratorText', () => {
    const transformDecoratorText = (PyptoJitService as any).transformDecoratorText.bind(PyptoJitService);

    it('should add debug_options to simple @pypto.jit decorator', () => {
      const result = transformDecoratorText('@pypto.jit', true);
      expect(result).toContain('debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)');
    });

    it('should add debug_options to @pypto.frontend.jit decorator', () => {
      const result = transformDecoratorText('@pypto.frontend.jit', true);
      expect(result).toContain('debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)');
    });

    it('should add debug_options to empty parentheses', () => {
      const result = transformDecoratorText('@pypto.jit()', true);
      expect(result).toContain('debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)');
    });

    it('should update existing debug_options to enable', () => {
      const input = '@pypto.jit(debug_options=dict(compile_debug_mode=0, runtime_debug_mode=0))';
      const result = transformDecoratorText(input, true);
      expect(result).toContain('compile_debug_mode=1');
      expect(result).toContain('runtime_debug_mode=1');
    });

    it('should update existing debug_options to disable', () => {
      const input = '@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))';
      const result = transformDecoratorText(input, false);
      expect(result).toContain('compile_debug_mode=0');
      expect(result).toContain('runtime_debug_mode=0');
    });

    it('should add debug_options to decorator with other parameters', () => {
      const input = '@pypto.jit(optimize=True)';
      const result = transformDecoratorText(input, true);
      expect(result).toContain('optimize=True');
      expect(result).toContain('debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)');
    });

    it('should preserve indentation', () => {
      const input = '    @pypto.jit';
      const result = transformDecoratorText(input, true);
      expect(result).toMatch(/^    @pypto\.jit/);
    });

    it('should handle multiline decorator with other parameters', () => {
      const input = `@pypto.jit(
    optimize=True,
    verbose=False
)`;
      const result = transformDecoratorText(input, true);
      expect(result).toContain('debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)');
    });

    it('should throw error for unrecognized format', () => {
      expect(() => transformDecoratorText('@other.decorator', true)).toThrow();
    });
  });

  describe('findClosingParenthesis', () => {
    const findClosingParenthesis = (PyptoJitService as any).findClosingParenthesis.bind(PyptoJitService);

    it('should find closing parenthesis in simple case', () => {
      const result = findClosingParenthesis('@pypto.jit()');
      expect(result).toBe(11);
    });

    it('should handle nested parentheses', () => {
      const result = findClosingParenthesis('@pypto.jit(func(a, b))');
      expect(result).toBe(21);
    });

    it('should ignore parentheses in strings', () => {
      const result = findClosingParenthesis('@pypto.jit("(")');
      expect(result).toBe(14);
    });

    it('should handle escaped quotes in strings', () => {
      const result = findClosingParenthesis('@pypto.jit("\\"(")');
      expect(result).toBe(16);
    });

    it('should return -1 when no opening parenthesis', () => {
      const result = findClosingParenthesis('@pypto.jit');
      expect(result).toBe(-1);
    });

    it('should return -1 when parenthesis not closed', () => {
      const result = findClosingParenthesis('@pypto.jit(');
      expect(result).toBe(-1);
    });

    it('should handle deeply nested parentheses', () => {
      const result = findClosingParenthesis('@pypto.jit(a(b(c(d()))))');
      expect(result).toBe(23);
    });
  });

  describe('findStringRanges', () => {
    const findStringRanges = (PyptoJitService as any).findStringRanges.bind(PyptoJitService);

    it('should find single-quoted strings', () => {
      const text = "a = 'hello'";
      const result = findStringRanges(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 4, end: 11 });
    });

    it('should find double-quoted strings', () => {
      const text = 'a = "hello"';
      const result = findStringRanges(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 4, end: 11 });
    });

    it('should find triple-quoted strings', () => {
      const text = 'a = """hello\nworld"""';
      const result = findStringRanges(text);
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(4);
      expect(result[0].end).toBe(21);
    });

    it('should handle multiple strings', () => {
      const text = "a = 'hello' + \"world\"";
      const result = findStringRanges(text);
      expect(result).toHaveLength(2);
    });

    it('should handle escaped quotes', () => {
      const text = "a = 'it\\'s'";
      const result = findStringRanges(text);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no strings', () => {
      const text = 'a = 123';
      const result = findStringRanges(text);
      expect(result).toHaveLength(0);
    });

    it('should handle empty strings', () => {
      const text = "a = ''";
      const result = findStringRanges(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ start: 4, end: 6 });
    });
  });

  describe('isInComment', () => {
    const isInComment = (PyptoJitService as any).isInComment.bind(PyptoJitService);

    it('should return true when @pypto.jit is after #', () => {
      const line = '# @pypto.jit';
      const index = line.search(/@pypto\.jit/);
      const result = isInComment(line, index);
      expect(result).toBe(true);
    });

    it('should return false when @pypto.jit is before #', () => {
      const line = '@pypto.jit # comment';
      const index = line.search(/@pypto\.jit/);
      const result = isInComment(line, index);
      expect(result).toBe(false);
    });

    it('should ignore # inside strings', () => {
      const line = '"#" @pypto.jit';
      const index = line.search(/@pypto\.jit/);
      const result = isInComment(line, index);
      expect(result).toBe(false);
    });

    it('should handle # in single-quoted strings', () => {
      const line = "'#' @pypto.jit";
      const index = line.search(/@pypto\.jit/);
      const result = isInComment(line, index);
      expect(result).toBe(false);
    });

    it('should return false when no # before @pypto.jit', () => {
      const line = '@pypto.jit';
      const index = line.search(/@pypto\.jit/);
      const result = isInComment(line, index);
      expect(result).toBe(false);
    });
  });

  describe('isMultilineDecorator', () => {
    const isMultilineDecorator = (PyptoJitService as any).isMultilineDecorator.bind(PyptoJitService);

    it('should return false for simple decorator without parentheses', () => {
      const lines = ['@pypto.jit'];
      const result = isMultilineDecorator(lines, 0);
      expect(result).toBe(false);
    });

    it('should return false for decorator with empty parentheses', () => {
      const lines = ['@pypto.jit()'];
      const result = isMultilineDecorator(lines, 0);
      expect(result).toBe(false);
    });

    it('should return false for single-line decorator with parameters', () => {
      const lines = ['@pypto.jit(optimize=True)'];
      const result = isMultilineDecorator(lines, 0);
      expect(result).toBe(false);
    });

    it('should return true for multiline decorator', () => {
      const lines = [
        '@pypto.jit(',
        '    optimize=True',
        ')'
      ];
      const result = isMultilineDecorator(lines, 0);
      expect(result).toBe(true);
    });

    it('should return true for multiline decorator with opening paren on first line', () => {
      const lines = [
        '@pypto.jit(optimize=True,',
        '    verbose=False)',
      ];
      const result = isMultilineDecorator(lines, 0);
      expect(result).toBe(true);
    });

    it('should return false for non-decorator line', () => {
      const lines = ['def my_function():'];
      const result = isMultilineDecorator(lines, 0);
      expect(result).toBe(false);
    });
  });

  describe('isPositionInStringRanges', () => {
    const isPositionInStringRanges = (PyptoJitService as any).isPositionInStringRanges.bind(PyptoJitService);

    it('should return true when position is in string range', () => {
      const ranges = [{ start: 5, end: 10 }];
      const result = isPositionInStringRanges(7, ranges);
      expect(result).toBe(true);
    });

    it('should return false when position is outside string range', () => {
      const ranges = [{ start: 5, end: 10 }];
      const result = isPositionInStringRanges(3, ranges);
      expect(result).toBe(false);
    });

    it('should return true when position is at string boundary', () => {
      const ranges = [{ start: 5, end: 10 }];
      const result = isPositionInStringRanges(5, ranges);
      expect(result).toBe(true);
    });

    it('should handle multiple string ranges', () => {
      const ranges = [
        { start: 5, end: 10 },
        { start: 20, end: 25 },
        { start: 35, end: 40 }
      ];
      expect(isPositionInStringRanges(7, ranges)).toBe(true);
      expect(isPositionInStringRanges(22, ranges)).toBe(true);
      expect(isPositionInStringRanges(37, ranges)).toBe(true);
      expect(isPositionInStringRanges(15, ranges)).toBe(false);
    });

    it('should return false for empty ranges', () => {
      const ranges: { start: number; end: number }[] = [];
      const result = isPositionInStringRanges(5, ranges);
      expect(result).toBe(false);
    });
  });

  describe('getLineStartPosition', () => {
    const getLineStartPosition = (PyptoJitService as any).getLineStartPosition.bind(PyptoJitService);

    it('should return 0 for first line', () => {
      const text = 'line1\nline2\nline3';
      const lines = text.split('\n');
      const result = getLineStartPosition(text, 0, lines);
      expect(result).toBe(0);
    });

    it('should return correct position for second line', () => {
      const text = 'line1\nline2\nline3';
      const lines = text.split('\n');
      const result = getLineStartPosition(text, 1, lines);
      expect(result).toBe(6); // 'line1\n'.length
    });

    it('should return correct position for third line', () => {
      const text = 'line1\nline2\nline3';
      const lines = text.split('\n');
      const result = getLineStartPosition(text, 2, lines);
      expect(result).toBe(12); // 'line1\nline2\n'.length
    });

    it('should handle empty lines', () => {
      const text = 'line1\n\nline3';
      const lines = text.split('\n');
      const result = getLineStartPosition(text, 2, lines);
      expect(result).toBe(7); // 'line1\n\n'.length
    });
  });

  describe('updateExistingDebugOptions', () => {
    const updateExistingDebugOptions = (PyptoJitService as any).updateExistingDebugOptions.bind(PyptoJitService);

    it('should update debug_options values to 1', () => {
      const input = '@pypto.jit(debug_options=dict(compile_debug_mode=0, runtime_debug_mode=0))';
      const result = updateExistingDebugOptions(input, '1');
      expect(result).toContain('compile_debug_mode=1');
      expect(result).toContain('runtime_debug_mode=1');
    });

    it('should update debug_options values to 0', () => {
      const input = '@pypto.jit(debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1))';
      const result = updateExistingDebugOptions(input, '0');
      expect(result).toContain('compile_debug_mode=0');
      expect(result).toContain('runtime_debug_mode=0');
    });

    it('should preserve other parameters', () => {
      const input = '@pypto.jit(optimize=True, debug_options=dict(compile_debug_mode=0, runtime_debug_mode=0))';
      const result = updateExistingDebugOptions(input, '1');
      expect(result).toContain('optimize=True');
      expect(result).toContain('compile_debug_mode=1');
    });

    it('should handle multiline format', () => {
      const input = `@pypto.jit(
    debug_options=dict(
        compile_debug_mode=0,
        runtime_debug_mode=0
    )
)`;
      const result = updateExistingDebugOptions(input, '1');
      expect(result).toContain('compile_debug_mode=1');
      expect(result).toContain('runtime_debug_mode=1');
    });
  });

  describe('addDebugOptions', () => {
    const addDebugOptions = (PyptoJitService as any).addDebugOptions.bind(PyptoJitService);

    it('should add debug_options to single-line decorator', () => {
      const input = '@pypto.jit(optimize=True)';
      const debugOptions = 'debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)';
      const result = addDebugOptions(input, debugOptions);
      expect(result).toContain('optimize=True');
      expect(result).toContain(debugOptions);
    });

    it('should add debug_options to multiline decorator', () => {
      const input = `@pypto.jit(
    optimize=True,
    verbose=False
)`;
      const debugOptions = 'debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)';
      const result = addDebugOptions(input, debugOptions);
      expect(result).toContain('optimize=True');
      expect(result).toContain(debugOptions);
    });

    it('should add comma when needed', () => {
      const input = '@pypto.jit(optimize=True)';
      const debugOptions = 'debug_options=dict(compile_debug_mode=1, runtime_debug_mode=1)';
      const result = addDebugOptions(input, debugOptions);
      expect(result).toContain('optimize=True,');
    });
  });
});
