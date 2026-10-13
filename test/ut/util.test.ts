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

const { mockConfig, mockExts, mockFs } = vi.hoisted(() => ({
  mockConfig: { get: vi.fn() },
  mockExts: { extensionPath: '/test/extension' },
  mockFs: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

vi.mock('vscode', async () => {
  const mock = await import('./mocks/vscode');
  return {
    ...mock,
    workspace: { getConfiguration: vi.fn(() => mockConfig) },
    window: { showWarningMessage: vi.fn(() => Promise.resolve(undefined)) },
    commands: { executeCommand: vi.fn() },
  };
});

vi.mock('i18next', () => ({ t: (key: string) => key }));

vi.mock(import('../../../src/hismarliteEx'), () => ({
  hismartliteEx: mockExts,
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, ...mockFs };
});

import { Util, getFileNameByPath, getDiffInfo, getOtherFilePath, getDebugFilename } from '../../../src/util';
import { workspace, window, commands } from 'vscode';
import * as fs from 'fs';

describe('Util.replaceHtmlFromData', () => {
  it('replaces matching params in html', () => {
    const util = new Util();
    const result = util.replaceHtmlFromData(
      [{ name: '{{title}}', value: 'Hello' }],
      '<div>{{title}}</div>',
    );
    expect(result).toBe('<div>Hello</div>');
  });

  it('skips params not found in html', () => {
    const util = new Util();
    const result = util.replaceHtmlFromData(
      [{ name: '{{missing}}', value: 'X' }],
      '<div>{{title}}</div>',
    );
    expect(result).toBe('<div>{{title}}</div>');
  });

  it('handles empty params array', () => {
    const util = new Util();
    expect(util.replaceHtmlFromData([], '<div></div>')).toBe('<div></div>');
  });

  it('replaces multiple occurrences with global flag', () => {
    const util = new Util();
    const result = util.replaceHtmlFromData(
      [{ name: 'foo', value: 'bar' }],
      'foo foo foo',
    );
    expect(result).toBe('bar bar bar');
  });
});

describe('Util.getSwimGraphCustomCfg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns config with unique shortcuts', () => {
    mockConfig.get = vi.fn((key: string) => {
      const cfg: Record<string, any> = {
        ZoomInShortcut: 'w', ZoomOutShortcut: 's',
        leftmoveShortcut: 'a', rightmoveShortcut: 'd',
        connectionLevel: -1, showPerformancePanel: true, showIsMixMode: false,
      };
      return cfg[key];
    });

    const result = Util.getSwimGraphCustomCfg();
    expect(result['ZoomInShortcut']).toBe('w');
    expect(result['ZoomOutShortcut']).toBe('s');
    expect(result['leftmoveShortcut']).toBe('a');
    expect(result['rightmoveShortcut']).toBe('d');
    expect(result['connectionLevel']).toBe(-1);
    expect(result['showPerformancePanel']).toBe(true);
    expect(result['showIsMixMode']).toBe(false);
  });

  it('shows warning when duplicate shortcuts detected', () => {
    mockConfig.get = vi.fn((key: string) => {
      const cfg: Record<string, any> = {
        ZoomInShortcut: 'w', ZoomOutShortcut: 'w',
        leftmoveShortcut: undefined, rightmoveShortcut: undefined,
        connectionLevel: undefined, showPerformancePanel: undefined, showIsMixMode: undefined,
      };
      return cfg[key];
    });
    vi.mocked(window.showWarningMessage).mockResolvedValue('pypto.configImprove' as any);

    Util.getSwimGraphCustomCfg();
    expect(window.showWarningMessage).toHaveBeenCalledWith('pypto.configWarning', 'pypto.configImprove');
  });

  it('executes openSettings command when user selects improve', async () => {
    mockConfig.get = vi.fn((key: string) => {
      const cfg: Record<string, any> = {
        ZoomInShortcut: 'w', ZoomOutShortcut: 'w',
        leftmoveShortcut: undefined, rightmoveShortcut: undefined,
        connectionLevel: undefined, showPerformancePanel: undefined, showIsMixMode: undefined,
      };
      return cfg[key];
    });
    vi.mocked(window.showWarningMessage).mockResolvedValue('pypto.configImprove' as any);

    Util.getSwimGraphCustomCfg();
    await new Promise((r) => setTimeout(r, 10));
    expect(commands.executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', '@ext:cann-pub.pypto-toolkit shortcut');
  });

  it('does not execute command when user does not select improve', async () => {
    mockConfig.get = vi.fn((key: string) => {
      const cfg: Record<string, any> = {
        ZoomInShortcut: 'w', ZoomOutShortcut: 'w',
        leftmoveShortcut: undefined, rightmoveShortcut: undefined,
        connectionLevel: undefined, showPerformancePanel: undefined, showIsMixMode: undefined,
      };
      return cfg[key];
    });
    vi.mocked(window.showWarningMessage).mockResolvedValue(undefined);

    Util.getSwimGraphCustomCfg();
    await new Promise((r) => setTimeout(r, 10));
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('skips empty shortcut values', () => {
    mockConfig.get = vi.fn((key: string) => {
      const cfg: Record<string, any> = {
        ZoomInShortcut: '', ZoomOutShortcut: undefined,
        leftmoveShortcut: null, rightmoveShortcut: 'd',
        connectionLevel: undefined, showPerformancePanel: undefined, showIsMixMode: undefined,
      };
      return cfg[key];
    });

    const result = Util.getSwimGraphCustomCfg();
    expect(result['ZoomInShortcut']).toBeUndefined();
    expect(result['rightmoveShortcut']).toBe('d');
  });

  it('handles case-insensitive duplicate detection', () => {
    mockConfig.get = vi.fn((key: string) => {
      const cfg: Record<string, any> = {
        ZoomInShortcut: 'W', ZoomOutShortcut: 'w',
        leftmoveShortcut: undefined, rightmoveShortcut: undefined,
        connectionLevel: undefined, showPerformancePanel: undefined, showIsMixMode: undefined,
      };
      return cfg[key];
    });
    vi.mocked(window.showWarningMessage).mockResolvedValue(undefined);

    Util.getSwimGraphCustomCfg();
    expect(window.showWarningMessage).toHaveBeenCalled();
  });
});

describe('Util.getCachePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates cache dir and file when they do not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = Util.getCachePath('test.json');
    expect(mockFs.mkdirSync).toHaveBeenCalled();
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('test.json'), '{}', 'utf-8');
    expect(result).toContain('test.json');
  });

  it('returns existing cache path without creating', () => {
    mockFs.existsSync.mockReturnValue(true);

    const result = Util.getCachePath('existing.json');
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(result).toContain('existing.json');
  });
});

