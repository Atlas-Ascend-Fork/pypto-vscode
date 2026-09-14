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
import type { Database, SqlJsStatic } from 'sql.js';
import initSqlJs from 'sql.js';
import * as vscode from 'vscode';
import { existsSync } from 'fs';

import type { SqlStore } from './sql-store';

export const SQL_DATABASE_NAME = 'sql-store';

const SQL_MANAGER_TABLE = 'sql_store_manager';

export type SqlStoreDatabase = Database & { save: () => void };

export class SqlStoreManager extends vscode.Disposable {
  // 单例模式
  private static instance: SqlStoreManager;
  public static getInstance(): SqlStoreManager {
    return this.instance;
  }

  private _sql: SqlJsStatic;

  private _db: Promise<Database>;

  private _dbDirUri: vscode.Uri;

  private _openedStores = new Set<SqlStore<any>>();

  private _openedDatabases = new WeakMap<SqlStore<any>, Database>();

  constructor(extensionContext: vscode.ExtensionContext) {
    super(() => {});
    SqlStoreManager.instance = this;
    this._dbDirUri = vscode.Uri.joinPath(extensionContext.globalStorageUri, SQL_DATABASE_NAME);
    this._initializeSqlStore();
  }

  /**
   * 清空所有sql-store存储
   */
  public async clearAllSqlStore(): Promise<void> {
    if (existsSync(this._dbDirUri.fsPath)) {
      await vscode.workspace.fs.delete(this._dbDirUri, { recursive: true });
    }
    for (const store of this._openedStores) {
      store.initializeDb();
    }
  }

  public async openDatabase(store: SqlStore<any>): Promise<SqlStoreDatabase> {
    // 记录打开的store
    this._openedStores.add(store);
    const { versionChanged } = await this._syncStoreToTable(store);
    if (versionChanged) {
      store.clear();
    }

    // 生成database
    const data = versionChanged ? new Uint8Array() : await this._readFromFile(store.storeName);
    const database = new this._sql.Database(data) as SqlStoreDatabase;
    Reflect.set(database, 'save', () => this._writeToFile(store.storeName, database.export()));

    // 记录打开的database
    this._openedDatabases.set(store, database);
    return database;
  }

  public closeDatabase(store: SqlStore<any>): void {
    this._openedDatabases.get(store)?.close();
    this._openedStores.delete(store);
  }

  /**
   * 获取子目录或文件地址的uri
   * @param paths 路径
   */
  public toUri(...paths: string[]): vscode.Uri {
    return vscode.Uri.joinPath(this._dbDirUri, ...paths);
  }

  private async _initializeSqlStore(): Promise<void> {
    const sqlPromise = initSqlJs();
    const fileDataPromise = this._createSqlStoreDirIfNotExist().then(() => this._readFromFile(SQL_MANAGER_TABLE));
    this._db = Promise.all([sqlPromise, fileDataPromise]).then(([sql, fileData]) => {
      this._sql = sql;
      const db = new sql.Database(fileData);
      this._initializeTable(db);
      return db;
    });
  }

  /**
   * 创建sql-store存储目录
   */
  private async _createSqlStoreDirIfNotExist(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this._dbDirUri);
  }

  /**
   * 初始化sql-store管理表
   */
  private _initializeTable(db: Database): void {
    const columns = [
      'store CHAR(100) NOT NULL PRIMARY KEY',
      'version INT NOT NULL DEFAULT 0',
      "created_at DATETIME NOT NULL DEFAULT (datetime('now'))",
    ].join(',');
    db.run(`CREATE TABLE IF NOT EXISTS ${SQL_MANAGER_TABLE} (${columns});`);
  }

  /**
   * 比较store信息并同步到sql表
   */
  private async _syncStoreToTable(store: SqlStore<any>): Promise<{ versionChanged: boolean }> {
    const db = await this._db;

    // 比较版本
    const queryResult = db.exec(`SELECT version FROM ${SQL_MANAGER_TABLE} WHERE store='${store.storeName}'`)[0];
    const savedVersion = queryResult?.values[0][0];
    const versionChanged = savedVersion !== undefined && store.version !== savedVersion;

    if (savedVersion === undefined || versionChanged) {
      db.run(`INSERT OR REPLACE INTO ${SQL_MANAGER_TABLE}(store,version) VALUES('${store.storeName}',${store.version})`);
      this._writeToFile(SQL_MANAGER_TABLE, db.export());
    }

    return { versionChanged };
  }

  /**
   * 读取数据库文件
   */
  private async _readFromFile(storeName: string): Promise<Uint8Array> {
    const tableFileUri = vscode.Uri.joinPath(this._dbDirUri, `${storeName}.db`);
    try {
      return await vscode.workspace.fs.readFile(tableFileUri);
    } catch {
      return new Uint8Array();
    }
  }

  /**
   * 写入数据库文件（防抖）
   */
  private _writeToFile(storeName: string, data: Uint8Array): void {
    debounceByKey(storeName, () => {
      const tableFileUri = vscode.Uri.joinPath(this._dbDirUri, `${storeName}.db`);
      vscode.workspace.fs.writeFile(tableFileUri, data);
    });
  }
}

const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();
/**
 * 根据key分别防抖
 * @param key 防抖标识
 * @param callback 执行函数
 */
function debounceByKey(key: string, callback: () => void) {
  // 延续防抖（清除未执行的定时器）
  if (debounceMap.has(key)) {
    clearTimeout(debounceMap.get(key));
  }

  // 设置新定时器
  debounceMap.set(
    key,
    setTimeout(() => {
      callback();
      debounceMap.delete(key);
    }, 100),
  );
}
