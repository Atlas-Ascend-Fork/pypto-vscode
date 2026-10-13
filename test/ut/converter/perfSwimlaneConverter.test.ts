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
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn(), readdirSync: vi.fn() };
});

import { PerfSwimlaneConverter } from '../../../src/converter/perfSwimlaneConverter';
import type { PerfSwimlaneData, TaskRecord } from '../../../src/converter/perfSwimlaneConverter';
import * as fs from 'fs';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    task_id: 0, func_id: 1, core_id: 0, core_type: 'aic', ring_id: 0,
    start_time_us: 100, end_time_us: 200, duration_us: 100, kernel_ready_time_us: 90,
    fanout: [], fanout_count: 0,
    ...overrides,
  };
}

describe('PerfSwimlaneConverter.convert - basic', () => {
  it('converts simple tasks without aicpu data', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, fanout: [1] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
    const metadataEvents = result.traceEvents.filter(e => e.cat === '__metadata');
    expect(metadataEvents.some(e => e.name === 'process_name' && e.pid === 4)).toBe(true);
    const durationEvents = result.traceEvents.filter(e => e.ph === 'X' && e.cat === 'event');
    expect(durationEvents.length).toBe(2);
    const flowEvents = result.traceEvents.filter(e => e.cat === 'flow');
    expect(flowEvents.length).toBeGreaterThan(0);
    expect(metadataEvents.some(e => e.pid === 3)).toBe(false);
  });

  it('converts tasks on different cores with different core types', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, core_type: 'aic', dispatch_time_us: 80, finish_time_us: 210 }),
        createTask({ task_id: 1, core_id: 1, core_type: 'aiv', start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const threadNameEvents = result.traceEvents.filter(e => e.name === 'thread_name');
    expect(threadNameEvents.some(e => (e.args as any).name === 'AIC_0')).toBe(true);
    expect(threadNameEvents.some(e => (e.args as any).name === 'AIV_1')).toBe(true);
  });
});

describe('PerfSwimlaneConverter.convert - aicpu data', () => {
  it('converts tasks with valid aicpu data', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, core_type: 'aic', dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, core_type: 'aiv', start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const metadataEvents = result.traceEvents.filter(e => e.cat === '__metadata');
    expect(metadataEvents.some(e => e.pid === 3)).toBe(true);
    const aicpuEvents = result.traceEvents.filter(e => e.ph === 'X' && e.pid === 3 && e.cat === 'event');
    expect(aicpuEvents.length).toBe(2);
    const aicpuFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && e.pid === 3);
    expect(aicpuFlowEvents.length).toBeGreaterThan(0);
  });

  it('skips tasks with invalid aicpu data (dispatch < 0 or finish <= 0)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, dispatch_time_us: -1, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 0 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const aicpuEvents = result.traceEvents.filter(e => e.pid === 3 && e.cat === 'event');
    expect(aicpuEvents.length).toBe(0);
    const metadataEvents = result.traceEvents.filter(e => e.cat === '__metadata' && e.pid === 3);
    expect(metadataEvents.length).toBe(0);
  });

  it('assigns multiple aicpu lanes when tasks overlap', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 250, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 90, finish_time_us: 260 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const aicpuThreadNames = result.traceEvents.filter(e => e.cat === '__metadata' && e.pid === 3 && e.name === 'thread_name');
    expect(aicpuThreadNames.length).toBeGreaterThan(0);
  });

  it('generates hb_violation flow when successor starts before predecessor ends', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, end_time_us: 250, fanout: [1] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const hbFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'hb_violation');
    expect(hbFlows.length).toBeGreaterThan(0);
  });

  it('skips flow events for non-existent successor tasks', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, fanout: [999] }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const flowEvents = result.traceEvents.filter(e => e.cat === 'flow');
    expect(flowEvents.length).toBe(0);
  });
});

