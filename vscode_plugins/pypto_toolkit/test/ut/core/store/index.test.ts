/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { initStores, clearAllStores, defineAttributes } from '../../../../src/core/store/index';
import { SqlStoreManager } from '../../../../src/core/store/sql-store/sql-store-manager';
import type { StoreAttributes } from '../../../../src/core/store/types';

describe('store/index', () => {
  let mockExtensionContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtensionContext = {
      globalStorageUri: { fsPath: '/test/globalStorage' },
      subscriptions: [],
    };
  });

  describe('initStores', () => {
    it('should create SqlStoreManager instance', () => {
      initStores(mockExtensionContext as vscode.ExtensionContext);

      const instance = SqlStoreManager.getInstance();
      expect(instance).toBeDefined();
    });

    it('should create SqlStoreManager instance on each call', () => {
      initStores(mockExtensionContext as vscode.ExtensionContext);
      const instance1 = SqlStoreManager.getInstance();

      initStores(mockExtensionContext as vscode.ExtensionContext);
      const instance2 = SqlStoreManager.getInstance();

      // Each call creates a new instance
      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();
    });
  });

  describe('clearAllStores', () => {
    it('should call clearAllSqlStore on SqlStoreManager', async () => {
      initStores(mockExtensionContext as vscode.ExtensionContext);
      const instance = SqlStoreManager.getInstance();
      const clearSpy = vi.spyOn(instance, 'clearAllSqlStore').mockResolvedValue();

      await clearAllStores();

      expect(clearSpy).toHaveBeenCalled();
    });

    it('should return a promise', async () => {
      const result = clearAllStores();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('defineAttributes', () => {
    it('should return the same options object', () => {
      const options: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
      };

      const result = defineAttributes(options);

      expect(result).toBe(options);
    });

    it('should preserve all properties', () => {
      const options: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        data: { type: Object },
      };

      const result = defineAttributes(options);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('data');
    });

    it('should preserve type information', () => {
      const options: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        active: { type: Boolean, isQuery: true },
        createdAt: { type: Date, isQuery: true },
        data: { type: Object },
        tags: { type: Array },
      };

      const result = defineAttributes(options);

      expect(result.id.type).toBe(Number);
      expect(result.name.type).toBe(String);
      expect(result.active.type).toBe(Boolean);
      expect(result.createdAt.type).toBe(Date);
      expect(result.data.type).toBe(Object);
      expect(result.tags.type).toBe(Array);
    });

    it('should preserve query and primary flags', () => {
      const options: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        data: { type: Object },
      };

      const result = defineAttributes(options);

      expect(result.id.isQuery).toBe(true);
      expect(result.id.isPrimary).toBe(true);
      expect(result.name.isQuery).toBe(true);
      expect(result.data.isQuery).toBeUndefined();
    });

    it('should preserve default values', () => {
      const options: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        status: { type: String, isQuery: true, defaultValue: 'active' },
      };

      const result = defineAttributes(options);

      expect(result.status.defaultValue).toBe('active');
    });
  });
});
