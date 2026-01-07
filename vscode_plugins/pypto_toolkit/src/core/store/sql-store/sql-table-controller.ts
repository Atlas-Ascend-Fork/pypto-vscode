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

    // 提取所有主键字段名
    const primaryKeyColumns = tableColumnInfo
      .filter(([, , , , isPrimary]) => isPrimary)
      .map(([name]) => `\`${name}\``);

    // 构建列定义
    const columns = tableColumnInfo.map(([name, type, notNull, defaultValue, isPrimary]) => {
      const notNullSql = notNull ? ' NOT NULL' : '';
      const defaultSql = defaultValue ? ` DEFAULT ${defaultValue}` : '';
      return `\`${name}\` ${type}${notNullSql}${defaultSql}`;
    }).join(',');

    // 构建主键约束（如果有多个主键，用联合；如果只有一个，也可用此语法）
    const primaryKeyClause = primaryKeyColumns.length > 0
      ? `, PRIMARY KEY (${primaryKeyColumns.join(', ')})`
      : '';

    // 创建表
    db.run(`CREATE TABLE IF NOT EXISTS ${this._storeName} (${columns}${primaryKeyClause});`);

    // 创建索引（可选：通常主键已自动建索引，但显式建也无妨）
    const indexes = this._attributeResolver.toIndexColumnNames();
    for (const attr of indexes) {
      db.run(`CREATE INDEX IF NOT EXISTS index_${attr} ON ${this._storeName} (\`${attr}\`)`);
    }
  }

  public deleteTable(db: Database) {
    db.run(`DROP TABLE IF EXISTS ${this._storeName}`);
  }
}
