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
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFs, mockWindow, mockWorkspace, mockUtil } = vi.hoisted(() => ({
  mockFs: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  },
  mockWindow: {
    showOpenDialog: vi.fn(),
    showWarningMessage: vi.fn(),
  },
  mockWorkspace: {
    workspaceFolders: [] as any[],
  },
  mockUtil: {
    getCachePath: vi.fn(),
    readSwim2ComGraphMap: vi.fn(),
  },
}));

vi.mock('vscode', async () => {
  const mock = await import('./../mocks/vscode');
  return {
    ...mock,
    window: mockWindow,
    workspace: mockWorkspace,
  };
});

vi.mock('i18next', () => ({ t: (key: string) => key }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, ...mockFs };
});

vi.mock(import('../../../src/util'), () => ({
  Util: {
    getCachePath: mockUtil.getCachePath,
    readSwim2ComGraphMap: mockUtil.readSwim2ComGraphMap,
  },
}));

import { Fider } from '../../../src/view/threeColumnEntry';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Fider constructor', () => {
  it('stores paths from constructor', () => {
    const fider = new Fider('/code/path', '/swim/path', '/com/path');
    expect(fider.codePath).toBe('/code/path');
    expect(fider.swimPath).toBe('/swim/path');
    expect(fider.comPath).toBe('/com/path');
  });

  it('defaults to undefined when no paths provided', () => {
    const fider = new Fider();
    expect(fider.codePath).toBeUndefined();
    expect(fider.swimPath).toBeUndefined();
    expect(fider.comPath).toBeUndefined();
  });
});

describe('Fider.findByCodePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined paths when codePath is not set', async () => {
    const fider = new Fider();
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result).toEqual({ swimPath: undefined, comPath: undefined, runDataTitle: undefined });
  });

  it('returns provided paths when both swimPath and comPath are provided', async () => {
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath('/swim.json', '/com.json');
    expect(result).toEqual({ swimPath: '/swim.json', comPath: '/com.json', runDataTitle: undefined });
  });

  it('returns cached paths when cache hit', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({
      '/code/path': { swimPath: '/cached/swim.json', comPath: '/cached/com.json', runDataTitle: 'cached' },
    });
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toBe('/cached/swim.json');
    expect(result.comPath).toBe('/cached/com.json');
    expect(result.runDataTitle).toBe('cached');
  });

  it('returns cached paths with undefined values when cache has falsy values', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({
      '/code/path': { swimPath: '', comPath: '', runDataTitle: '' },
    });
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
    expect(result.runDataTitle).toBeUndefined();
  });

  it('auto-finds paths when no cache and no workspace folders', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({});
    mockWorkspace.workspaceFolders = [];
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
  });

  it('auto-finds paths when output dir does not exist', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({});
    mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockFs.existsSync.mockReturnValue(false);
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
  });

  it('auto-finds paths when no output_ directories exist', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({});
    mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue([]);
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
  });

  it('auto-finds paths with both files present in latest output dir', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({});
    mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockFs.existsSync.mockImplementation((path: string) => {
      const p = path.replace(/\\/g, '/');
      return p === '/workspace/output' || p.includes('program.json') || p.includes('merged_swimlane.json');
    });
    mockFs.readdirSync.mockReturnValue([
      { name: 'output_001', isDirectory: () => true },
      { name: 'output_002', isDirectory: () => true },
    ]);
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toContain('merged_swimlane.json');
    expect(result.comPath).toContain('program.json');
  });

  it('auto-finds paths when neither file exists in latest dir', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({});
    mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockFs.existsSync.mockImplementation((path: string) => path === '/workspace/output');
    mockFs.readdirSync.mockReturnValue([
      { name: 'output_001', isDirectory: () => true },
    ]);
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
  });

  it('handles error in tryFindLatestOutputPaths', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({});
    mockWorkspace.workspaceFolders = [{ uri: { fsPath: '/workspace' } }];
    mockFs.existsSync.mockImplementation(() => { throw new Error('FS error'); });
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, undefined);
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
  });

  it('returns partial paths when only swimPath provided', async () => {
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath('/swim.json', undefined);
    expect(result.swimPath).toBe('/swim.json');
    expect(result.comPath).toBeUndefined();
  });

  it('returns partial paths when only comPath provided', async () => {
    const fider = new Fider('/code/path');
    const result = await fider.findByCodePath(undefined, '/com.json');
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBe('/com.json');
  });
});

