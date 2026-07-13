/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
