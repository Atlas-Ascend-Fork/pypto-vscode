/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
export interface GmMemoryPerformanceRun {
  fingerprint: Record<string, unknown>;
  longTasks: Array<{ duration: number; startTime: number }>;
  marks: Record<string, number>;
  stages: Record<string, number>;
}

function getRun(): GmMemoryPerformanceRun | undefined {
  return (window as typeof window & { __gmMemoryPerformance?: GmMemoryPerformanceRun }).__gmMemoryPerformance;
}

export function startPerformanceStage(): number | undefined {
  return getRun() ? performance.now() : undefined;
}

export function finishPerformanceStage(name: string, startedAt: number | undefined): void {
  const run = getRun();
  if (!run || startedAt === undefined) {
    return;
  }
  run.stages[name] = performance.now() - startedAt;
}

export function markPerformance(name: string): void {
  const run = getRun();
  if (run) {
    run.marks[name] = performance.now();
  }
}

export function updatePerformanceFingerprint(values: Record<string, unknown>): void {
  const run = getRun();
  if (run) {
    Object.assign(run.fingerprint, values);
  }
}