describe('PerfSwimlaneConverter.convert - depsEdges and funcIdToName', () => {
  it('uses depsEdges for aicpu flow events', () => {
    const depsEdges = new Map<number, number[]>([[0, [1]]]);
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data, { depsEdges });
    const aicpuFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && e.pid === 3);
    expect(aicpuFlowEvents.length).toBeGreaterThan(0);
  });

  it('skips aicpu flow for successor with negative dispatch', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: -1, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('skips aicpu flow for non-existent successor in depsEdges', () => {
    const depsEdges = new Map<number, number[]>([[0, [999]]]);
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [] }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data, { depsEdges });
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('skips aicpu flow for task with negative finish_time_us', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: -1, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('uses depsEdges for flow events', () => {
    const depsEdges = new Map<number, number[]>([[0, [1]]]);
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, fanout: [] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data, { depsEdges });
    const flowEvents = result.traceEvents.filter(e => e.cat === 'flow');
    expect(flowEvents.length).toBeGreaterThan(0);
    const durationEvents = result.traceEvents.filter(e => e.ph === 'X' && e.cat === 'event');
    expect(durationEvents[0].args['fanout-hint']).not.toBe('[]');
  });

  it('uses funcIdToName for task names', () => {
    const funcIdToName = { '1': 'AddOp', '2': 'MulOp' };
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, func_id: 1 }),
        createTask({ task_id: 1, func_id: 2, start_time_us: 200, end_time_us: 300 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data, { funcIdToName });
    const durationEvents = result.traceEvents.filter(e => e.ph === 'X' && e.cat === 'event');
    expect(durationEvents[0].name).toContain('AddOp');
    expect(durationEvents[1].name).toContain('MulOp');
  });
});

describe('PerfSwimlaneConverter.convert - scheduler phases', () => {
  it('converts with scheduler phases including complete, dispatch, and unknown', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
      aicpu_scheduler_phases: [
        [
          { start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 },
          { start_time_us: 90, end_time_us: 100, phase: 'complete', loop_iter: 1, tasks_processed: 2 },
          { start_time_us: 100, end_time_us: 110, phase: 'unknown', loop_iter: 1, tasks_processed: 0 },
        ],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const metadataEvents = result.traceEvents.filter(e => e.cat === '__metadata' && e.pid === 2);
    expect(metadataEvents.length).toBeGreaterThan(0);
    const schedulerEvents = result.traceEvents.filter(e => e.cat === 'scheduler');
    expect(schedulerEvents.length).toBe(2);
    const dispatchFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlowEvents.length).toBeGreaterThan(0);
  });

  it('uses core_to_thread for dispatch flow mapping', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, core_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
      ],
      core_to_thread: [0, 0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const dispatchFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlowEvents.length).toBeGreaterThan(0);
  });

  it('computes core-to-thread mapping via votes when core_to_thread is absent', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 75, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, core_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 175, finish_time_us: 310 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const dispatchFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlowEvents.length).toBeGreaterThan(0);
  });

  it('skips dispatch flow for tasks with negative dispatch_time_us', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, dispatch_time_us: -1, finish_time_us: 210 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
      core_to_thread: [0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const dispatchFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlowEvents.length).toBe(0);
  });
});

