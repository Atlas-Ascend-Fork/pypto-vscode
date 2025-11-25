import { Data, StoreQuery } from '../types';
import { SqlAttributesResolver } from './sql-attributes-resolver';

export class SqlStoreQuery<Item extends Data, Keys extends keyof Item> implements StoreQuery<Item, Keys> {
  private _whereConditions: string[] = [];

  private _orderCondition: string = '';

  private _limitCondition: string = '';

  constructor(private _attributeResolver: SqlAttributesResolver<Item>, private _execQuery: (condition: string) => Promise<Item[]>) {}

  public filter(condition: { [key in Keys]: Item[key] }): this {
    const conditions = this._attributeResolver.itemToQueryConditions(condition as Partial<Item>);
    this._whereConditions.push(...conditions);
    return this;
  }

  public search(prop: Keys & string, keyword: string): this {
    this._whereConditions.push(`${prop}like '%${keyword}%'`);
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
    if (this._orderCondition) {
      throw new Error('查询条件中仅能使用一次截取');
    }
    this._limitCondition = `LIMIT ${end - start} OFFSET ${start}`;
    return this;
  }

  public exec(): Promise<Item[]> {
    const whereCondition = this._whereConditions.length > 0 ? `WHERE ${this._whereConditions.join(' AND ')}` : '';
    return this._execQuery(`${whereCondition} ${this._orderCondition} ${this._limitCondition}`);
  }
}
