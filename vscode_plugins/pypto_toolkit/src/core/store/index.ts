import * as vscode from 'vscode';

import { SqlStoreManager } from './sql-store/sql-store-manager';
import type { Data, StoreAttributes } from './types';

export { SqlStore } from './sql-store/sql-store';
export type { Store, StoreQuery } from './types';

export function initStores(extensionContext: vscode.ExtensionContext) {
  new SqlStoreManager(extensionContext);
}

export function clearAllStores(): Promise<void> {
  return SqlStoreManager.getInstance().clearAllSqlStore();
}

/**
 * 定义属性（数据原样输出，用来约束attributes类型）
 * @param options
 * @returns
 */
export function defineAttributes<T extends Data>(options: StoreAttributes<T>): StoreAttributes<T> {
  return options;
}
