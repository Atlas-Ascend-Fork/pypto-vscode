/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You should not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

import { workspace, Uri, FileType } from 'vscode';
import { SqlStoreManager, SQL_DATABASE_NAME } from '../../../../../src/core/store/sql-store/sql-store-manager';

let rootDir: string;

function bridgeWorkspaceFs() {
  vi.mocked(workspace.fs.createDirectory).mockImplementation(async (uri: any) => fs.mkdirSync(uri.fsPath, { recursive: true }));
  vi.mocked(workspace.fs.writeFile).mockImplementation(async (uri: any, content: any) => {
    fs.writeFileSync(uri.fsPath, Buffer.from(content));
  });
  vi.mocked(workspace.fs.readFile).mockImplementation(async (uri: any) => {
    if (!fs.existsSync(uri.fsPath)) {
      throw new Error('ENOENT');
    }
    return new Uint8Array(fs.readFileSync(uri.fsPath));
  });
  vi.mocked(workspace.fs.delete).mockImplementation(async (uri: any, opts?: any) => {
    fs.rmSync(uri.fsPath, { recursive: opts?.recursive ?? false, force: true });
  });
  vi.mocked(workspace.fs.stat).mockImplementation(async (uri: any) => {
    const stat = fs.statSync(uri.fsPath);
    return { type: stat.isDirectory() ? FileType.Directory : FileType.File } as any;
  });
}

function makeFakeStore(storeName: string, version = 0) {
  return {
    storeName,
    version,
    clear: vi.fn().mockResolvedValue(undefined),
    initializeDb: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('SqlStoreManager', () => {
  let manager: SqlStoreManager;

  beforeAll(() => {
    rootDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'sql-manager-test-'));
  });

  afterAll(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.mkdirSync(rootDir, { recursive: true });
    bridgeWorkspaceFs();
    manager = new SqlStoreManager({ globalStorageUri: Uri.file(rootDir) } as any);
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('registers itself as the singleton instance', () => {
    expect(SqlStoreManager.getInstance()).toBe(manager);
  });

  it('toUri resolves paths inside the sql-store directory', () => {
    const uri = manager.toUri('sub', 'file.json');
    expect(uri.fsPath.replace(/\\/g, '/')).toBe(`${rootDir}/${SQL_DATABASE_NAME}/sub/file.json`.replace(/\\/g, '/'));
  });

  it('openDatabase initializes manager table and creates store database', async () => {
    const store = makeFakeStore('first_store', 0);

    const db = await manager.openDatabase(store);
    const managerDb = await (manager as any)._db;

    expect(db).toBeDefined();
    const managerTable = managerDb.exec('SELECT * FROM sql_store_manager');
    expect(managerTable[0].values).toEqual([['first_store', 0, expect.any(String)]]);
    expect(store.clear).not.toHaveBeenCalled();
  });

  it('persists store database to disk after save and debounce', async () => {
    const store = makeFakeStore('persisted_store', 0);
    const db = await manager.openDatabase(store);

    db!.run('CREATE TABLE demo (id TEXT)');
    db!.run("INSERT INTO demo VALUES ('x')");
    db!.save();
    await vi.advanceTimersByTimeAsync(150);

    const dbFile = nodePath.join(rootDir, SQL_DATABASE_NAME, 'persisted_store.db');
    expect(fs.existsSync(dbFile)).toBe(true);
  });

  it('reopens persisted database content for the same store name', async () => {
    const store = makeFakeStore('reopen_store', 0);
    const first = await manager.openDatabase(store);
    first!.run('CREATE TABLE demo (id TEXT)');
    first!.run("INSERT INTO demo VALUES ('x')");
    first!.save();
    await vi.advanceTimersByTimeAsync(150);
    manager.closeDatabase(store);

    const second = await manager.openDatabase(store);
    const rows = second!.exec('SELECT * FROM demo');
    expect(rows[0].values).toEqual([['x']]);
  });

  it('clears the store and starts an empty database when version changes', async () => {
    const oldStore = makeFakeStore('versioned_store', 1);
    const oldDb = await manager.openDatabase(oldStore);
    oldDb!.run('CREATE TABLE demo (id TEXT)');
    oldDb!.save();
    await vi.advanceTimersByTimeAsync(150);
    manager.closeDatabase(oldStore);

    const newStore = makeFakeStore('versioned_store', 2);
    const newDb = await manager.openDatabase(newStore);
    const managerDb = await (manager as any)._db;

    expect(newStore.clear).toHaveBeenCalled();
    expect(managerDb.exec('SELECT * FROM sql_store_manager')[0].values[0][1]).toBe(2);
    expect(newDb!.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='demo'")).toHaveLength(0);
  });

  it('closeDatabase closes the database and re-opens cleanly', async () => {
    const store = makeFakeStore('close_store', 0);
    const db = await manager.openDatabase(store);

    manager.closeDatabase(store);

    expect(() => db!.exec('SELECT * FROM sql_store_manager')).toThrow();
    const reopened = await manager.openDatabase(store);
    expect(reopened).toBeDefined();
  });

  it('clearAllSqlStore removes the db directory and re-initializes opened stores', async () => {
    const store = makeFakeStore('cleared_store', 0);
    await manager.openDatabase(store);
    const dbDir = nodePath.join(rootDir, SQL_DATABASE_NAME);
    expect(fs.existsSync(dbDir)).toBe(true);

    await manager.clearAllSqlStore();

    expect(fs.existsSync(dbDir)).toBe(false);
    expect(store.initializeDb).toHaveBeenCalled();
  });
});
