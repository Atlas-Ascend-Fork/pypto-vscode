/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workspace, Uri, FileType } from 'vscode';
import {
  TARGET_CONFIG_FILE,
  SOURCE_SCHEMA_FILE,
  PLUGIN_SCHEMA_NAME,
  TRANSFORMED_SCHEMA_DIR,
} from '../../../../src/services/schema-config/run-config-language-features';

const jsonGet = vi.fn();
const jsonUpdate = vi.fn();
let schemasSetting: any[] | undefined;

let dirListing: Record<string, [string, number][]>;
let fileContents: Record<string, string>;

function normalizePath(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') {
      continue;
    }
    if (seg === '..') {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return '/' + parts.join('/');
}

function bridgeFs() {
  vi.mocked(workspace.fs.readDirectory).mockImplementation(async (uri: any) => {
    const listing = dirListing[normalizePath(uri.fsPath)];
    if (!listing) {
      throw Object.assign(new Error(`ENOENT ${uri.fsPath}`), { code: 'ENOENT' });
    }
    return listing as any;
  });
  vi.mocked(workspace.fs.readFile).mockImplementation(async (uri: any) => {
    const content = fileContents[normalizePath(uri.fsPath)];
    if (content === undefined) {
      throw new Error('ENOENT');
    }
    return Buffer.from(content);
  });
  vi.mocked(workspace.fs.writeFile).mockImplementation(async (uri: any, content: any) => {
    const p = normalizePath(uri.fsPath);
    fileContents[p] = content.toString();
    const dir = p.slice(0, p.lastIndexOf('/'));
    const name = p.slice(p.lastIndexOf('/') + 1);
    dirListing[dir] = [...(dirListing[dir] ?? []), [name, FileType.File]];
  });
  vi.mocked(workspace.fs.delete).mockImplementation(async (uri: any) => {
    const p = normalizePath(uri.fsPath);
    delete fileContents[p];
    for (const d of Object.keys(dirListing)) {
      dirListing[d] = dirListing[d].filter(([n]) => normalizePath(`${d}/${n}`) !== p);
    }
  });
  vi.mocked(workspace.fs.createDirectory).mockImplementation(async (uri: any) => {
    const p = normalizePath(uri.fsPath);
    if (!dirListing[p]) {
      dirListing[p] = [];
    }
  });
  vi.mocked(workspace.fs.stat).mockImplementation(async (uri: any) => {
    const p = normalizePath(uri.fsPath);
    if (fileContents[p] !== undefined) {
      return { type: FileType.File } as any;
    }
    if (dirListing[p] !== undefined) {
      return { type: FileType.Directory } as any;
    }
    const parent = p.slice(0, p.lastIndexOf('/'));
    const name = p.slice(p.lastIndexOf('/') + 1);
    const entry = (dirListing[parent] ?? []).find(([n]) => n === name);
    if (entry) {
      return { type: entry[1] } as any;
    }
    throw new Error('ENOENT');
  });
}

const schemaJson = JSON.stringify({
  type: 'object',
  properties: {
    pass: {
      type: 'double',
      label: { zh: '通道', en: 'Pass' },
      options: [{ label: { zh: '选项甲', en: 'OptionA' }, value: 'a' }],
    },
  },
});

function setupWorkspace() {
  (workspace as any).workspaceFolders = [{ uri: Uri.file('/ws'), name: 'ws' }];
  dirListing = {
    '/ws': [
      [TARGET_CONFIG_FILE, FileType.File],
      [SOURCE_SCHEMA_FILE, FileType.File],
      ['node_modules', FileType.Directory],
      ['sub', FileType.Directory],
    ],
    '/ws/node_modules': [['evil.json', FileType.File]],
    '/ws/sub': [
      [TARGET_CONFIG_FILE, FileType.File],
      [SOURCE_SCHEMA_FILE, FileType.File],
    ],
    [`/globalStorage/${TRANSFORMED_SCHEMA_DIR}`]: [],
  };
  fileContents = {
    [`/ws/${SOURCE_SCHEMA_FILE}`]: schemaJson,
    [`/ws/sub/${SOURCE_SCHEMA_FILE}`]: schemaJson,
  };
}

