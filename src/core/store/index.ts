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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 */
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
