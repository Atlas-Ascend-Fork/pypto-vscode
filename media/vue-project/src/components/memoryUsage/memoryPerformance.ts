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
