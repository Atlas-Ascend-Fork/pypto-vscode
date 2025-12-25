import crypto from 'node:crypto';

import initSqlJs, { Database, QueryExecResult } from 'sql.js';
import * as vscode from 'vscode';

import { ExtractItem, PrimaryKeys, QueryKeys, Store, StoreAttributes, StoreQuery } from '../types';
import { SqlAttributesResolver } from './sql-attributes-resolver';
import { SqlStoreQuery } from './sql-store-query';
import { SqlTableController } from './sql-table-controller';
import { DataFileController } from './data-file-controller';
import { SqlStoreDatabase, SqlStoreManager } from './sql-store-manager';

const SQL = initSqlJs();

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
  implements Store<Item, P, Q>
{
  private _db: Promise<SqlStoreDatabase>;

  private _attributeResolver: SqlAttributesResolver<Item>;

  private _tableController: SqlTableController<Item>;

  private _dataFileController: DataFileController<Item>;

  private _manager: SqlStoreManager;

  private _clearListeners: (() => void)[] = [];

  /**
   * @param storeName 数据表名
   * @param attributes 字段
   * @param extensionContext vscode扩展运行环境
   * @param version 数据库版本，需要清空sql时指定更大的值强制升版
   */
  constructor(public readonly storeName: string, public readonly attributes: Attr, public readonly version = 0) {
    super(() => this._onDispose());
    if (Object.values(attributes).every((item) => !item.isPrimary)) {
      throw new Error(`store ${storeName}未设置主键，请选取合适的属性设置isPrimary:true`);
    }
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
    return new SqlStoreQuery<Item, P | Q>(this._attributeResolver, this._execQuery, this._execDelete);
  }

  public async set(item: Item): Promise<void> {
    const conditions = this._attributeResolver.itemToPrimaryConditions(item);
    const savingFileName = `${crypto.hash('sha1', conditions.join(''))}.json`;
    await this._dataFileController.write(item, savingFileName);
    const columns = this._attributeResolver.toColumnNames();
    const values = [...this._attributeResolver.itemToSqlValues(item), `'${savingFileName}'`];
    await this._runAndSave(`INSERT OR REPLACE INTO ${this.storeName}(${columns.join(',')}) VALUES(${values})`);
    return;
  }

  public async delete(primaryConditions: { [key in P]: Item[key] }): Promise<boolean> {
    const conditions = this._attributeResolver.itemToPrimaryConditions(primaryConditions as Partial<Item>);
    const selectResult = await this._execOneSelect(`SELECT * FROM ${this.storeName} WHERE ${conditions.join(' and ')}`);
    const savingFile = this._attributeResolver.getFileNamesFromQueryResult(selectResult)[0];
    if (savingFile) {
      await this._dataFileController.delete(savingFile);
      await this._runAndSave(`DELETE FROM ${this.storeName} WHERE ${conditions.join(' and ')}`);
      return true;
    }
    return false;
  }

  public async clear(): Promise<void> {
    await this._dataFileController.clear();
    await this._runAndSave(`DELETE FROM ${this.storeName}`);
    this._clearListeners.forEach((callback) => callback());
    return;
  }

  public onClear(callback: () => void): void {
    this._clearListeners.push(callback);
  }

  /**
   * 初始化数据表
   */
  private _initializeTable(db: Database) {
    // 无数据表时新建
    const tableInfoFromDb = db.exec(`PRAGMA table_info(${this.storeName})`)[0]?.values;
    if (!tableInfoFromDb) {
      this._tableController.createTable(db);
      return;
    }

    // 数据表字段发生变化时，清空重建
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
   * 执行删除
   * @param conditions
   * @returns 删除的行数
   */
  private _execDelete = async (conditions: string): Promise<number> => {
    const items = await this._execQuery(conditions);
    for (const item of items) {
      this.delete(item);
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
   * 从查询结果读取数据对象
   */
  private async _getItemsFromQueryResult(queryResult: QueryExecResult | undefined): Promise<Item[]> {
    if (!queryResult) {
      return [];
    }
    const savingFileNames = this._attributeResolver.getFileNamesFromQueryResult(queryResult);
    const readingPromises = savingFileNames.map((fileName) => this._dataFileController.read(fileName));
    const savingItems = (await Promise.all(readingPromises)).filter((fileResult): fileResult is Item => fileResult !== undefined);
    return savingItems;
  }
}