describe('Util.readSwim2ComGraphMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed JSON when file is valid', () => {
    mockFs.readFileSync.mockReturnValue('{"key":"value"}');
    const result = Util.readSwim2ComGraphMap('/test/cache.json');
    expect(result).toEqual({ key: 'value' });
  });

  it('returns empty object when JSON parse fails', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.readFileSync.mockReturnValue('invalid json');
    const result = Util.readSwim2ComGraphMap('/test/cache.json');
    expect(result).toEqual({});
    spy.mockRestore();
  });

  it('returns empty object when readFileSync throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const result = Util.readSwim2ComGraphMap('/test/cache.json');
    expect(result).toEqual({});
    spy.mockRestore();
  });
});

describe('Util.writeJsonCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes JSON data to file', () => {
    Util.writeJsonCache('/test/cache.json', { foo: 'bar' });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('/test/cache.json', JSON.stringify({ foo: 'bar' }, null, 2), 'utf-8');
  });

  it('logs error when cachePath is empty', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Util.writeJsonCache('', { foo: 'bar' });
    expect(spy).toHaveBeenCalledWith('Failed to read cachePath');
    spy.mockRestore();
  });

  it('logs error when writeFileSync throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.writeFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    Util.writeJsonCache('/test/cache.json', { foo: 'bar' });
    expect(spy).toHaveBeenCalledWith('Failed to write mapping cache:', expect.any(Error));
    spy.mockRestore();
  });
});

describe('Util.writeSwimConfigMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges existing data with new config and writes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.readFileSync.mockReturnValue('{"existing":"data"}');
    const paramObj = JSON.stringify({
      kernelColorRending: 'red',
      kernelTextRending: 'bold',
      hashOrderRending: 'hash1',
      aicpuColorRending: 'blue',
      perfColorReding: 'green',
    });
    Util.writeSwimConfigMap('/test/cache.json', paramObj);
    const writtenData = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
    expect(writtenData.existing).toBe('data');
    expect(writtenData.colorRending).toBe('red');
    expect(writtenData.textRending).toBe('bold');
    expect(writtenData.hashOrderRending).toBe('hash1');
    expect(writtenData.aicpuColorRending).toBe('blue');
    expect(writtenData.perfColorReding).toBe('green');
    spy.mockRestore();
  });

  it('logs error when paramObj is invalid JSON', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Util.writeSwimConfigMap('/test/cache.json', 'invalid json');
    expect(spy).toHaveBeenCalledWith('Failed to write mapping cache:', expect.any(Error));
    spy.mockRestore();
  });
});

describe('getFileNameByPath', () => {
  it('returns filename without .json extension', () => {
    expect(getFileNameByPath('/path/to/file.json')).toBe('file');
  });

  it('returns filename as-is when no .json extension', () => {
    expect(getFileNameByPath('/path/to/file.txt')).toBe('file.txt');
  });
});

describe('getDiffInfo', () => {
  it('returns DiffInfo with correct fields', () => {
    const result = getDiffInfo('/path/to/before.json', { data: 1 });
    expect(result.beforeFileName).toBe('before');
    expect(result.beforeJson).toEqual({ data: 1 });
    expect(result.beforeFilePath).toBe('/path/to/before.json');
  });
});

describe('getOtherFilePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Before path when file starts with After', () => {
    mockFs.existsSync.mockReturnValue(true);
    const result = getOtherFilePath('/path/to/AfterGraph.json');
    expect(result).toBe('/path/to/BeforeGraph.json');
  });

  it('returns After path when file starts with Before', () => {
    mockFs.existsSync.mockReturnValue(true);
    const result = getOtherFilePath('/path/to/BeforeGraph.json');
    expect(result).toBe('/path/to/AfterGraph.json');
  });

  it('returns undefined when file does not start with After or Before', () => {
    mockFs.existsSync.mockReturnValue(true);
    const result = getOtherFilePath('/path/to/normal.json');
    expect(result).toBeUndefined();
  });

  it('returns undefined when other file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = getOtherFilePath('/path/to/AfterGraph.json');
    expect(result).toBeUndefined();
  });

  it('handles case-insensitive prefix (lowercase after)', () => {
    mockFs.existsSync.mockReturnValue(true);
    const result = getOtherFilePath('/path/to/aftergraph.json');
    expect(result).toBe('/path/to/Beforegraph.json');
  });
});

describe('getDebugFilename', () => {
  it('returns filename with default prefix and extension', () => {
    const result = getDebugFilename();
    expect(result).toMatch(/^comgraph_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
  });

  it('returns filename with custom prefix', () => {
    const result = getDebugFilename('swimlane');
    expect(result).toMatch(/^swimlane_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
  });

  it('returns filename with custom extension', () => {
    const result = getDebugFilename('debug', '.log');
    expect(result).toMatch(/^debug_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/);
  });
});
