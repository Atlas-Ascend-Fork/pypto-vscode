import * as vscode from 'vscode';

export type Data = Object;

/**
 * 存储属性配置
 */
export type StoreAttributes<Item extends Data = Data> = {
  [K in keyof Item]: {
    /** 属性类型（String|Number|Boolean|Object|Array） */
    type: Constructor<Item[K]>;

    /** 属性是否支持查询，设置为true才可在find、query等查询方法中作为条件使用 */
    isQuery?: boolean;

    /** 是否作为主键（可将一至多个属性设置为主键，每条数据主键联合的值唯一） */
    isPrimary?: boolean;

    /** 默认值 */
    defaultValue?: Item[K];
  };
};

/**
 * 存储库
 */
export interface Store<Item extends Data, P extends keyof Item, Q extends keyof Item = never> extends vscode.Disposable {
  readonly storeName: string;

  readonly attributes: StoreAttributes<Item>;

  /**
   * 查询单条数据
   * @param primaryConditions 所有主键构成的条件
   */
  find(primaryConditions: { [key in P]: Item[key] }): Promise<Item | undefined>;

  /**
   * 使用链式查询
   * @see StoreQuery
   */
  query(): StoreQuery<Item, P | Q>;

  /**
   * 创建或更新
   * @param item
   */
  set(item: Item): Promise<void>;

  /**
   * 删除单条数据
   * @param primaryConditions 所有主键构成的条件
   */
  delete(primaryConditions: { [key in P]: Item[key] }): Promise<boolean>;

  /**
   * 清空当前存储库
   */
  clear(): Promise<void>;

  /**
   * 监听数据清空
   * @param callback 
   */
  onClear(callback: () => void): void;
}

/**
 * 链式查询
 */
export interface StoreQuery<Item extends Data, Keys extends keyof Item> {
  /** 筛选（精确条件） */
  filter(condition: { [key in Keys]?: Item[key] }): this;

  /** 搜索（模糊条件） */
  search(prop: Keys, keyword: string): this;

  /** 排序 */
  sort(prop: Keys, order: 'asc' | 'desc'): this;

  /** 截取 */
  slice(start: number, end: number): this;

  /** 执行查询 */
  exec(): Promise<Item[]>;

  /** 执行计数 */
  count(): Promise<number>;

  /** 执行删除 */
  delete(): Promise<number>;
}

/**
 * 属性配置转换为存储对象类型
 */
export type ExtractItem<T extends StoreAttributes> = T extends any
  ? any
  : {
      [K in keyof T]: AttributeType<T[K]>;
    };

/**
 * 从属性配置提取主键类型
 */
export type PrimaryKeys<T> = T extends any
  ? any
  : {
      [K in keyof T]: T[K] extends { isPrimary: true } ? K : never;
    }[keyof T];

/**
 * 从属性配置提取其他查询索引类型
 */
export type QueryKeys<T> = T extends any
  ? any
  : {
      [K in keyof T]: T[K] extends { isQuery: true; isPrimary?: false } ? K : never;
    }[keyof T];

type Constructor<T> = T extends boolean
  ? BooleanConstructor
  : T extends Date
  ? DateConstructor
  : T extends string
  ? StringConstructor
  : T extends number
  ? NumberConstructor
  : T extends Array<unknown>
  ? ArrayConstructor
  : T extends Record<string, unknown>
  ? ObjectConstructor
  : { new (...args: any[]): T & {} } | { (): T };

type AttributeType<T> = [T] extends [{ type: ObjectConstructor }]
  ? Record<string, any>
  : [T] extends [{ type: ArrayConstructor }]
  ? any[]
  : [T] extends [{ type: BooleanConstructor }]
  ? boolean
  : [T] extends [{ type: DateConstructor }]
  ? Date
  : [T] extends [{ type: Constructor<infer V> }]
  ? V
  : T;
