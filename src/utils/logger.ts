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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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