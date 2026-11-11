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
import crypto from 'node:crypto';

import type { Database, QueryExecResult } from 'sql.js';
import * as vscode from 'vscode';

import { ExtractItem, PrimaryKeys, QueryKeys, Store, StoreAttributes, StoreQuery } from '../types';
import { SqlAttributesResolver } from './sql-attributes-resolver';
import { SqlStoreQuery } from './sql-store-query';
import { SqlTableController } from './sql-table-controller';
import { DataFileController } from './data-file-controller';
import { SqlStoreDatabase, SqlStoreManager } from './sql-store-manager';

export type SqlStoreOptions = {
  /** 数据库版本，需要清空sql时指定更大的值强制升版 */
  version?: number;
  /** 纯内存模式：完整 JSON 存 _itemJson 列，跳过全部数据文件读写（适合重建快、无需跨会话存活的缓存） */
  memoryOnly?: boolean;
};

const DEFAULT_OPTIONS: Required<SqlStoreOptions> = {
  version: 0,
  memoryOnly: false,
};

/**
 * Sqlite缓存
 */
export class SqlStore<
  Attr extends StoreAttributes<any>,
  Item extends ExtractItem<Attr> = ExtractItem<Attr>,
  P extends keyof Item = PrimaryKeys<Attr>,
  Q extends keyof Item = QueryKeys<Attr>,