describe('PerfSwimlaneConverter.convert - orchestrator', () => {
  it('converts with orchestrator phases', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_submit', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: 0 },
          { phase: 'orch_fanin', start_time_us: 55, end_time_us: 65, submit_idx: 0, task_id: 0 },
          { phase: 'orch_params', start_time_us: 60, end_time_us: 70, submit_idx: 0, task_id: 0 },
          { phase: 'orch_sync', start_time_us: 65, end_time_us: 75, submit_idx: 0 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const metadataEvents = result.traceEvents.filter(e => e.cat === '__metadata' && e.pid === 1);
    expect(metadataEvents.length).toBeGreaterThan(0);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(4);
    const orchFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && (e.name === 'submit→dispatch' || e.name === 'fanin→dispatch' || e.name === 'params→dispatch'));
    expect(orchFlowEvents.length).toBeGreaterThan(0);
  });

  it('converts with orchestrator data (no phases)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator: {
        start_time_us: 0, end_time_us: 100, submit_count: 5,
        phase_us: { submit: 10, sync: 20, alloc: 30, idle: 0 },
      },
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(1);
    expect(orchEvents[0].name).toContain('5');
    expect(orchEvents[0].args['submit_count']).toBe(5);
    expect(orchEvents[0].args['submit_us']).toBe(10);
    expect(orchEvents[0].args['submit_%']).toBeGreaterThan(0);
    expect(orchEvents[0].args['idle_us']).toBeUndefined();
  });

  it('handles orchestrator phases with task_id < 0 (skipped)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_submit', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: -1 },
          { phase: 'orch_scope_end', start_time_us: 60, end_time_us: 70, submit_idx: 1 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(2);
  });

  it('skips orchestrator phase records with task_id exceeding MAX_SAFE_INTEGER', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_submit', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: BigInt(Number.MAX_SAFE_INTEGER) + 1n },
          { phase: 'orch_scope_end', start_time_us: 60, end_time_us: 70, submit_idx: 1 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(2);
  });

  it('handles fanin and params anchor when no submit anchor exists', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_fanin', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: 1 },
          { phase: 'orch_params', start_time_us: 55, end_time_us: 65, submit_idx: 0, task_id: 0 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchFlowEvents = result.traceEvents.filter(e => e.cat === 'flow' && (e.name === 'fanin→dispatch' || e.name === 'params→dispatch'));
    expect(orchFlowEvents.length).toBeGreaterThan(0);
  });

  it('skips orchestrator flow for tasks with null task_id, negative dispatch, or unmatched core', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: BigInt(Number.MAX_SAFE_INTEGER) + 1n, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
        createTask({ task_id: 0, core_id: 1, dispatch_time_us: -1, finish_time_us: 210 }),
        createTask({ task_id: 1, core_id: 5, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_submit', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: 0 },
          { phase: 'orch_submit', start_time_us: 55, end_time_us: 65, submit_idx: 1, task_id: 1 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('handles empty orchestrator phases array', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator_phases: [],
      aicpu_orchestrator: {
        start_time_us: 0, end_time_us: 100, submit_count: 3,
        phase_us: {},
      },
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(1);
  });

  it('handles orchestrator phase with non-orch_ prefix', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator_phases: [
        [{ phase: 'custom_phase', start_time_us: 50, end_time_us: 60, submit_idx: 0 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(1);
    expect(orchEvents[0].name).toContain('custom_phase');
  });
});

describe('PerfSwimlaneConverter.convertWithDeps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads deps.json and name_map file when they exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (String(path).includes('deps.json')) {
        return JSON.stringify({
          edges: [
            { pred: 0, succ: 1 },
            { pred: '1', succ: '2' },
            { pred: -1, succ: -2 },
            { pred: 0, succ: 1 },
            {},
          ],
        });
      }
      if (String(path).includes('name_map')) {
        return JSON.stringify({ callable_id_to_name: { '1': 'Add' } });
      }
      return '{}';
    });
    vi.mocked(fs.readdirSync).mockReturnValue(['xxx_name_map.json'] as any);

    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, fanout: [] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300 }),
      ],
    };
    const result = PerfSwimlaneConverter.convertWithDeps(data, '/test/dir');
    expect(result.traceEvents.length).toBeGreaterThan(0);
    const durationEvents = result.traceEvents.filter(e => e.ph === 'X' && e.cat === 'event');
    expect(durationEvents[0].name).toContain('Add');
  });

  it('works without deps.json and name_map file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);

    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask({ task_id: 0 })],
    };
    const result = PerfSwimlaneConverter.convertWithDeps(data, '/test/dir');
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('uses preloadedData when provided', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
    };
    const result = PerfSwimlaneConverter.convertWithDeps(data, '/test/dir', { preloadedData: data });
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('handles readdirSync throwing in findNameMapFile', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error('permission denied'); });

    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
    };
    const result = PerfSwimlaneConverter.convertWithDeps(data, '/test/dir');
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('uses custom depsFilePath and nameMapFilePath', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((path: any) => {
      if (String(path).includes('custom_deps.json')) {
        return JSON.stringify({ edges: [{ pred: 0, succ: 1 }] });
      }
      if (String(path).includes('custom_name.json')) {
        return JSON.stringify({ callable_id_to_name: { '1': 'Custom' } });
      }
      return '{}';
    });

    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, fanout: [] }),
        createTask({ task_id: 1, start_time_us: 200, end_time_us: 300 }),
      ],
    };
    const result = PerfSwimlaneConverter.convertWithDeps(data, '/test/dir', {
      depsFilePath: '/test/custom_deps.json',
      nameMapFilePath: '/test/custom_name.json',
    });
    const durationEvents = result.traceEvents.filter(e => e.ph === 'X' && e.cat === 'event');
    expect(durationEvents[0].name).toContain('Custom');
  });
});

