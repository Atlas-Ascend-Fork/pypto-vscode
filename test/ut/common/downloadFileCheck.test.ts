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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        access: vi.fn(),
        stat: vi.fn(),
      },
    },
    promises: {
      access: vi.fn(),
      stat: vi.fn(),
    },
  };
});

import { workspace, window, Uri } from 'vscode';
import * as fs from 'fs';
import { getCurrentPlatform, checkFilePath, saveFile, waitForFileCreation, promptSaveFile } from '../../../src/common/downloadFileCheck';

describe('getCurrentPlatform', () => {
  const platformMappings: [string, string][] = [
    ['win32', 'windows'],
    ['linux', 'linux'],
    ['darwin', 'macos'],
    ['freebsd', 'unknown'],
  ];

  it.each(platformMappings)('maps %s to %s', (nodePlatform, expected) => {
    vi.stubGlobal('process', { ...process, platform: nodePlatform });
    expect(getCurrentPlatform()).toBe(expected);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});

describe('checkFilePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns result true for valid existing directory', async () => {
    vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
    vi.mocked(fs.promises.stat).mockResolvedValueOnce({ isDirectory: () => true } as any);
    const result = await checkFilePath({ filePath: '/valid/path' });
    expect(result.result).toBe(true);
  });

  it('returns result false for empty path', async () => {
    const result = await checkFilePath({ filePath: '' });
    expect(result.result).toBe(false);
  });

  it('returns result false for non-absolute path', async () => {
    const result = await checkFilePath({ filePath: 'relative/path' });
    expect(result.result).toBe(false);
  });

  it('returns result false when directory does not exist', async () => {
    vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error('ENOENT'));
    const result = await checkFilePath({ filePath: '/nonexistent/path' });
    expect(result.result).toBe(false);
  });
});

describe('saveFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls promptSaveFile and downloads when fileName is provided', async () => {
    vi.mocked(window.showSaveDialog).mockResolvedValueOnce({ fsPath: '/save/output.svg' } as any);
    vi.mocked(workspace.fs.writeFile).mockResolvedValueOnce(undefined);
    const result = await saveFile({ dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', fileName: 'output' });
    expect(result?.result).toBe(true);
  });

  it('returns undefined when user cancels save dialog', async () => {
    vi.mocked(window.showSaveDialog).mockResolvedValueOnce(undefined);
    const result = await saveFile({ dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', fileName: 'output' });
    expect(result).toBeUndefined();
  });

  it('saves directly when filePath is provided', async () => {
    vi.mocked(workspace.fs.writeFile).mockResolvedValueOnce(undefined);
    const result = await saveFile({ dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', filePath: '/save/output.svg' });
    expect(result?.result).toBe(true);
  });
});

describe('promptSaveFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls showSaveDialog and returns uri', async () => {
    const mockUri = { fsPath: '/save/file.svg' };
    vi.mocked(window.showSaveDialog).mockResolvedValueOnce(mockUri as any);
    const result = await promptSaveFile('my-file');
    expect(result).toEqual(mockUri);
  });

  it('returns undefined when user cancels', async () => {
    vi.mocked(window.showSaveDialog).mockResolvedValueOnce(undefined);
    const result = await promptSaveFile('my-file');
    expect(result).toBeUndefined();
  });
});

describe('waitForFileCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves true when file is created before timeout', async () => {
    let createCallback: ((uri: any) => void) | undefined;
    vi.mocked(workspace.createFileSystemWatcher).mockReturnValueOnce({
      onDidCreate: vi.fn((cb) => {
        createCallback = cb;
        return { dispose: vi.fn() };
      }),
      onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    } as any);

    const uri = Uri.file('/test/newfile.json');
    const promise = waitForFileCreation(uri, 5000);

    createCallback!({ fsPath: '/test/newfile.json' });

    await expect(promise).resolves.toBe(true);
  });

  it('resolves false on timeout', async () => {
    vi.mocked(workspace.createFileSystemWatcher).mockReturnValueOnce({
      onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
      onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    } as any);

    const uri = Uri.file('/test/newfile.json');
    const promise = waitForFileCreation(uri, 100);

    vi.advanceTimersByTime(200);

    await expect(promise).resolves.toBe(false);
  });
});
