/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import initSqlJs from 'sql.js';
import type { SqlJsStatic } from 'sql.js';

import { workspace, Uri, FileType } from 'vscode';
import { SqlStore } from '../../../../../src/core/store/sql-store/sql-store';
import { SqlStoreManager } from '../../../../../src/core/store/sql-store/sql-store-manager';

let SQL: SqlJsStatic;
let dbDir: string;
let stores: SqlStore<any, any, any, any>[] = [];

interface TestItem {
  id: string;
  name: string;
  count: number;
  active: boolean;
}

function makeAttrs() {
  return {
    id: { type: String, isPrimary: true, isQuery: true },
    name: { type: String, isQuery: true },
    count: { type: Number, isQuery: true },
    active: { type: Boolean, isQuery: true, defaultValue: false },
  };
}

function makeStore(storeName: string, attributes = makeAttrs()) {
  const store = new SqlStore<TestItem, typeof attributes>(storeName, attributes as any);
  stores.push(store as any);
  return store;
}

function ready(store: SqlStore<any, any, any, any>): Promise<unknown> {
  return (store as any)._db;
}

function bridgeWorkspaceFs() {
  vi.mocked(workspace.fs.readFile).mockImplementation(async (uri: any) => fs.readFileSync(uri.fsPath));
  vi.mocked(workspace.fs.writeFile).mockImplementation(async (uri: any, content: any) => {
    fs.writeFileSync(uri.fsPath, Buffer.from(content));
  });
  vi.mocked(workspace.fs.delete).mockImplementation(async (uri: any, opts?: any) => {
    fs.rmSync(uri.fsPath, { recursive: opts?.recursive ?? false, force: true });
  });
  vi.mocked(workspace.fs.createDirectory).mockImplementation(async (uri: any) => {
    fs.mkdirSync(uri.fsPath, { recursive: true });
  });
  vi.mocked(workspace.fs.stat).mockImplementation(async (uri: any) => {
    const stat = fs.statSync(uri.fsPath);
    return { type: stat.isDirectory() ? FileType.Directory : FileType.File } as any;
  });
}

