/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { QueryExecResult } from 'sql.js';
import { Data, StoreAttributes } from '../types';
import dayjs from 'dayjs';

const FILE_PATH_COLUMN_NAME = '__data_file';

/**
 * 值依次为name、type、not_null、default_value、primary_key
 */
type TableColumnInfo = [string, string, 0 | 1, string | null, 0 | 1];

/**
 * 解析存储属性配置
 */
export class SqlAttributesResolver<
  Item extends Data,
  ItemValue extends { [key in keyof Item]: Item[key] | null } = { [key in keyof Item]: Item[key] | null },
> {
  private attributeEntries: [keyof Item & string, (typeof this.attributes)[keyof Item]][];

  constructor(private attributes: StoreAttributes<Item>) {
    this.attributeEntries = Object.entries(this.attributes) as [keyof Item & string, (typeof this.attributes)[keyof Item]][];
  }

  /**
   * 转换成列名
   */
  public toColumnNames(): string[] {
    const columns: string[] = [];
    for (const [attr, { isQuery }] of this.attributeEntries) {
      if (isQuery) {
        columns.push(attr);
      }
    }
    columns.push(FILE_PATH_COLUMN_NAME);
    return columns;
  }

  /**
   * 转换成数据表定义信息
   * @returns {TableColumnInfo[]} 值依次为name、type、not_null、default_value、primary_key
   */
  public toTableColumnInfo(): TableColumnInfo[] {
    const tableInfo: TableColumnInfo[] = [];
    for (const [attr, { type, isQuery, isPrimary, defaultValue }] of this.attributeEntries) {
      if (isQuery) {
        const hasDefault = defaultValue !== undefined;
        const defaultValueInSql = hasDefault ? serializeValueByType(defaultValue, type) : null;
        const notNull = isPrimary || hasDefault ? 1 : 0;
        tableInfo.push([attr, getColumnType(type), notNull, defaultValueInSql, isPrimary ? 1 : 0]);
      }
    }
    tableInfo.push([FILE_PATH_COLUMN_NAME, 'CHAR(50)', 1, null, 0]);
    return tableInfo;
  }

  /**
   * 转化成索引列名
   */
  public toIndexColumnNames(): string[] {
    const indexes: string[] = [];
    for (const [attr, { isQuery, isPrimary }] of this.attributeEntries) {
      if (isQuery && !isPrimary) {
        indexes.push(attr);
      }
    }
    return indexes;
  }

  /**
   * 数据对象转换成查询条件
   */
  public itemToQueryConditions(itemObject: Partial<ItemValue>): string[] {
    const conditions: string[] = [];
    for (const [attr, value] of Object.entries(itemObject)) {
      const attribute = this.attributes[attr];
      if (!attribute || !attribute.isQuery) {
        continue;
      }
      conditions.push(`${attr}=${serializeValueByType(value, attribute.type)}`);
    }
    return conditions;
  }

  /**
   * 数据对象转换成主键查询条件
   */
  public itemToPrimaryConditions(itemObject: Partial<Item>): string[] {
    const conditions: string[] = [];
    for (const [attr, { type, isPrimary }] of this.attributeEntries) {
      if (!isPrimary) {
        continue;
      }
      const hasValue = itemObject[attr] !== undefined;
      if (!hasValue) {
        throw new Error(`缺少主键条件${attr}`);
      }
      conditions.push(`${attr}=${serializeValueByType(itemObject[attr], type)}`);
    }
    return conditions;
  }

  /**
   * 转换成写入的sql值
   */
  public itemToSqlValues(itemObject: Partial<ItemValue>): string[] {
    const queryValues: string[] = [];
    for (const [attr, { type, isQuery }] of this.attributeEntries) {
      const hasValue = itemObject[attr] !== undefined;
      if (isQuery) {
        queryValues.push(hasValue ? serializeValueByType(itemObject[attr], type) : 'NULL');
      }
    }
    return queryValues;
  }

  /**
   * 从查询结果获取存储文件名称
   */
  public getFileNamesFromQueryResult(queryResult: QueryExecResult | undefined): string[] {
    if (!queryResult) {
      return [];
    }
    const filePathIndex = queryResult.columns.findIndex((columnName) => columnName === FILE_PATH_COLUMN_NAME);
    return queryResult.values.map((row) => row[filePathIndex] as string);
  }
}

function getColumnType(type: unknown): string {
  if (type === String) {
    return 'TEXT';
  }
  if (type === Number) {
    return 'DECIMAL(18,17)';
  }
  if (type === Boolean) {
    return 'BINARY(1)';
  }
  if (type === Date) {
    return 'DATETIME';
  }
  if (type === Array || type === Object) {
    return 'JSON';
  }
  return 'TEXT';
}

function serializeValueByType(value: unknown, type: unknown): string {
  // 空值直接返回
  if (value === null) {
    return 'NULL';
  }

  // 判断类型
  if (type === String) {
    return `'${value}'`;
  }
  if (type === Number) {
    return (value as number).toString();
  }
  if (type === Boolean) {
    return value ? '1' : '0';
  }
  if (type === Date) {
    return dayjs(value as Date).format('YYYY-MM-DD HH:mm:ss');
  }
  if (type === Array || type === Object) {
    return `'${JSON.stringify(value)}'`;
  }
  return `'${String(value)}'`;
}
