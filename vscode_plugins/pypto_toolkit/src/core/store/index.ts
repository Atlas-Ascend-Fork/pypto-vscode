import * as vscode from 'vscode';

import { clearAllSqlStores } from './sql-store/sql-store';
import type { StoreAttributes } from './types';

export { SqlStore } from './sql-store/sql-store';
export type { Store, StoreQuery } from './types';

export function clearAllStores(extensionContext: vscode.ExtensionContext) {
  clearAllSqlStores(extensionContext);
}

/**
 * 定义属性（数据原样输出，用来约束attributes类型）
 * @param options
 * @returns
 */
export function defineAttributes<T extends StoreAttributes>(options: T): T {
  return options;
}