describe('SqlStore', () => {
  beforeAll(async () => {
    SQL = await initSqlJs();
    dbDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'sql-store-test-'));
  });

  afterAll(() => {
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    stores.forEach((store) => store.dispose());
    stores = [];
    fs.rmSync(dbDir, { recursive: true, force: true });
    fs.mkdirSync(dbDir, { recursive: true });
    bridgeWorkspaceFs();

    const fakeManager = {
      toUri: (...paths: string[]) => Uri.file([dbDir, ...paths].join('/')),
      openDatabase: async (store: SqlStore<any, any, any, any>) => {
        const file = nodePath.join(dbDir, `${store.storeName}.db`);
        let data = new Uint8Array();
        try {
          data = new Uint8Array(fs.readFileSync(file));
        } catch {
          // 新库
        }
        const database = new SQL.Database(data);
        Reflect.set(database, 'save', () => {
          fs.writeFileSync(file, Buffer.from(database.export()));
        });
        return database;
      },
      closeDatabase: () => {},
    };
    vi.spyOn(SqlStoreManager, 'getInstance').mockReturnValue(fakeManager as unknown as SqlStoreManager);
  });

  it('throws when no primary key is defined', () => {
    expect(
      () =>
        new SqlStore('no_primary', {
          id: { type: String, isQuery: true },
        } as any),
    ).toThrow('未设置主键');
  });

  it('roundtrips set and find', async () => {
    const store = makeStore('roundtrip');
    const item: TestItem = { id: '1', name: 'first', count: 5, active: true };

    await store.set(item);

    expect(await store.find({ id: '1' })).toEqual(item);
  });

  it('overwrites item with same primary key', async () => {
    const store = makeStore('overwrite');

    await store.set({ id: '1', name: 'old', count: 1, active: false });
    await store.set({ id: '1', name: 'new', count: 2, active: true });

    const found = await store.find({ id: '1' });
    expect(found?.name).toBe('new');
    expect(await store.query().count()).toBe(1);
  });

  it('returns undefined when finding a missing item', async () => {
    const store = makeStore('missing');

    expect(await store.find({ id: '404' })).toBeUndefined();
  });

  it('queries with filter conditions', async () => {
    const store = makeStore('query_filter');
    await store.set({ id: '1', name: 'alpha', count: 1, active: true });
    await store.set({ id: '2', name: 'beta', count: 2, active: false });
    await store.set({ id: '3', name: 'alpha2', count: 3, active: true });

    const result = await store.query().filter({ active: true }).exec();

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.id).sort()).toEqual(['1', '3']);
  });

  it('sorts, slices and counts', async () => {
    const store = makeStore('query_sort');
    for (let i = 1; i <= 10; i++) {
      await store.set({ id: String(i), name: `item${i}`, count: i, active: true });
    }

    const page = await store.query().sort('count', 'desc').slice(0, 3).exec();
    expect(page.map((item) => item.count)).toEqual([10, 9, 8]);

    expect(await store.query().sort('count', 'asc').count()).toBe(10);
  });

  it('deletes rows and data files via query delete', async () => {
    const store = makeStore('query_delete');
    await store.set({ id: '1', name: 'a', count: 1, active: true });
    await store.set({ id: '2', name: 'b', count: 2, active: false });

    const deleted = await store.query().filter({ active: true }).delete();

    expect(deleted).toBe(1);
    expect(await store.query().count()).toBe(1);
  });

  it('delete returns true once then false', async () => {
    const store = makeStore('delete_once');
    await store.set({ id: '1', name: 'a', count: 1, active: true });

    expect(await store.delete({ id: '1' })).toBe(true);
    expect(await store.delete({ id: '1' })).toBe(false);
  });

  it('batchSet commits all items across batches', async () => {
    const store = makeStore('batch');
    const items: TestItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `item${i}`,
      count: i,
      active: i % 2 === 0,
    }));

    await store.batchSet(items, 2);

    expect(await store.query().count()).toBe(5);
    expect(await store.find({ id: '4' })).toEqual(items[4]);
  });

  it('batchSet rolls back the batch on SQL error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = makeStore('rollback');
    await store.set({ id: 'seed', name: 'seed', count: 0, active: false });

    await expect(
      store.batchSet([
        { id: 'bad', name: "it's broken", count: 1, active: true },
        { id: 'good', name: 'good', count: 2, active: true },
      ]),
    ).rejects.toThrow();

    expect(await store.query().count()).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('clear removes all rows and fires onClear listeners', async () => {
    const store = makeStore('clear');
    await store.set({ id: '1', name: 'a', count: 1, active: true });
    await store.set({ id: '2', name: 'b', count: 2, active: false });
    const onClear = vi.fn();
    store.onClear(onClear);

    await store.clear();

    expect(await store.query().count()).toBe(0);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('re-initializing the database keeps persisted data', async () => {
    const store = makeStore('reinit');
    await store.set({ id: '1', name: 'persisted', count: 7, active: true });

    await store.initializeDb();

    expect(await store.find({ id: '1' })).toMatchObject({ name: 'persisted', count: 7 });
  });

  it('rebuilds the table when attributes change', async () => {
    const oldStore = makeStore('migrate');
    await oldStore.set({ id: '1', name: 'legacy', count: 1, active: true });
    oldStore.dispose();

    const changedAttrs = {
      id: { type: String, isPrimary: true, isQuery: true },
      name: { type: String, isQuery: true },
      count: { type: Number, isQuery: true },
      active: { type: Boolean, isQuery: true, defaultValue: false },
      extra: { type: String, isQuery: true },
    };
    const newStore = makeStore('migrate', changedAttrs as any);

    expect(await newStore.find({ id: '1' })).toBeUndefined();
    expect(await newStore.query().count()).toBe(0);

    await newStore.set({ id: '2', name: 'new-schema', count: 1, active: false, extra: 'e' });
    expect(await newStore.find({ id: '2' })).toMatchObject({ extra: 'e' });
  });
});
