/**
 * Copyright (c) 2026 Huawei Technologies Co., Ltd.
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as readline from 'readline';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) };
});

vi.mock('readline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('readline')>();
  return { ...actual, createInterface: vi.fn(actual.createInterface) };
});

vi.mock('csv-parse/sync', () => ({ parse: vi.fn() }));
vi.mock('../../../src/core/sqliteCache', () => ({ SQLiteCache: {} }));
vi.mock('../../../src/common/accurancyAnylasis', () => ({ getSortedVerifyFiles: vi.fn() }));

import { SmartLogExtractor } from '../../../src/common/csvReader';

interface TrackedExtraction {
  input: fs.ReadStream;
  reader: readline.Interface;
  state: { settlements: number; inputCloses: number; readerCloses: number };
  outcome: Promise<{ status: string; lines: unknown; error: unknown }>;
}

describe('SmartLogExtractor stream lifecycle', () => {
  let tempRoot: string;
  let tempParent: string;
  let active: TrackedExtraction[];

  beforeEach(() => {
    vi.clearAllMocks();
    tempParent = fs.realpathSync(os.tmpdir());
    tempRoot = fs.mkdtempSync(path.join(tempParent, 'pypto-smart-log-'));
    active = [];
  });

  afterEach(async () => {
    for (const item of active) {
      item.reader.close();
      item.input.destroy();
    }
    await vi.waitFor(() => {
      for (const item of active) expect(item.input.closed).toBe(true);
    });
    expect(path.dirname(fs.realpathSync(tempRoot))).toBe(tempParent);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function track(filePath: string): TrackedExtraction {
    const operation = new SmartLogExtractor().extract(filePath, '[START]', '[END]');
    const input = vi.mocked(fs.createReadStream).mock.results.at(-1)!.value as fs.ReadStream;
    const reader = vi.mocked(readline.createInterface).mock.results.at(-1)!.value as readline.Interface;
    const state = { settlements: 0, inputCloses: 0, readerCloses: 0 };
    input.on('close', () => state.inputCloses++);
    reader.on('close', () => state.readerCloses++);
    const outcome = operation.then(
      (lines) => {
        state.settlements++;
        return { status: 'resolved', lines, error: undefined };
      },
      (error) => {
        state.settlements++;
        return { status: 'rejected', lines: undefined, error };
      },
    );
    const item = { input, reader, state, outcome };
    active.push(item);
    return item;
  }

  function logFile(contents: string) {
    const filePath = path.join(tempRoot, 'input.log');
    fs.writeFileSync(filePath, contents, 'utf8');
    return filePath;
  }

  async function expectClosed(item: TrackedExtraction) {
    await vi.waitFor(() => {
      expect(item.input.closed).toBe(true);
      expect(item.state.inputCloses).toBe(1);
    });
    expect((item.reader as any).closed).toBe(true);
    expect(item.state.readerCloses).toBe(1);
    expect(item.state.settlements).toBe(1);
  }

  it.each([
    ['matching end', '[START] section\ndata\n[END]\nignored\n', ['[START] section', 'data']],
    ['EOF', '[START] section\ndata\n', ['[START] section', 'data']],
    ['empty input', '', []],
  ])('preserves extraction for %s and closes both resources', async (_label, contents, expected) => {
    const item = track(logFile(contents as string));
    const outcome = await item.outcome;
    expect(outcome.status).toBe('resolved');
    expect(outcome.lines).toEqual(expected);
    await expectClosed(item);
  });

  it.skipIf(!['linux', 'darwin', 'win32'].includes(process.platform))('rejects a real directory read error', async () => {
    const directory = path.join(tempRoot, 'directory.log');
    fs.mkdirSync(directory);
    const item = track(directory);
    const outcome = await item.outcome;
    expect(outcome.status).toBe('rejected');
    expect(outcome.error).toMatchObject({ code: 'EISDIR' });
    await expectClosed(item);
  });

  it('rejects a real open error after the existence check and closes both resources', async () => {
    const filePath = logFile('[START] section\ndata\n');
    const actual = await vi.importActual<typeof import('fs')>('fs');
    vi.mocked(fs.createReadStream).mockImplementationOnce((inputPath, options) => {
      const input = actual.createReadStream(inputPath, options);
      fs.unlinkSync(filePath);
      return input;
    });
    const item = track(filePath);
    const outcome = await item.outcome;
    expect(outcome.status).toBe('rejected');
    expect(outcome.error).toMatchObject({ code: 'ENOENT' });
    await expectClosed(item);
  });

  it.each(['stream', 'interface'])('settles once when %s errors before the other channel', async (first) => {
    const item = track(logFile('[START] section\ndata\n'));
    const initial = new Error('first read failure');
    const later = new Error('later read failure');
    if (first === 'stream') {
      expect(() => item.input.emit('error', initial)).not.toThrow();
      expect(() => item.reader.emit('error', later)).not.toThrow();
    } else {
      expect(() => item.reader.emit('error', initial)).not.toThrow();
      expect(() => item.input.emit('error', later)).not.toThrow();
    }
    const outcome = await item.outcome;
    expect(outcome.status).toBe('rejected');
    expect(outcome.error).toBe(initial);
    await expectClosed(item);
  });

  it('absorbs later errors after successful early completion', async () => {
    const item = track(logFile('[START] section\ndata\n[END]\n'));
    expect((await item.outcome).status).toBe('resolved');
    await expectClosed(item);
    expect(() => item.input.emit('error', new Error('late input error'))).not.toThrow();
    expect(() => item.reader.emit('error', new Error('late interface error'))).not.toThrow();
    expect(item.state.settlements).toBe(1);
  });
});
