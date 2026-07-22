/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

import type { Database } from 'sql.js';
import { promises as fs } from 'fs';

/**
 * 执行多行查询，自动管理 stmt 生命周期。
 * @param db - sql.js Database 实例
 * @param sql - SQL 查询语句
 * @param params - 绑定参数
 * @param mapRow - 行映射函数：将原始行对象转换为目标类型
 * @returns 映射后的结果数组
 */
export function queryAll<T>(
  db: Database,
  sql: string,
  params: (string | number)[],
  mapRow: (row: Record<string, unknown>) => T,
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result: T[] = [];
  try {
    while (stmt.step()) {
      result.push(mapRow(stmt.getAsObject() as Record<string, unknown>));
    }
  } finally {
    stmt.free();
  }
  return result;
}

/**
 * 执行单行查询，自动管理 stmt 生命周期。
 * @returns 映射后的结果，或 undefined（无匹配行）
 */
export function queryOne<T>(
  db: Database,
  sql: string,
  params: (string | number)[],
  mapRow: (row: Record<string, unknown>) => T,
): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  try {
    if (stmt.step()) {
      return mapRow(stmt.getAsObject() as Record<string, unknown>);
    }
    return undefined;
  } finally {
    stmt.free();
  }
}

/**
 * 执行 COUNT 查询，返回数值。
 * 假设 SQL 中 SELECT 的第一列别名为 "total"。
 */
export function queryCount(
  db: Database,
  sql: string,
  params: (string | number)[],
): number {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  try {
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      return Number(row.total ?? row.cnt ?? 0);
    }
    return 0;
  } finally {
    stmt.free();
  }
}

/**
 * 执行多行查询，不做行映射，直接 as unknown as T 返回。
 * 适用于 SELECT * 且接口字段与数据库列名完全一致的场景。
 */
export function queryAllRaw<T>(
  db: Database,
  sql: string,
  params: (string | number)[],
): T[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const result: T[] = [];
  try {
    while (stmt.step()) {
      result.push(stmt.getAsObject() as unknown as T);
    }
  } finally {
    stmt.free();
  }
  return result;
}

/**
 * 通用重试机制。从原 sqliteCache.ts 的 retryOperation 方法提取。
 * @param operation - 异步操作函数
 * @param maxRetries - 最大重试次数，默认 5
 * @param delayMs - 重试间隔（ms），默认 100
 * @param shouldRetryCondition - 结果不满足时的重试条件
 * @param operationName - 操作名称（用于日志）
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  delayMs: number = 100,
  shouldRetryCondition?: (result: T) => boolean,
  operationName?: string,
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await operation();

      // 如果提供了条件函数且结果不符合条件，则继续重试
      if (shouldRetryCondition && shouldRetryCondition(result)) {
        // `${operationName}操作返回空结果，重试第 ${i + 1} 次`
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
      }

      if (i == maxRetries - 1 && !result) {
        // `${operationName} 重试了 ${i + 1} 次，取值仍为空`
      }
      return result;
    } catch (error) {
      lastError = error;
      console.debug(`${operationName}操作失败，重试第 ${i + 1} 次，错误:`, error);

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error('重试次数已达上限');
}

/**
 * 获取文件的最后修改时间。从原 sqliteCache.ts 底部提取。
 */
export async function getMTime(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  return stat.mtime.toString();
}

/**
 * 重试执行一个异步函数，直到满足成功条件或达到最大重试次数。
 *
 * 与 retryOperation 的区别：
 * - retryOperation：失败时抛异常，适用于"必须成功"的场景
 * - retryUntil：失败时返回最后一次结果（可能为 undefined），适用于"尽力而为"的场景
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  {
    maxRetries = 1,
    delayMs = 100,
    isSuccess = (result: T) => result != null && result !== undefined,
  }: {
    maxRetries?: number;
    delayMs?: number;
    isSuccess?: (result: T) => boolean;
  } = {},
): Promise<T | undefined> {
  let lastResult: T | undefined = undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      lastResult = result;
      if (isSuccess(result)) {
        return result;
      }
    } catch (error) {
      console.warn(`Retry attempt ${attempt + 1} failed:`, error);
    }
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return lastResult;
}