describe('PerfSwimlaneConverter private methods', () => {
  it('formatTaskDisplay handles various task IDs', () => {
    const c = new PerfSwimlaneConverter();
    expect((c as any).formatTaskDisplay(0)).toBe('t0');
    expect((c as any).formatTaskDisplay(1)).toBe('t1');
    expect((c as any).formatTaskDisplay(BigInt(0x100000001))).toBe('r1t1');
    expect((c as any).formatTaskDisplay(-1)).toContain('r');
  });

  it('normalizePto2TaskIdInt handles various inputs', () => {
    const c = new PerfSwimlaneConverter();
    expect((c as any).normalizePto2TaskIdInt(0)).toBe(0);
    expect((c as any).normalizePto2TaskIdInt(42)).toBe(42);
    expect((c as any).normalizePto2TaskIdInt(BigInt(42))).toBe(42);
    expect((c as any).normalizePto2TaskIdInt(-1)).toBeNull();
    expect((c as any).normalizePto2TaskIdInt(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBeNull();
    expect((c as any).normalizePto2TaskIdInt(NaN)).toBeNull();
  });

  it('funcIdToLetter converts func IDs correctly', () => {
    const c = new PerfSwimlaneConverter();
    expect((c as any).funcIdToLetter(0)).toBe('0_a');
    expect((c as any).funcIdToLetter(25)).toBe('25_z');
    expect((c as any).funcIdToLetter(26)).toBe('26_aa');
    expect((c as any).funcIdToLetter(-1)).toBe('-1');
    expect((c as any).funcIdToLetter(NaN)).toBe('NaN');
  });

  it('loadDepsEdges handles duplicates, missing fields, string and negative values', () => {
    const depsJson = JSON.stringify({
      edges: [
        { pred: 1, succ: 2 },
        { pred: 1, succ: 2 },
        { pred: 1, succ: 3 },
        { pred: '3', succ: '4' },
        { pred: -1, succ: -2 },
        { pred: 1 },
        { succ: 2 },
        {},
      ],
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(depsJson);

    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 1, fanout: [] }),
        createTask({ task_id: 2, start_time_us: 200, end_time_us: 300 }),
      ],
    };
    const result = PerfSwimlaneConverter.convertWithDeps(data, '/test/dir');
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('loadDepsEdges handles deps.json without edges field', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
    };
    const result = PerfSwimlaneConverter.convertWithDeps(data, '/test/dir');
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('getTaskName uses funcIdToName when available', () => {
    const c = new PerfSwimlaneConverter();
    expect((c as any).getTaskName(1, 't0', { '1': 'AddOp' })).toBe('AddOp(t0)');
    expect((c as any).getTaskName(1, 't0', undefined)).toBe('func_1_b(t0)');
    expect((c as any).getTaskName(1, 't0', {})).toBe('func_1_b(t0)');
  });
});

describe('PerfSwimlaneConverter branch coverage', () => {
  it('scheduler phase with undefined phase falls back to unknown then skipped', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: undefined as any, loop_iter: 0, tasks_processed: 0 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const schedulerEvents = result.traceEvents.filter(e => e.cat === 'scheduler');
    expect(schedulerEvents.length).toBe(0);
  });

  it('scheduler phase with empty string phase falls back to unknown then skipped', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: '', loop_iter: 0, tasks_processed: 0 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const schedulerEvents = result.traceEvents.filter(e => e.cat === 'scheduler');
    expect(schedulerEvents.length).toBe(0);
  });

  it('scheduler phase with zero loop_iter and tasks_processed uses fallback', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'complete', loop_iter: 0, tasks_processed: 0 }],
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: undefined as any, tasks_processed: undefined as any }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const schedulerEvents = result.traceEvents.filter(e => e.cat === 'scheduler');
    expect(schedulerEvents.length).toBe(2);
    expect(schedulerEvents[0].args['loop_iter']).toBe(0);
    expect(schedulerEvents[0].args['tasks_processed']).toBe(0);
  });

  it('orchestrator phase with undefined phase falls back to unknown', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator_phases: [
        [{ phase: undefined as any, start_time_us: 50, end_time_us: 60, submit_idx: 0 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(1);
    expect(orchEvents[0].args['phase']).toBe('unknown');
  });

  it('orchestrator phase with non-orch_ prefix and undefined task_id uses submit_idx', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator_phases: [
        [{ phase: 'custom', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: undefined }],
        [{ phase: 'custom2', start_time_us: 60, end_time_us: 70, submit_idx: undefined as any }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(2);
    expect(orchEvents[0].name).toBe('custom(0)');
    expect(orchEvents[1].name).toBe('custom2(0)');
  });

  it('orchestrator data with undefined phase_us and submit_count', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator: {
        start_time_us: 0, end_time_us: 100, submit_count: undefined as any, phase_us: undefined as any,
      },
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(1);
    expect(orchEvents[0].args['submit_count']).toBe(0);
  });

  it('orchestrator data with zero total phase_us', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator: {
        start_time_us: 0, end_time_us: 100, submit_count: 3, phase_us: { idle: 0 },
      },
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(1);
    expect(orchEvents[0].args['idle_us']).toBeUndefined();
  });

  it('orchestrator data with submit_count 0', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator: {
        start_time_us: 0, end_time_us: 100, submit_count: 0, phase_us: { submit: 10 },
      },
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(1);
    expect(orchEvents[0].name).toContain('0');
  });

  it('dispatch flow with taskToAicpuTid undefined (no aicpu data)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
      core_to_thread: [0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const dispatchFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlows.length).toBeGreaterThan(0);
  });

  it('core_to_thread with negative value is skipped', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
        createTask({ task_id: 1, core_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
      ],
      core_to_thread: [-1, 0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const dispatchFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlows.length).toBeGreaterThan(0);
  });

  it('vote-based thread mapping with no matching thread for a task', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 500, finish_time_us: 600 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('vote-based thread mapping with multiple threads and votes', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 75, finish_time_us: 200 }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 76, finish_time_us: 310 }),
        createTask({ task_id: 2, core_id: 1, start_time_us: 300, end_time_us: 400, dispatch_time_us: 175, finish_time_us: 410 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 80, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
        [{ start_time_us: 170, end_time_us: 180, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
        [{ start_time_us: 70, end_time_us: 80, phase: 'complete', loop_iter: 1, tasks_processed: 0 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const dispatchFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlows.length).toBeGreaterThan(0);
  });

  it('orchestrator anchor: orch_submit overwrites existing non-submit anchor', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_fanin', start_time_us: 50, end_time_us: 55, submit_idx: 0, task_id: 0 },
          { phase: 'orch_submit', start_time_us: 55, end_time_us: 60, submit_idx: 0, task_id: 0 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const submitFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'submit→dispatch');
    expect(submitFlows.length).toBeGreaterThan(0);
  });

  it('orchestrator anchor: orch_submit does not overwrite existing submit anchor', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_submit', start_time_us: 50, end_time_us: 55, submit_idx: 0, task_id: 0 },
          { phase: 'orch_submit', start_time_us: 55, end_time_us: 60, submit_idx: 1, task_id: 0 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const submitFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'submit→dispatch');
    expect(submitFlows.length).toBeGreaterThan(0);
  });

  it('orchestrator flow with task dispatch_time_us 0', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 0, finish_time_us: 210 }),
      ],
      aicpu_orchestrator_phases: [
        [{ phase: 'orch_submit', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: 0 }],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
      core_to_thread: [0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('orchestrator flow with no anchor for task', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 99, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
      ],
      aicpu_orchestrator_phases: [
        [{ phase: 'orch_submit', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: 0 }],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
      core_to_thread: [0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('aicpu flow with taskToAicpuTid undefined for successor', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, core_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: 180, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('scheduler with empty thread array (no dispatch phases)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'complete', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('vote-based mapping: second thread has fewer votes than first (count <= maxVotes)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 75, finish_time_us: 200 }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 76, finish_time_us: 310 }),
        createTask({ task_id: 2, core_id: 0, start_time_us: 300, end_time_us: 400, dispatch_time_us: 77, finish_time_us: 410 }),
        createTask({ task_id: 3, core_id: 0, start_time_us: 400, end_time_us: 500, dispatch_time_us: 175, finish_time_us: 510 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 80, phase: 'dispatch', loop_iter: 1, tasks_processed: 3 }],
        [{ start_time_us: 170, end_time_us: 180, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('vote-based mapping: task with undefined dispatch_time_us hits falsy fallback in computeCoreThreadVotes', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 75, finish_time_us: 200 }),
        createTask({ task_id: 1, core_id: 1, start_time_us: 200, end_time_us: 300, dispatch_time_us: undefined as any, finish_time_us: 310 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 80, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('orchestrator with empty phases and undefined orchestratorData (else-if false branch)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [createTask()],
      aicpu_orchestrator_phases: [],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const metadataEvents = result.traceEvents.filter(e => e.cat === '__metadata' && e.pid === 1);
    expect(metadataEvents.length).toBeGreaterThan(0);
    const orchEvents = result.traceEvents.filter(e => e.cat === 'orchestrator');
    expect(orchEvents.length).toBe(0);
  });

  it('dispatch flow: task not in taskToAicpuTid uses coreTid fallback', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 0, finish_time_us: 0 }),
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 1 }],
      ],
      core_to_thread: [0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const dispatchFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.name === 'dispatch');
    expect(dispatchFlows.length).toBeGreaterThan(0);
  });

  it('aicpu flow: dependency (not hb_violation) when srcFinish <= dstDispatch', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 100, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 100, end_time_us: 200, dispatch_time_us: 100, finish_time_us: 200 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    const aicpuDepFlows = result.traceEvents.filter(e => e.cat === 'flow' && e.pid === 3 && e.name === 'dependency');
    expect(aicpuDepFlows.length).toBeGreaterThan(0);
  });

  it('aicpu flow: successor without aicpu event ID (dstAicpuEid undefined)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 0, finish_time_us: 0 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('aicpu flow: task with task_id exceeding MAX_SAFE_INTEGER (taskIdNum null)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: BigInt(Number.MAX_SAFE_INTEGER) + 1n, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 100, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('aicpu flow: task with undefined fanout uses empty array fallback', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: undefined as any }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('aicpu flow: source task without aicpu event ID (srcAicpuEid undefined)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 0, fanout: [1] }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 100, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('aicpu flow with depsEdges: task_id null (normalizePto2TaskIdInt returns null)', () => {
    const depsEdges = new Map<number, number[]>([[1, [2]]]);
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: BigInt(Number.MAX_SAFE_INTEGER) + 1n, core_id: 0, dispatch_time_us: 80, finish_time_us: 210, fanout: [] }),
        createTask({ task_id: 2, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: 100, finish_time_us: 310 }),
      ],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data, { depsEdges });
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });

  it('orchestrator flow with task dispatch_time_us undefined (falsy fallback)', () => {
    const data: PerfSwimlaneData = {
      version: 1,
      tasks: [
        createTask({ task_id: 0, core_id: 0, dispatch_time_us: 80, finish_time_us: 210 }),
        createTask({ task_id: 1, core_id: 0, start_time_us: 200, end_time_us: 300, dispatch_time_us: undefined as any, finish_time_us: 310 }),
      ],
      aicpu_orchestrator_phases: [
        [
          { phase: 'orch_submit', start_time_us: 50, end_time_us: 60, submit_idx: 0, task_id: 0 },
          { phase: 'orch_submit', start_time_us: 55, end_time_us: 65, submit_idx: 1, task_id: 1 },
        ],
      ],
      aicpu_scheduler_phases: [
        [{ start_time_us: 70, end_time_us: 90, phase: 'dispatch', loop_iter: 1, tasks_processed: 2 }],
      ],
      core_to_thread: [0],
    };
    const converter = new PerfSwimlaneConverter();
    const result = converter.convert(data);
    expect(result.traceEvents.length).toBeGreaterThan(0);
  });
});
