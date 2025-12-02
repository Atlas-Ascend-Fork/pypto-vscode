import { Database } from 'sql.js';

import { Data } from '../types';

import { SqlAttributesResolver } from './sql-attributes-resolver';

/**
 * 数据库表操作
 */
export class SqlTableController<Item extends Data> {
  constructor(private _storeName: string, private _attributeResolver: SqlAttributesResolver<Item>) {}

  public createTable(db: Database) {
    const tableColumnInfo = this._attributeResolver.toTableColumnInfo();
    const columns = tableColumnInfo.map(([name, type, notNull, defaultValue, isPrimary]) => {
      const notNullSql = notNull ? ' NOT NULL' : '';
      const primaryKeySql = isPrimary ? ' PRIMARY KEY' : '';
      const defaultSql = defaultValue ? ` DEFAULT ${defaultValue}` : '';
      return `\`${name}\` ${type}${notNullSql}${primaryKeySql}${defaultSql}`;
    }).join(',');
    const indexes = this._attributeResolver.toIndexColumnNames();
    db.run(`CREATE TABLE IF NOT EXISTS ${this._storeName} (${columns});`);
    for (const attr of indexes) {
      db.run(`CREATE INDEX IF NOT EXISTS index_${attr} ON ${this._storeName} (${attr})`);
    }
  }

  public deleteTable(db: Database) {
    db.run(`DROP TABLE IF EXISTS ${this._storeName}`);
  }
}