describe('Fider.getCachedPaths - cache miss scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when cachePath is empty', async () => {
    mockUtil.getCachePath.mockReturnValue('');
    const fider = new Fider('/code/path');
    const result = await (fider as any).getCachedPaths();
    expect(result).toBeUndefined();
  });

  it('returns undefined when codePath is not set', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    const fider = new Fider();
    const result = await (fider as any).getCachedPaths();
    expect(result).toBeUndefined();
  });

  it('returns undefined when cache has no entry for codePath', async () => {
    mockUtil.getCachePath.mockReturnValue('/cache/threeViewFiles.json');
    mockUtil.readSwim2ComGraphMap.mockReturnValue({ '/other/path': {} });
    const fider = new Fider('/code/path');
    const result = await (fider as any).getCachedPaths();
    expect(result).toBeUndefined();
  });
});

describe('Fider.selectPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns codePath for editor type', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/test/code.cpp' }]);
    const fider = new Fider();
    const result = await fider.selectPath('editor');
    expect(result.path).toBe('/test/code.cpp');
  });

  it('shows warning when no code file selected', async () => {
    mockWindow.showOpenDialog.mockResolvedValue(undefined);
    const fider = new Fider();
    const result = await fider.selectPath('editor');
    expect(result.path).toBeUndefined();
    expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('pypto.noCodeFileSelect');
  });

  it('returns swimPath for swimGraph type', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/test/swim.json' }]);
    const fider = new Fider();
    const result = await fider.selectPath('swimGraph');
    expect(result.path).toBe('/test/swim.json');
  });

  it('shows warning when no swim file selected', async () => {
    mockWindow.showOpenDialog.mockResolvedValue(undefined);
    const fider = new Fider();
    const result = await fider.selectPath('swimGraph');
    expect(result.path).toBeUndefined();
    expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('pypto.noSwimFileSelect');
  });

  it('returns comPath for comGraph type', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/test/com.json' }]);
    const fider = new Fider();
    const result = await fider.selectPath('comGraph');
    expect(result.path).toBe('/test/com.json');
  });

  it('shows warning when no com file selected', async () => {
    mockWindow.showOpenDialog.mockResolvedValue(undefined);
    const fider = new Fider();
    const result = await fider.selectPath('comGraph');
    expect(result.path).toBeUndefined();
    expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('pypto.noComFileSelect');
  });

  it('returns undefined for unknown graph type', async () => {
    const fider = new Fider();
    const result = await fider.selectPath('unknown');
    expect(result.path).toBeUndefined();
  });
});

