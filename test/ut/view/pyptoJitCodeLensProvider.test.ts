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

import { PyptoJitCodeLensProvider } from '../../../src/view/pyptoJitCodeLensProvider';

function createMockDocument(text: string, languageId = 'python') {
  return {
    languageId,
    getText: () => text,
    uri: { fsPath: '/test/file.py' },
    lineAt: (line: number) => {
      const lines = text.split('\n');
      return { text: lines[line] || '' };
    },
    lineCount: text.split('\n').length,
    positionAt: (offset: number) => {
      const lines = text.split('\n');
      let pos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (pos + lines[i].length >= offset) {
          return { line: i, character: offset - pos };
        }
        pos += lines[i].length + 1;
      }
      return { line: lines.length - 1, character: 0 };
    },
  };
}

describe('PyptoJitCodeLensProvider.provideCodeLenses', () => {
  let provider: PyptoJitCodeLensProvider;

  beforeEach(() => {
    provider = new PyptoJitCodeLensProvider();
  });

  it('returns empty array for non-python documents', () => {
    const doc = createMockDocument('@pypto.frontend.jit', 'javascript');
    const result = provider.provideCodeLenses(doc as any);
    expect(result).toEqual([]);
  });

  it('detects a single @pypto.frontend.jit decorator and creates 4 CodeLenses', () => {
    const doc = createMockDocument('@pypto.frontend.jit\ndef foo():\n  pass');
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(4);
    expect(result[0].command.command).toBe('pypto.setDebugOptions');
    expect(result[1].command.command).toBe('pypto.unsetDebugOptions');
    expect(result[2].command.command).toBe('pypto.setAllDebugMode');
    expect(result[3].command.command).toBe('pypto.unsetAllDebugMode');
  });

  it('detects @pypto.jit (without .frontend) decorator', () => {
    const doc = createMockDocument('@pypto.jit\ndef foo():\n  pass');
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(4);
  });

  it('detects multiple decorators', () => {
    const text = '@pypto.frontend.jit\ndef foo():\n  pass\n\n@pypto.frontend.jit\ndef bar():\n  pass\n\n@pypto.frontend.jit\ndef baz():\n  pass';
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(12);
  });

  it('ignores decorator inside single-line string', () => {
    const text = "x = '@pypto.frontend.jit'\ndef foo():\n  pass";
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(0);
  });

  it('ignores decorator inside double-line string', () => {
    const text = 'x = "@pypto.frontend.jit"\ndef foo():\n  pass';
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(0);
  });

  it('ignores decorator inside triple-quoted multi-line string', () => {
    const text = '"""\n@pypto.frontend.jit\n"""\ndef foo():\n  pass';
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(0);
  });

  it('ignores decorator after # comment', () => {
    const text = '# @pypto.frontend.jit\ndef foo():\n  pass';
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(0);
  });

  it('ignores decorator in inline comment after code', () => {
    const text = 'x = 1 # @pypto.frontend.jit\ndef foo():\n  pass';
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no decorators exist', () => {
    const doc = createMockDocument('def foo():\n  pass\ndef bar():\n  pass');
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(0);
  });

  it('skips empty lines and comment-only lines', () => {
    const text = '\n\n# comment\n@pypto.frontend.jit\ndef foo():\n  pass';
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(4);
  });

  it('detects decorator with parentheses', () => {
    const text = '@pypto.frontend.jit()\ndef foo():\n  pass';
    const doc = createMockDocument(text);
    const result = provider.provideCodeLenses(doc as any) as any[];
    expect(result).toHaveLength(4);
  });
});

describe('PyptoJitCodeLensProvider.refresh', () => {
  it('fires onDidChangeCodeLenses event', () => {
    const provider = new PyptoJitCodeLensProvider();
    const listener = vi.fn();
    provider.onDidChangeCodeLenses(listener);
    provider.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
