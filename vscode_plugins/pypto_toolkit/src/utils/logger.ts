// utils/logger.ts

/**
 * 格式化时间为 HH:mm:ss.SSS（本地时区）
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return ` ${hours}: ${minutes}: ${seconds}. ${ms}`;
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