describe('Fider.handleUserSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects swim file and auto-finds comPath', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/data/swim.json' }]);
    mockFs.existsSync.mockReturnValue(true);
    const fider = new Fider();
    const result = await fider.handleUserSelect('swimGraph');
    expect(result.swimPath).toBe('/data/swim.json');
    expect(result.comPath).toContain('program.json');
  });

  it('selects swim file but comPath not found', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/data/swim.json' }]);
    mockFs.existsSync.mockReturnValue(false);
    const fider = new Fider();
    const result = await fider.handleUserSelect('swimGraph');
    expect(result.swimPath).toBe('/data/swim.json');
    expect(result.comPath).toBeUndefined();
  });

  it('shows warning when no swim file selected in handleUserSelect', async () => {
    mockWindow.showOpenDialog.mockResolvedValue(undefined);
    const fider = new Fider();
    const result = await fider.handleUserSelect('swimGraph');
    expect(result.swimPath).toBeUndefined();
    expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('pypto.noSwimFileSelect');
  });

  it('selects com file and auto-finds swimPath', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/data/com.json' }]);
    mockFs.existsSync.mockReturnValue(true);
    const fider = new Fider();
    const result = await fider.handleUserSelect('computeGraph');
    expect(result.comPath).toBe('/data/com.json');
    expect(result.swimPath).toContain('merged_swimlane.json');
  });

  it('selects com file (comGraph type) and auto-finds swimPath', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/data/com.json' }]);
    mockFs.existsSync.mockReturnValue(true);
    const fider = new Fider();
    const result = await fider.handleUserSelect('comGraph');
    expect(result.comPath).toBe('/data/com.json');
    expect(result.swimPath).toContain('merged_swimlane.json');
  });

  it('selects com file but swimPath not found', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/data/com.json' }]);
    mockFs.existsSync.mockReturnValue(false);
    const fider = new Fider();
    const result = await fider.handleUserSelect('computeGraph');
    expect(result.comPath).toBe('/data/com.json');
    expect(result.swimPath).toBeUndefined();
  });

  it('shows warning when no com file selected in handleUserSelect', async () => {
    mockWindow.showOpenDialog.mockResolvedValue(undefined);
    const fider = new Fider();
    const result = await fider.handleUserSelect('computeGraph');
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
    expect(mockWindow.showWarningMessage).toHaveBeenCalledWith('pypto.noComFileSelect');
  });

  it('returns undefined paths for unknown graph type', async () => {
    const fider = new Fider();
    const result = await fider.handleUserSelect('unknown');
    expect(result.swimPath).toBeUndefined();
    expect(result.comPath).toBeUndefined();
  });
});

describe('Fider.findComPathBySwimPath / findSwimPathByComPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findComPathBySwimPath handles existsSync error', async () => {
    mockFs.existsSync.mockImplementation(() => { throw new Error('FS error'); });
    const fider = new Fider();
    const result = await (fider as any).findComPathBySwimPath('/data/swim.json');
    expect(result).toBeUndefined();
  });

  it('findSwimPathByComPath handles existsSync error', async () => {
    mockFs.existsSync.mockImplementation(() => { throw new Error('FS error'); });
    const fider = new Fider();
    const result = await (fider as any).findSwimPathByComPath('/data/com.json');
    expect(result).toBeUndefined();
  });
});

describe('Fider.selectFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when dialog returns empty array', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([]);
    const fider = new Fider();
    const result = await (fider as any).selectFile('title', 'json');
    expect(result).toBeUndefined();
  });

  it('returns undefined when dialog returns undefined', async () => {
    mockWindow.showOpenDialog.mockResolvedValue(undefined);
    const fider = new Fider();
    const result = await (fider as any).selectFile('title', 'json');
    expect(result).toBeUndefined();
  });

  it('passes correct filter for cpp type', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/test.cpp' }]);
    const fider = new Fider();
    await (fider as any).selectFile('title', 'cpp');
    const callArgs = mockWindow.showOpenDialog.mock.calls[0][0];
    expect(callArgs.filters).toEqual({
      'pypto.cppFile': ['cpp', 'h', 'hpp', 'py'],
      'pypto.allFile': ['*'],
    });
  });

  it('passes correct filter for py type', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/test.py' }]);
    const fider = new Fider();
    await (fider as any).selectFile('title', 'py');
    const callArgs = mockWindow.showOpenDialog.mock.calls[0][0];
    expect(callArgs.filters).toEqual({
      'pypto.pyFile': ['py'],
      'pypto.allFile': ['*'],
    });
  });

  it('passes correct filter for all type', async () => {
    mockWindow.showOpenDialog.mockResolvedValue([{ fsPath: '/test.txt' }]);
    const fider = new Fider();
    await (fider as any).selectFile('title', 'all');
    const callArgs = mockWindow.showOpenDialog.mock.calls[0][0];
    expect(callArgs.filters).toEqual({ 'pypto.allFile': ['*'] });
  });
});