function lastListener(fn: any) {
  return vi.mocked(fn).mock.calls.at(-1)![0] as (e: any) => any;
}

describe('RunConfigLanguageFeaturesService', () => {
  let service: any;
  let consoleLogSpy: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    schemasSetting = undefined;
    jsonGet.mockImplementation(() => schemasSetting);
    jsonUpdate.mockImplementation(async (_key: string, value: any[]) => {
      schemasSetting = value;
    });
    vi.mocked(workspace.getConfiguration).mockImplementation((() => ({ get: jsonGet, update: jsonUpdate })) as any);
    setupWorkspace();
    bridgeFs();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    const mod = await import('../../../../src/services/schema-config/run-config-language-features');
    service = new mod.RunConfigLanguageFeaturesService({ globalStorageUri: Uri.file('/globalStorage') } as any);
  });

  afterEach(() => {
    service?.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
    (workspace as any).workspaceFolders = undefined;
  });

  it('exports expected constants', () => {
    expect(TARGET_CONFIG_FILE).toBe('tile_fwk_config.json');
    expect(SOURCE_SCHEMA_FILE).toBe('tile_fwk_config_schema.json');
    expect(PLUGIN_SCHEMA_NAME).toBe('PYPTO TOOLKIT Config Schema');
  });

  it('completes scan without doing anything when no workspace folders', async () => {
    (workspace as any).workspaceFolders = undefined;

    await vi.advanceTimersByTimeAsync(300);

    expect((service as any)._scanStatus).toBe('completed');
    expect(jsonUpdate).not.toHaveBeenCalled();
  });

  it('scans workspace via BFS, skips ignore dirs and registers config-schema pairs', async () => {
    await vi.advanceTimersByTimeAsync(300);

    expect((service as any)._scanStatus).toBe('completed');
    expect((service as any)._configSchemaMap).toHaveLength(2);
    expect(consoleLogSpy).not.toHaveBeenCalled();

    const lastUpdate = jsonUpdate.mock.calls.at(-1);
    expect(lastUpdate![0]).toBe('schemas');
    const registered = lastUpdate![1].filter((s: any) => s.name === PLUGIN_SCHEMA_NAME);
    expect(registered).toHaveLength(2);
      expect(registered.map((s: any) => s.fileMatch[0]).sort()).toEqual([`/ws/sub/${TARGET_CONFIG_FILE}`, `/ws/${TARGET_CONFIG_FILE}`]);

    const transformedFiles = Object.keys(fileContents).filter((k) => k.startsWith(`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/`));
    expect(transformedFiles).toHaveLength(2);
    const transformed = JSON.parse(fileContents[transformedFiles[0]]);
    expect(transformed.properties.pass.type).toBe('number');
    expect(transformed.properties.pass.description).toBe('Pass');
  });

  it('debounces repeated scan requests', async () => {
    const spy = vi.spyOn(service as any, '_doScanWorkspace');

    service.scanWorkspace();
    service.scanWorkspace();
    service.scanWorkspace();
    await vi.advanceTimersByTimeAsync(300);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('honors custom debounce delay', async () => {
    const spy = vi.spyOn(service as any, '_doScanWorkspace');

    service.scanWorkspace(1000);
    await vi.advanceTimersByTimeAsync(999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('logs scan errors for non-canceled failures and keeps scanning', async () => {
    dirListing['/ws/ghost'] = undefined as any;
    dirListing['/ws'] = [...dirListing['/ws'], ['ghost', FileType.Directory]];
    const readDirectory = vi.mocked(workspace.fs.readDirectory);

    await vi.advanceTimersByTimeAsync(300);

    expect(consoleLogSpy).toHaveBeenCalled();
    expect((service as any)._scanStatus).toBe('completed');
    expect((service as any)._configSchemaMap).toHaveLength(2);

    readDirectory.mockRestore();
  });

  it('silences Canceled scan errors', async () => {
    const readDirectory = vi.mocked(workspace.fs.readDirectory);
    readDirectory.mockRejectedValueOnce(new Error('Canceled'));

    await vi.advanceTimersByTimeAsync(300);

    expect(consoleLogSpy).not.toHaveBeenCalled();
    readDirectory.mockRestore();
  });

  it('stops scanning after dispose', async () => {
    service.dispose();

    await vi.advanceTimersByTimeAsync(300);

    expect((service as any)._scanStatus).toBe('idle');
    expect((service as any)._isDisposed).toBe(true);
  });

  describe('transformSchema', () => {
    it('maps custom types and labels to english descriptions', () => {
      const raw = {
        properties: {
          a: { type: 'double', label: { zh: '甲', en: 'A' } },
          b: { type: 'float', label: { zh: '乙', en: 'B' } },
          c: { type: 'int', label: { zh: '丙', en: 'C' } },
          d: { type: 'string' },
        },
      };

      const result = (service as any).transformSchema(raw, 'en');

      expect(result.properties.a).toEqual({ type: 'number', description: 'A' });
      expect(result.properties.b).toEqual({ type: 'number', description: 'B' });
      expect(result.properties.c).toEqual({ type: 'integer', description: 'C' });
      expect(result.properties.d).toEqual({ type: 'string' });
    });

    it('uses chinese labels for zh language and converts option labels', () => {
      const raw = {
        type: 'object',
        options: [{ label: { zh: '选项', en: 'Opt' }, value: 'a' }],
      };

      const result = (service as any).transformSchema(raw, 'zh');

      expect(result.options[0].description).toBe('选项');
      expect(result.options[0].label).toBeUndefined();
    });

    it('passes through null and array values', () => {
      const result = (service as any).transformSchema({ list: [1, { type: 'int', label: { zh: 'x', en: 'y' } }], nothing: null }, 'en');
      expect(result.list[0]).toBe(1);
      expect(result.list[1].type).toBe('integer');
      expect(result.nothing).toBeNull();
    });
  });

  describe('file listeners', () => {
    it('re-scans when workspace folders change', async () => {
      const spy = vi.spyOn(service as any, '_doScanWorkspace');
      const listener = lastListener(workspace.onDidChangeWorkspaceFolders);

      listener();
      await vi.advanceTimersByTimeAsync(300);

      expect(spy).toHaveBeenCalled();
    });

    it('registers schemas for created config files', async () => {
      dirListing['/ws/new'] = [
        [TARGET_CONFIG_FILE, FileType.File],
        [SOURCE_SCHEMA_FILE, FileType.File],
      ];
      fileContents[`/ws/new/${SOURCE_SCHEMA_FILE}`] = schemaJson;
      const listener = lastListener(workspace.onDidCreateFiles);

      await listener({ files: [Uri.file(`/ws/new/${TARGET_CONFIG_FILE}`)] });

      expect((service as any)._configSchemaMap).toHaveLength(1);
      expect(jsonUpdate).toHaveBeenCalled();
      const registered = jsonUpdate.mock.calls.at(-1)![1].filter((s: any) => s.name === PLUGIN_SCHEMA_NAME);
      expect(registered[0].fileMatch[0]).toBe(`/ws/new/${TARGET_CONFIG_FILE}`);
    });

    it('registers schemas for created directories containing target files', async () => {
      dirListing['/ws/newdir'] = [
        [TARGET_CONFIG_FILE, FileType.File],
        [SOURCE_SCHEMA_FILE, FileType.File],
      ];
      fileContents[`/ws/newdir/${SOURCE_SCHEMA_FILE}`] = schemaJson;
      const listener = lastListener(workspace.onDidCreateFiles);

      await listener({ files: [Uri.file('/ws/newdir')] });

      expect((service as any)._configSchemaMap).toHaveLength(1);
    });

    it('ignores create events for unrelated files', async () => {
      const listener = lastListener(workspace.onDidCreateFiles);

      await listener({ files: [Uri.file('/ws/unrelated.txt')] });

      expect((service as any)._configSchemaMap).toHaveLength(0);
      expect(jsonUpdate).not.toHaveBeenCalled();
    });

    it('removes registrations for deleted config files', async () => {
      (service as any)._configSchemaMap = [
        {
          configUri: Uri.file(`/ws/proj/${TARGET_CONFIG_FILE}`),
          sourceSchemaUri: Uri.file(`/ws/proj/${SOURCE_SCHEMA_FILE}`),
          transformedSchemaUri: Uri.file(`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/old.json`),
          workspaceName: 'ws',
        },
      ];
      fileContents[`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/old.json`] = '{}';
      schemasSetting = [{ name: PLUGIN_SCHEMA_NAME, fileMatch: [`/ws/proj/${TARGET_CONFIG_FILE}`] }];
      const listener = lastListener(workspace.onDidDeleteFiles);

      await listener({ files: [Uri.file(`/ws/proj/${TARGET_CONFIG_FILE}`)] });

      expect((service as any)._configSchemaMap).toHaveLength(0);
      expect(jsonUpdate).toHaveBeenCalledWith('schemas', [], 2, true);
      expect(fileContents[`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/old.json`]).toBeUndefined();
    });

    it('keeps registrations when deleting unrelated files', async () => {
      (service as any)._configSchemaMap = [
        {
          configUri: Uri.file(`/ws/proj/${TARGET_CONFIG_FILE}`),
          sourceSchemaUri: Uri.file(`/ws/proj/${SOURCE_SCHEMA_FILE}`),
          transformedSchemaUri: Uri.file(`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/old.json`),
          workspaceName: 'ws',
        },
      ];
      const listener = lastListener(workspace.onDidDeleteFiles);

      await listener({ files: [Uri.file('/ws/other/file.txt')] });

      expect((service as any)._configSchemaMap).toHaveLength(1);
      expect(jsonUpdate).not.toHaveBeenCalled();
    });

    it('moves registrations on rename', async () => {
      (service as any)._configSchemaMap = [
        {
          configUri: Uri.file(`/ws/old/${TARGET_CONFIG_FILE}`),
          sourceSchemaUri: Uri.file(`/ws/old/${SOURCE_SCHEMA_FILE}`),
          transformedSchemaUri: Uri.file(`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/old.json`),
          workspaceName: 'ws',
        },
      ];
      fileContents[`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/old.json`] = '{}';
      schemasSetting = [{ name: PLUGIN_SCHEMA_NAME, fileMatch: [`/ws/old/${TARGET_CONFIG_FILE}`] }];
      dirListing['/ws/moved'] = [
        [TARGET_CONFIG_FILE, FileType.File],
        [SOURCE_SCHEMA_FILE, FileType.File],
      ];
      fileContents[`/ws/moved/${SOURCE_SCHEMA_FILE}`] = schemaJson;
      const listener = lastListener(workspace.onDidRenameFiles);

      await listener({ files: [{ oldUri: Uri.file(`/ws/old/${TARGET_CONFIG_FILE}`), newUri: Uri.file(`/ws/moved/${TARGET_CONFIG_FILE}`) }] });

      const map = (service as any)._configSchemaMap;
      expect(map).toHaveLength(1);
      expect(map[0].configUri.path).toBe(`/ws/moved/${TARGET_CONFIG_FILE}`);
    });
  });

  describe('dispose cleanup', () => {
    it('removes transformed schema files from global storage', async () => {
      await vi.advanceTimersByTimeAsync(300);
      const before = Object.keys(fileContents).filter((k) => k.startsWith(`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/`));
      expect(before.length).toBeGreaterThan(0);

      service.dispose();
      await vi.runAllTimersAsync();

      const after = Object.keys(fileContents).filter((k) => k.startsWith(`/globalStorage/${TRANSFORMED_SCHEMA_DIR}/`));
      expect(after).toHaveLength(0);
    });
  });
});
