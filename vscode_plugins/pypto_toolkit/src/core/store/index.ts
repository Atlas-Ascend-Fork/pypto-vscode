import type { StoreAttributes } from './types';

export type { Store, StoreQuery } from './types';
export { SqlStore } from './sql-store/sql-store';

/**
 * 定义属性（数据原样输出，用来约束attributes类型）
 * @param options
 * @returns
 */
export function defineAttributes<T extends StoreAttributes>(options: T): T {
  return options;
}
