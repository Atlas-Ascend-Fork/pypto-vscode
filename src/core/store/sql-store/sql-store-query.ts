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
import { Data, StoreQuery } from '../types';
import { SqlAttributesResolver } from './sql-attributes-resolver';

export class SqlStoreQuery<Item extends Data, Keys extends keyof Item> implements StoreQuery<Item, Keys> {
  private _whereConditions: string[] = [];

  private get _whereCondition(): string {
    return this._whereConditions.length > 0 ? `WHERE ${this._whereConditions.join(' AND ')}` : '';
  }

  private _orderCondition: string = '';

  private _limitCondition: string = '';

  constructor(
    private _attributeResolver: SqlAttributesResolver<Item>,
    private _execQuery: (condition: string) => Promise<Item[]>,
    private _execDelete: (condition: string) => Promise<number>,
    private _execCount: (condition: string) => Promise<number>,
  ) {}

  public filter(condition: { [key in Keys]?: Item[key] }): this {
    const conditions = this._attributeResolver.itemToQueryConditions(condition as Partial<Item>);
    this._whereConditions.push(...conditions);
    return this;
  }

  public search(prop: Keys & string, keyword: string, isExactMatch: boolean = false): this {
    // 是否精确匹配，否：'_'为通配符
    if (isExactMatch) {
      const escapedkey = keyword.replace(/_/g, '\\_');
      this._whereConditions.push(`${prop} like '%${escapedkey}%' escape '\\'`);
    } else {
      this._whereConditions.push(`${prop} like '%${keyword}%'`);
    }
    return this;
  }

  public notNull(props: string[]): this {
    props.forEach((field) => {
      this._whereConditions.push(`${field} IS NOT NULL`)
    })
    return this;
  }

  public sort(prop: Keys & string, order: 'asc' | 'desc'): this {
    if (this._orderCondition) {
      throw new Error('查询条件中仅能使用一次排序');
    }
    this._orderCondition = `ORDER BY ${prop} ${order}`;
    return this;
  }

  public slice(start: number, end: number): this {
    if (this._limitCondition) {
      throw new Error('查询条件中仅能使用一次截取');
    }
    this._limitCondition = `LIMIT ${end - start} OFFSET ${start}`;
    return this;
  }

  public exec(): Promise<Item[]> {
    return this._execQuery(`${this._whereCondition} ${this._orderCondition} ${this._limitCondition}`);
  }

  public delete(): Promise<number> {
    return this._execDelete(`${this._whereCondition} ${this._orderCondition} ${this._limitCondition}`);
  }

  public count(): Promise<number> {
    return this._execCount(`${this._whereCondition} ${this._limitCondition}`);
  }
}