>
  extends vscode.Disposable
  implements Store<Item, P, Q> {
  /** 数据库版本，需要清空sql时指定更大的值强制升版 */
  public readonly version: number;
  /** 纯内存模式标记 */
  public readonly memoryOnly: boolean;

  private _db: Promise<SqlStoreDatabase>;

  private _attributeResolver: SqlAttributesResolver<Item>;

  private _tableController: SqlTableController<Item>;

  private _dataFileController: DataFileController<Item>;

  private _manager: SqlStoreManager;

  private _clearListeners: (() => void)[] = [];

  /**
   * @param storeName 数据表名
   * @param attributes 字段
   * @param options 数据库配置
   */
  constructor(public readonly storeName: string, public readonly attributes: Attr, options?: SqlStoreOptions) {
    super(() => this._onDispose());
    if (Object.values(attributes).every((item) => !item.isPrimary)) {
      throw new Error(`store ${storeName}未设置主键，请选取合适的属性设置isPrimary:true`);
    }
    const requiredOptions = options ? { ...DEFAULT_OPTIONS, ...options } : { ...DEFAULT_OPTIONS };
    this.version = requiredOptions.version;
    this.memoryOnly = requiredOptions.memoryOnly;
    this._manager = SqlStoreManager.getInstance();
    this._attributeResolver = new SqlAttributesResolver<Item>(attributes);
    this._tableController = new SqlTableController<Item>(storeName, this._attributeResolver);
    this._dataFileController = new DataFileController<Item>(storeName);
    this.initializeDb();
  }

  /**
   * 初始化DB
   */
  public async initializeDb(): Promise<void> {
    if (this._db) {
      (await this._db).close();
      this._clearListeners.forEach((callback) => callback());
    }
    this._db = this._manager.openDatabase(this);
    this._initializeTable(await this._db);
  }

  public async find(primaryConditions: { [key in P]: Item[key] }): Promise<Item | undefined> {
    const conditions = this._attributeResolver.itemToPrimaryConditions(primaryConditions as Partial<Item>);
    const result = await this._execOneSelect(`SELECT * FROM ${this.storeName} WHERE ${conditions.join(' and ')}`);
    return (await this._getItemsFromQueryResult(result))[0];
  }

  public query(): StoreQuery<Item, P | Q> {
    return new SqlStoreQuery<Item, P | Q>(this._attributeResolver, this._execQuery, this._execDelete, this._execCount);
  }

  public async set(item: Item): Promise<void> {
    const conditions = this._attributeResolver.itemToPrimaryConditions(item);
    const columns = this._attributeResolver.toColumnNames();
    if (this.memoryOnly) {
      const itemJson = JSON.stringify(item).replace(/'/g, "''");
      const values = [...this._attributeResolver.itemToSqlValues(item), `'${itemJson}'`];
      await this._runAndSave(`INSERT OR REPLACE INTO ${this.storeName}(${columns.join(',')}) VALUES(${values})`);
      return;
    }
    const savingFileName = this.makeUniqueFileName(conditions.join(''));
    await this._dataFileController.write(item, savingFileName);
    const values = [...this._attributeResolver.itemToSqlValues(item), `'${savingFileName}'`];
    await this._runAndSave(`INSERT OR REPLACE INTO ${this.storeName}(${columns.join(',')}) VALUES(${values})`);
    return;
  }

  /**
   * 批量设置/更新数据（支持分批提交与统一落盘）
   * @param items 要批量插入的数据项数组
   * @param batchSize 每批处理的数据量，默认 1000 条
   */
  public async batchSet(items: Item[], batchSize: number = 1000): Promise<void> {
    if (!items || items.length === 0) return;

    const db = await this._db;
    const columnStr = this._attributeResolver.toColumnNames().join(',');
    const fileSavePromises: Promise<void>[] = [];

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        db.run("BEGIN TRANSACTION");

        for (const item of chunk) {
          let sql: string;
          if (this.memoryOnly) {
            const itemJson = JSON.stringify(item).replace(/'/g, "''");
            const values = [...this._attributeResolver.itemToSqlValues(item), `'${itemJson}'`];
            sql = `INSERT OR REPLACE INTO ${this.storeName}(${columnStr}) VALUES(${values.join(',')})`;
          } else {
            const conditions = this._attributeResolver.itemToPrimaryConditions(item);
            const savingFileName = this.makeUniqueFileName(conditions.join(''));
            fileSavePromises.push(this._dataFileController.write(item, savingFileName));
            const values = [...this._attributeResolver.itemToSqlValues(item), `'${savingFileName}'`];
            sql = `INSERT OR REPLACE INTO ${this.storeName}(${columnStr}) VALUES(${values.join(',')})`;
          }
          db.run(sql);
        }

        db.run("COMMIT");
      }

      if (!this.memoryOnly) {
        await Promise.all(fileSavePromises);
      }
      db.save();

    } catch (error) {
      // 等飞行中的文件写入落地再抛出，避免文件句柄未释放导致后续清理失败
      await Promise.allSettled(fileSavePromises);
      db.run("ROLLBACK");
      console.error('Batch set failed and rolled back:', error);
      throw error;
    }
  }

  public async delete(primaryConditions: { [key in P]: Item[key] }): Promise<boolean> {
    const conditions = this._attributeResolver.itemToPrimaryConditions(primaryConditions as Partial<Item>);
    const selectResult = await this._execOneSelect(`SELECT * FROM ${this.storeName} WHERE ${conditions.join(' and ')}`);
    if (selectResult) {
      if (!this.memoryOnly) {
        const savingFile = this._attributeResolver.getFileNamesFromQueryResult(selectResult)[0];
        if (savingFile) {
          await this._dataFileController.delete(savingFile);
        }
      }
      await this._runAndSave(`DELETE FROM ${this.storeName} WHERE ${conditions.join(' and ')}`);
      return true;
    }
    return false;
  }

  /**
   * 批量删除：一条 SELECT 收集数据文件名 → 并行删文件 → 一条 DELETE SQL → 一次 save。
   * memoryOnly 模式下只执行 SQL DELETE。
   */
  public async bulkDelete(condition: Partial<Item>): Promise<number> {
    const conditions = this._attributeResolver.itemToQueryConditions(condition as Partial<Item>);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const db = await this._db;
    if (this.memoryOnly) {
      const countResult = await this._execOneSelect(`SELECT count(*) as cnt FROM ${this.storeName} ${whereClause}`);
      const count = Number(countResult?.values[0][0] ?? 0);
      if (count === 0) {
        return 0;
      }
      db.run(`DELETE FROM ${this.storeName} ${whereClause}`);
      db.save();
      return count;
    }
    const queryResult = await this._execOneSelect(`SELECT * FROM ${this.storeName} ${whereClause}`);
    const fileNames = queryResult ? this._attributeResolver.getFileNamesFromQueryResult(queryResult) : [];
    if (fileNames.length === 0) {
      return 0;
    }
    await Promise.all(fileNames.map((fileName) => this._dataFileController.delete(fileName)));
    db.run(`DELETE FROM ${this.storeName} ${whereClause}`);
    db.save();
    return fileNames.length;
  }

  public async clear(): Promise<void> {
    if (!this.memoryOnly) {
      await this._dataFileController.clear();
    }
    await this._runAndSave(`DELETE FROM ${this.storeName}`);
    this._clearListeners.forEach((callback) => callback());
    return;
  }

  public onClear(callback: () => void): void {
    this._clearListeners.push(callback);
  }

  /**
   * 初始化数据表。memoryOnly 与文件模式共用同一 schema（最后一列存 JSON 或文件名），无需区分。
   */
  private _initializeTable(db: Database) {
    const tableInfoFromDb = db.exec(`PRAGMA table_info(${this.storeName})`)[0]?.values;
    if (!tableInfoFromDb) {
      this._tableController.createTable(db);
      return;
    }
    const tableInfoFromAttribute = this._attributeResolver.toTableColumnInfo();
    const hasDiffColumn = tableInfoFromDb.some(
      (columnFromDb, index) => JSON.stringify(columnFromDb.slice(1)) !== JSON.stringify(tableInfoFromAttribute[index]),
    );
    if (tableInfoFromDb.length !== tableInfoFromAttribute.length || hasDiffColumn) {
      this._tableController.deleteTable(db);
      this._tableController.createTable(db);
      return;
    }
  }

  private _onDispose() {
    this._manager.closeDatabase(this);
  }
 
  /**
   * 执行query
   * @param conditions
   * @returns
   */
  private _execQuery = async (conditions: string): Promise<Item[]> => {
    const queryResult = await this._execOneSelect(`SELECT * FROM ${this.storeName} ${conditions}`);
    return this._getItemsFromQueryResult(queryResult);
  };

  /**
   * 执行count
   * @param conditions
   * @returns
   */
  private _execCount = async (conditions: string): Promise<number> => {
    const queryResult = await this._execOneSelect(`SELECT count(*) as cnt FROM ${this.storeName} ${conditions}`);
    return Number(queryResult?.values[0][0] ?? 0);
  };

  /**
   * 执行删除
   * @param conditions
   * @returns 删除的行数
   */
  private _execDelete = async (conditions: string): Promise<number> => {
    const items = await this._execQuery(conditions);
    for (const item of items) {
      await this.delete(item);
    }
    return items.length ?? 0;
  };

  /**
   * 执行一条查询语句
   * @param conditions 查询条件
   */
  private async _execOneSelect(sql: string): Promise<QueryExecResult | undefined> {
    return (await this._db).exec(sql)[0];
  }

  /**
   * 执行SQL并保存至数据文件
   */
  private async _runAndSave(sql: string): Promise<void> {
    const db = await this._db;
    db.run(sql);
    db.save();
    return;
  }

  /**
   * 从查询结果读取数据对象。memoryOnly 模式下最后一列存 JSON 字符串（复用文件名列位置），直接反序列化。
   */
  private async _getItemsFromQueryResult(queryResult: QueryExecResult | undefined): Promise<Item[]> {
    if (!queryResult) {
      return [];
    }
    if (this.memoryOnly) {
      const jsonIndex = queryResult.columns.length - 1;
      return queryResult.values
        .map((row) => {
          try {
            return JSON.parse(String(row[jsonIndex])) as Item;
          } catch {
            return undefined;
          }
        })
        .filter((item): item is Item => item !== undefined);
    }
    const savingFileNames = this._attributeResolver.getFileNamesFromQueryResult(queryResult);
    const readingPromises = savingFileNames.map((fileName) => this._dataFileController.read(fileName));
    const savingItems = (await Promise.all(readingPromises)).filter((fileResult): fileResult is Item => fileResult !== undefined);
    return savingItems;
  }

  /**
   * 唯一键生成数据文件名
   */
  private makeUniqueFileName(uniqueKey: string): string {
    const hash = crypto.createHash('sha1');
    return `${hash.update(uniqueKey).digest('hex')}.json`;
  }
}
