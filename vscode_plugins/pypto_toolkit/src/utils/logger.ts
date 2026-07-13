/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
// utils/logger.ts

/**
 * 格式化时间为 HH:mm:ss.SSS（本地时区）
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  
  const timePart = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);

  const ms = String(date.getMilliseconds()).padStart(3, '0');
  
  return ` ${timePart}.${ms}`;
}

/**
 * 打印带可读时间戳和耗时的日志
 * @param label 日志标签
 * @param baseTime 基准时间戳（可选），用于计算耗时（ms）
 * @returns 当前时间戳（可用于下一次调用）
 */
export function logWithTimestamp(label: string, baseTime?: number): number {
  const now = Date.now();
  const timeStr = formatTimestamp(now);
  if (label == '') {
    return now;
  }
  if (baseTime !== undefined) {
    const elapsed = now - baseTime;
    console.log(`[LOG]  ${timeStr} |  ${label} | 耗时:  ${elapsed}ms`);
  } else {
    console.log(`[LOG]  ${timeStr} |  ${label}`);
  }

  return now;
}