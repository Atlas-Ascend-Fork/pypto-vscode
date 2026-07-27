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
