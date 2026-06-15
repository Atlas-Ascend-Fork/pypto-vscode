import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';


export interface PerfSwimlaneData {
  version: number;
  tasks: TaskRecord[];
  perf_patch_diagnostics?: any;
  aicpu_scheduler_phases?: SchedulerPhaseRecord[][];
  aicpu_orchestrator?: OrchestratorData;
  aicpu_orchestrator_phases?: OrchestratorPhaseRecord[][];
  core_to_thread?: number[];
}

export interface TaskRecord {
  task_id: number | bigint;
  func_id: number;
  core_id: number;
  core_type: 'aic' | 'aiv';
  ring_id: number;
  start_time_us: number;
  end_time_us: number;
  duration_us: number;
  kernel_ready_time_us: number;
  dispatch_time_us?: number;
  finish_time_us?: number;
  fanout: (number | bigint)[];
  fanout_count: number;
}

export interface SchedulerPhaseRecord {
  start_time_us: number;
  end_time_us: number;
  phase: string;
  loop_iter: number;
  tasks_processed: number;
}

export interface OrchestratorData {
  start_time_us: number;
  end_time_us: number;
  submit_count: number;
  phase_us: Record<string, number>;
}

export interface OrchestratorPhaseRecord {
  phase: string;
  start_time_us: number;
  end_time_us: number;
  submit_idx: number;
  task_id?: number | bigint;
}

export interface TraceEvent {
  ph: string;
  name: string;
  pid: number;
  tid?: number;
  ts?: number;
  dur?: number;
  id?: number;
  cat?: string;
  args?: Record<string, any>;
  cname?: string;
  bp?: string;
  bind_id?: number;
}

export interface ChromeTraceData {
  traceEvents: TraceEvent[];
}

export interface ConvertOptions {
  depsEdges?: Map<number, number[]>;
  funcIdToName?: Record<string, string>;
}

export interface ConvertFileOptions {
  depsFilePath?: string;
  nameMapFilePath?: string;
  preloadedData?: PerfSwimlaneData;
}



export class PerfSwimlaneConverter {
  private eventIdCounter = 0;
  private flowIdCounter = 0;

  static convertWithDeps(
    data: PerfSwimlaneData,
    fileDir: string,
    options?: ConvertFileOptions
  ): ChromeTraceData {

    let depsEdges: Map<number, number[]> | undefined;
    const depsPath = options?.depsFilePath || join(fileDir, 'deps.json');
    if (existsSync(depsPath)) {
      depsEdges = this.loadDepsEdges(depsPath);
    }

    let funcIdToName: Record<string, string> | undefined;
    const nameMapPath = options?.nameMapFilePath || this.findNameMapFile(fileDir);
    if (nameMapPath && existsSync(nameMapPath)) {
      funcIdToName = this.loadFuncIdToName(nameMapPath);
    }

    const converter = new PerfSwimlaneConverter();
    return converter.convert(data, { depsEdges, funcIdToName });
  }

  private static loadDepsEdges(depsPath: string): Map<number, number[]> {
    const depsData = JSON.parse(readFileSync(depsPath, 'utf-8'));
    const edges = depsData.edges || [];
    
    const depsEdges = new Map<number, number[]>();
    const seen = new Set<[number, number]>();
    
    for (const edge of edges) {
      if (!edge.pred || !edge.succ) {
        continue;
      }
    
      let pred = typeof edge.pred === 'number' ? edge.pred : parseInt(edge.pred);
      let succ = typeof edge.succ === 'number' ? edge.succ : parseInt(edge.succ);
    
      if (pred < 0) {
        pred = pred & ((1 << 64) - 1);
      }
    
      if (succ < 0) {
        succ = succ & ((1 << 64) - 1);
      }
    
      const key: [number, number] = [pred, succ];
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (!depsEdges.has(pred)) {
        depsEdges.set(pred, []);
      }
      depsEdges.get(pred)!.push(succ);
    }
    console.log('deps.json 加载成功, edges数量:', depsEdges.size);
    return depsEdges;
  }

  private static loadFuncIdToName(nameMapPath: string): Record<string, string> {
    const nameMapData = JSON.parse(readFileSync(nameMapPath, 'utf-8'));
    console.log('name_map json 加载成功.')
    const funcIdToName = nameMapData.callable_id_to_name;
    return funcIdToName;
  }

  private static findNameMapFile(dir: string): string | null {
    try {
      const files = readdirSync(dir);
      const nameMapFiles = files.filter(file => 
        file.toLowerCase().includes('name_map') && file.endsWith('.json')
      );
      if (nameMapFiles.length > 0) {
        console.log('找到 name_map 文件：', nameMapFiles[0]);
        return join(dir, nameMapFiles[0]);
      } else {
        console.log('没有找到name_map文件');
        return null;
      }
    } catch (err) {
      console.error('读取路径失败');
      return null;
    }
  }

  convert(data: PerfSwimlaneData, options?: ConvertOptions): ChromeTraceData {
    const events: TraceEvent[] = [];
    const tasks = data.tasks;
    const version = data.version;
    const depsEdges = options?.depsEdges;

    const uniqueCores = new Set<number>();
    tasks.forEach(task => uniqueCores.add(task.core_id));

    const coreToTid = new Map<number, number>();
    Array.from(uniqueCores).sort((a, b) => a - b).forEach(coreId => {
      coreToTid.set(coreId, 40000 + coreId * 10);
    });

    const hasAicpuData = tasks.some(
      task => task.dispatch_time_us && task.dispatch_time_us > 0 &&
               task.finish_time_us && task.finish_time_us > 0
    );

    const taskToEventId = new Map<string, number>();
    const taskToAicpuEventId = new Map<string, number>();
    const taskToAicpuTid = new Map<string, number>();
    const aicpuTidSet = new Set<number>();
    const coreAicpuTasks = new Map<number, TaskRecord[]>();
    
    if (hasAicpuData) {
      this.buildAicpuTidMapping(tasks, coreToTid, taskToAicpuTid, aicpuTidSet, coreAicpuTasks);
    }

    this.addMetadataEvents(events, tasks, coreToTid, version, aicpuTidSet, coreAicpuTasks);
    this.addDurationEvents(events, tasks, coreToTid, taskToEventId, version, depsEdges, options?.funcIdToName);
    if (hasAicpuData) {
      this.addAicpuViewEvents(events, tasks, taskToAicpuTid, coreToTid, taskToAicpuEventId, options?.funcIdToName);
    }

    this.addFlowEvents(events, tasks, coreToTid, taskToEventId, depsEdges);
    if (data.aicpu_scheduler_phases) {
      this.addSchedulerPhaseEvents(events, data.aicpu_scheduler_phases);
    }

    if (data.aicpu_orchestrator_phases || data.aicpu_orchestrator) {
      this.addOrchestratorEvents(events, data.aicpu_orchestrator_phases, data.aicpu_orchestrator);
    }

    if (hasAicpuData) {
      this.addAicpuFlowEvents(events, tasks, taskToAicpuTid, coreToTid, taskToAicpuEventId, depsEdges);
    }

    if (hasAicpuData && data.aicpu_scheduler_phases) {
      this.addDispatchFlowEvents(events, tasks, coreToTid, data.aicpu_scheduler_phases, data.core_to_thread, taskToAicpuTid);
    }

    if (data.aicpu_orchestrator_phases && data.aicpu_scheduler_phases && hasAicpuData) {
      this.addOrchestratorFlowEvents(events, tasks, coreToTid, data.aicpu_orchestrator_phases, data.aicpu_scheduler_phases, data.core_to_thread);
    }

    return { traceEvents: events };
  }

  private buildAicpuTidMapping(
    tasks: TaskRecord[],
    coreToTid: Map<number, number>,
    taskToAicpuTid: Map<string, number>,
    aicpuTidSet: Set<number>,
    coreAicpuTasks: Map<number, TaskRecord[]>
  ): void {
    for (const task of tasks) {
      const d = task.dispatch_time_us || 0;
      const f = task.finish_time_us || 0;
      if (d < 0 || f <= 0) {
        continue;
      }
      if (!coreAicpuTasks.has(task.core_id)) {
        coreAicpuTasks.set(task.core_id, []);
      }
      coreAicpuTasks.get(task.core_id)!.push(task);
    }

    for (const ctList of coreAicpuTasks.values()) {
      ctList.sort((a, b) => (a.dispatch_time_us || 0) - (b.dispatch_time_us || 0));
    }

    for (const [coreId, ctList] of coreAicpuTasks.entries()) {
      const baseTid = coreToTid.get(coreId)!;
      const laneFinish: number[] = [0];
      
      for (const task of ctList) {
        const d = task.dispatch_time_us!;
        let assigned = -1;
        
        for (let laneIdx = 0; laneIdx < laneFinish.length; laneIdx++) {
          if (laneFinish[laneIdx] <= d) {
            assigned = laneIdx;
            break;
          }
        }
        
        if (assigned < 0) {
          assigned = laneFinish.length;
          laneFinish.push(0);
        }
        
        laneFinish[assigned] = task.finish_time_us!;
        const tid = assigned === 0 ? baseTid : baseTid + assigned;
        taskToAicpuTid.set(this.getTaskKey(task.task_id, task.core_id), tid);
        aicpuTidSet.add(tid);
      }
    }
  }

  private addMetadataEvents(events: TraceEvent[], tasks: TaskRecord[], coreToTid: Map<number, number>, version: number, aicpuTidSet: Set<number>, coreAicpuTasks: Map<number, TaskRecord[]>): void {
    events.push({
      args: { name: 'AICore View' },
      cat: '__metadata',
      name: 'process_name',
      ph: 'M',
      pid: 4
    });
    events.push({
      args: { sort_index: 4 },
      cat: '__metadata',
      name: 'process_sort_index',
      ph: 'M',
      pid: 4
    });

    const hasAicpuData = aicpuTidSet.size > 0;

    if (hasAicpuData) {
      events.push({
        args: { name: 'AICPU View' },
        cat: '__metadata',
        name: 'process_name',
        ph: 'M',
        pid: 3
      });
      events.push({
        args: { sort_index: 3 },
        cat: '__metadata',
        name: 'process_sort_index',
        ph: 'M',
        pid: 3
      });
    }

    for (const [coreId, baseTid] of coreToTid.entries()) {
      const ctList = coreAicpuTasks.get(coreId);
      const coreTypeStr = ctList && ctList.length > 0 ? ctList[0].core_type.toUpperCase() : 'AIC';
      const threadName = `${coreTypeStr}_${coreId}`;

      events.push({
        args: { name: threadName },
        cat: '__metadata',
        name: 'thread_name',
        ph: 'M',
        pid: 4,
        tid: baseTid
      });

      if (hasAicpuData) {
        const aicpuBaseTid = baseTid;
        
        if (aicpuTidSet.has(aicpuBaseTid) || aicpuTidSet.size === 0) {
          events.push({
            args: { name: threadName },
            cat: '__metadata',
            name: 'thread_name',
            ph: 'M',
            pid: 3,
            tid: aicpuBaseTid
          });
        }

        const overflowTid = aicpuBaseTid + 1;
        if (aicpuTidSet.has(overflowTid)) {
          events.push({
            args: { name: threadName },
            cat: '__metadata',
            name: 'thread_name',
            ph: 'M',
            pid: 3,
            tid: overflowTid
          });
        }
      }
    }
  }

  private getTaskKey(taskId: number | bigint, coreId: number): string {
    return `${taskId}_${coreId}`;
  }

  private addDurationEvents(events: TraceEvent[], tasks: TaskRecord[], coreToTid: Map<number, number>, taskToEventId: Map<string, number>, version: number, depsEdges?: Map<number, number[]>, funcIdToName?: Record<string, string>): void {
    for (const task of tasks) {
      const tid = coreToTid.get(task.core_id)!;
      const ts = task.start_time_us;
      const dur = task.duration_us;

      let fanoutStr = '[]';
      if (depsEdges) {
        const taskIdNum = this.normalizePto2TaskIdInt(task.task_id);
        if (taskIdNum !== null) {
          const successors = depsEdges.get(taskIdNum);
          if (successors && successors.length > 0) {
            fanoutStr = '[' + successors.map(id => this.formatTaskDisplay(id)).join(', ') + ']';
          }
        }
      } else if (task.fanout && task.fanout.length > 0) {
        fanoutStr = '[' + task.fanout.map(id => this.formatTaskDisplay(id)).join(', ') + ']';
      }

      const funcId = task.func_id;
      const tdisp = this.formatTaskDisplay(task.task_id);
      const taskName = this.getTaskName(funcId, tdisp, funcIdToName);

      const eventId = this.eventIdCounter++;

      events.push({
        args: {
          'event-hint': `Task:${tdisp}, FuncId:${funcId}, CoreId:${task.core_id}`,
          'fanout-hint': fanoutStr,
          'duration-us': dur,
          'taskId': task.task_id
        },
        cat: 'event',
        id: eventId,
        name: taskName,
        ph: 'X',
        pid: 4,
        tid,
        ts,
        dur
      });

      taskToEventId.set(this.getTaskKey(task.task_id, task.core_id), eventId);
    }
  }

  private addAicpuViewEvents(events: TraceEvent[], tasks: TaskRecord[], taskToAicpuTid: Map<string, number>, coreToTid: Map<number, number>, taskToAicpuEventId: Map<string, number>, funcIdToName?: Record<string, string>): void {
    for (const task of tasks) {
      const dispatchUs = task.dispatch_time_us || 0;
      const finishUs = task.finish_time_us || 0;

      if (dispatchUs < 0 || finishUs <= 0) {
        continue;
      }

      const tid = taskToAicpuTid.get(this.getTaskKey(task.task_id, task.core_id)) ?? coreToTid.get(task.core_id);
      const aicpuDur = finishUs - dispatchUs;

      const funcId = task.func_id;
      const tdisp = this.formatTaskDisplay(task.task_id);
      const taskName = this.getTaskName(funcId, tdisp, funcIdToName);

      const eventId = this.eventIdCounter++;

      events.push({
        args: {
          'event-hint': `Task:${tdisp}, FuncId:${funcId}, CoreId:${task.core_id}`,
          'dispatch-time-us': dispatchUs,
          'finish-time-us': finishUs,
          'aicpu-duration-us': aicpuDur,
          'taskId': task.task_id
        },
        cat: 'event',
        id: eventId,
        name: taskName,
        ph: 'X',
        pid: 3,
        tid,
        ts: dispatchUs,
        dur: aicpuDur
      });

      taskToAicpuEventId.set(this.getTaskKey(task.task_id, task.core_id), eventId);
    }
  }

  private addFlowEvents(events: TraceEvent[], tasks: TaskRecord[], coreToTid: Map<number, number>, taskToEventId: Map<string, number>, depsEdges?: Map<number, number[]>): void {
    const taskMap = new Map<number | bigint, TaskRecord>();
    tasks.forEach(task => taskMap.set(task.task_id, task));

    for (const task of tasks) {
      const srcTid = coreToTid.get(task.core_id)!;
      const srcTsEnd = task.end_time_us;

      //
      let successorIds: (number | bigint)[] = [];
      if (depsEdges) {
        const taskIdNum = this.normalizePto2TaskIdInt(task.task_id);
        if (taskIdNum !== null) {
          const successors = depsEdges.get(taskIdNum);
          if (successors) {
            successorIds = successors;
          }
        }
      } else {
        successorIds = task.fanout || [];
      }

      for (const succTaskId of successorIds) {
        const succTask = taskMap.get(succTaskId);
        if (!succTask) {
          continue;
        }

        const dstTid = coreToTid.get(succTask.core_id)!;
        const dstTsStart = succTask.start_time_us;

        const srcEventId = taskToEventId.get(this.getTaskKey(task.task_id, task.core_id))!;
        const dstEventId = taskToEventId.get(this.getTaskKey(succTask.task_id, succTask.core_id))!;

        const hbViolated = srcTsEnd > dstTsStart;
        const flowName = hbViolated ? 'hb_violation' : 'dependency';

        const flowStartUs = srcTsEnd - 0.01;

        events.push({
          cat: 'flow',
          id: this.flowIdCounter,
          name: flowName,
          ph: 's',
          pid: 4,
          tid: srcTid,
          ts: flowStartUs,
          bind_id: srcEventId
        });

        events.push({
          cat: 'flow',
          id: this.flowIdCounter++,
          name: flowName,
          ph: 'f',
          pid: 4,
          tid: dstTid,
          ts: dstTsStart,
          bp: 'e',
          bind_id: dstEventId
        });
      }
    }
  }

  private addAicpuFlowEvents(events: TraceEvent[], tasks: TaskRecord[], taskToAicpuTid: Map<string, number>, coreToTid: Map<number, number>, taskToAicpuEventId: Map<string, number>, depsEdges?: Map<number, number[]>): void {
    const taskMap = new Map<number | bigint, TaskRecord>();
    tasks.forEach(task => taskMap.set(task.task_id, task));

    for (const task of tasks) {
      const srcFinishUs = task.finish_time_us || 0;
      if (srcFinishUs < 0) {
        continue;
      }

      const srcTid = taskToAicpuTid.get(this.getTaskKey(task.task_id, task.core_id)) ?? coreToTid.get(task.core_id);
      const srcAicpuEid = taskToAicpuEventId.get(this.getTaskKey(task.task_id, task.core_id));

      let successorIds: (number | bigint)[] = [];
      if (depsEdges) {
        const taskIdNum = this.normalizePto2TaskIdInt(task.task_id);
        if (taskIdNum !== null) {
          const successors = depsEdges.get(taskIdNum);
          if (successors) {
            successorIds = successors;
          }
        }
      } else {
        successorIds = task.fanout || [];
      }

      for (const succTaskId of successorIds) {
        const succTask = taskMap.get(succTaskId);
        if (!succTask) {
          continue;
        }

        const dstDispatchUs = succTask.dispatch_time_us || 0;
        if (dstDispatchUs < 0) {
          continue;
        }

        const dstTid = taskToAicpuTid.get(this.getTaskKey(succTaskId, succTask.core_id)) ?? coreToTid.get(succTask.core_id);
        const dstAicpuEid = taskToAicpuEventId.get(this.getTaskKey(succTaskId, succTask.core_id));

        const aicpuHbViolated = srcFinishUs > dstDispatchUs;
        const aicpuFlowName = aicpuHbViolated ? 'hb_violation' : 'dependency';

        const flowStartEvent: TraceEvent = {
          cat: 'flow',
          id: this.flowIdCounter,
          name: aicpuFlowName,
          ph: 's',
          pid: 3,
          tid: srcTid,
          ts: srcFinishUs - 0.01
        };

        if (srcAicpuEid !== undefined) {
          flowStartEvent.bind_id = srcAicpuEid;
        }
        events.push(flowStartEvent);

        const flowFinishEvent: TraceEvent = {
          cat: 'flow',
          id: this.flowIdCounter++,
          name: aicpuFlowName,
          ph: 'f',
          pid: 3,
          tid: dstTid,
          ts: dstDispatchUs,
          bp: 'e'
        };

        if (dstAicpuEid !== undefined) {
          flowFinishEvent.bind_id = dstAicpuEid;
        }
        events.push(flowFinishEvent);
      }
    }
  }

  private addSchedulerPhaseEvents(events: TraceEvent[], schedulerPhases: SchedulerPhaseRecord[][]): void {
    events.push({
      args: { name: 'AICPU Scheduler' },
      cat: '__metadata',
      name: 'process_name',
      ph: 'M',
      pid: 2
    });
    events.push({
      args: { sort_index: 2 },
      cat: '__metadata',
      name: 'process_sort_index',
      ph: 'M',
      pid: 2
    });

    const phaseColors: Record<string, string> = {
      'complete': 'good',
      'dispatch': 'terrible'
    };

    for (let threadIdx = 0; threadIdx < schedulerPhases.length; threadIdx++) {
      const tid = 2000 + threadIdx;

      events.push({
        args: { name: `Sched_${threadIdx}` },
        cat: '__metadata',
        name: 'thread_name',
        ph: 'M',
        pid: 2,
        tid
      });

      for (const record of schedulerPhases[threadIdx]) {
        const phase = record.phase || 'unknown';

        if (phase !== 'complete' && phase !== 'dispatch') {
          continue;
        }

        const startUs = record.start_time_us;
        const endUs = record.end_time_us;
        const dur = endUs - startUs;
        const tasksProcessed = record.tasks_processed || 0;

        events.push({
          args: {
            phase: phase,
            loop_iter: record.loop_iter || 0,
            tasks_processed: tasksProcessed
          },
          cat: 'scheduler',
          cname: phaseColors[phase] || 'generic_work',
          name: `${phase}(${tasksProcessed})`,
          ph: 'X',
          pid: 2,
          tid,
          ts: startUs,
          dur
        });
      }
    }
  }

  private addOrchestratorEvents(events: TraceEvent[], orchestratorPhases?: OrchestratorPhaseRecord[][], orchestratorData?: OrchestratorData): void {
    events.push({
      args: { name: 'AICPU Orchestrator' },
      cat: '__metadata',
      name: 'process_name',
      ph: 'M',
      pid: 1
    });
    events.push({
      args: { sort_index: 1 },
      cat: '__metadata',
      name: 'process_sort_index',
      ph: 'M',
      pid: 1
    });

    if (orchestratorPhases && orchestratorPhases.length > 0) {
      for (let orchIdx = 0; orchIdx < orchestratorPhases.length; orchIdx++) {
        const tid = 1000 + orchIdx;

        events.push({
          args: { name: `Orch_${orchIdx}` },
          cat: '__metadata',
          name: 'thread_name',
          ph: 'M',
          pid: 1,
          tid
        });

        const orchPhaseColors: Record<string, string> = {
          'orch_submit': 'rail_animation',
          'orch_sync': 'thread_state_iowait',
          'orch_alloc': 'terrible',
          'orch_params': 'good',
          'orch_lookup': 'thread_state_running',
          'orch_heap': 'yellow',
          'orch_insert': 'olive',
          'orch_fanin': 'rail_animation',
          'orch_finalize': 'cq_build_passed',
          'orch_scope_end': 'generic_work'
        };

        for (const record of orchestratorPhases[orchIdx]) {
          const phase = record.phase || 'unknown';
          const startUs = record.start_time_us;
          const endUs = record.end_time_us;
          const dur = endUs - startUs;
          const submitIdx = record.submit_idx || 0;
          const taskId = record.task_id;

          const displayName = phase.startsWith('orch_') ? phase.replace('orch_', '') : phase;
          const label = taskId !== undefined ? `${displayName}(${this.formatTaskDisplay(taskId)})` : `${displayName}(${submitIdx})`;

          events.push({
            args: {
              phase: phase,
              submit_idx: submitIdx,
              task_id: taskId
            },
            cat: 'orchestrator',
            cname: orchPhaseColors[phase] || 'generic_work',
            name: label,
            ph: 'X',
            pid: 1,
            tid,
            ts: startUs,
            dur
          });
        }
      }
    } else if (orchestratorData) {
      events.push({
        args: { name: 'Orchestrator' },
        cat: '__metadata',
        name: 'thread_name',
        ph: 'M',
        pid: 1,
        tid: 1000
      });

      const orchStart = orchestratorData.start_time_us;
      const orchEnd = orchestratorData.end_time_us;
      const orchDur = orchEnd - orchStart;
      const phaseUs = orchestratorData.phase_us || {};

      const orchArgs: Record<string, any> = {
        submit_count: orchestratorData.submit_count || 0
      };

      const totalPhaseUs = Object.values(phaseUs).reduce((sum, val) => sum + val, 0);
      if (totalPhaseUs > 0) {
        for (const [phaseName, dur] of Object.entries(phaseUs)) {
          if (dur > 0) {
            const pct = (dur / totalPhaseUs) * 100;
            orchArgs[`${phaseName}_us`] = Math.round(dur * 1000) / 1000;
            orchArgs[`${phaseName}_%`] = Math.round(pct * 10) / 10;
          }
        }
      }

      events.push({
        args: orchArgs,
        cat: 'orchestrator',
        name: `Orchestrator(${orchestratorData.submit_count || 0} tasks)`,
        ph: 'X',
        pid: 1,
        tid: 1000,
        ts: orchStart,
        dur: orchDur
      });
    }
  }

  private addDispatchFlowEvents(events: TraceEvent[], tasks: TaskRecord[], coreToTid: Map<number, number>, schedulerPhases: SchedulerPhaseRecord[][], coreToThread?: number[], taskToAicpuTid?: Map<string, number>): void {
    const coreToSchedThread = new Map<number, number>();

    if (coreToThread && coreToThread.length > 0) {
      for (let coreId = 0; coreId < coreToThread.length; coreId++) {
        const threadIdx = coreToThread[coreId];
        if (threadIdx >= 0) {
          coreToSchedThread.set(coreId, threadIdx);
        }
      }
    } else {
      const dispatchPhasesByThread = new Map<number, SchedulerPhaseRecord[]>();
      for (let threadIdx = 0; threadIdx < schedulerPhases.length; threadIdx++) {
        const dispatchRecords = schedulerPhases[threadIdx].filter(r => r.phase === 'dispatch');
        if (dispatchRecords.length > 0) {
          dispatchPhasesByThread.set(threadIdx, dispatchRecords);
        }
      }

      const coreThreadVotes = new Map<number, Map<number, number>>();
      for (const task of tasks) {
        const dispatchUs = task.dispatch_time_us || 0;
        if (dispatchUs < 0) {
          continue;
        }

        const coreId = task.core_id;
        for (const [threadIdx, dispatchRecords] of dispatchPhasesByThread.entries()) {
          for (const dr of dispatchRecords) {
            if (dr.start_time_us <= dispatchUs && dispatchUs <= dr.end_time_us) {
              if (!coreThreadVotes.has(coreId)) {
                coreThreadVotes.set(coreId, new Map());
              }
              const votes = coreThreadVotes.get(coreId)!;
              votes.set(threadIdx, (votes.get(threadIdx) || 0) + 1);
              break;
            }
          }
        }
      }

      for (const [coreId, votes] of coreThreadVotes.entries()) {
        let maxVotes = -1;
        let bestThread = -1;
        for (const [threadIdx, count] of votes.entries()) {
          if (count > maxVotes) {
            maxVotes = count;
            bestThread = threadIdx;
          }
        }
        if (bestThread >= 0) {
          coreToSchedThread.set(coreId, bestThread);
        }
      }
    }

    for (const task of tasks) {
      const dispatchUs = task.dispatch_time_us || 0;
      if (dispatchUs < 0) {
        continue;
      }

      const matchedThread = coreToSchedThread.get(task.core_id);
      if (matchedThread === undefined) {
        continue;
      }

      const schedTid = 2000 + matchedThread;
      const coreTid = coreToTid.get(task.core_id)!;
      const aicpuTid = taskToAicpuTid?.get(this.getTaskKey(task.task_id, task.core_id)) ?? coreTid;

      events.push({
        cat: 'flow',
        id: this.flowIdCounter,
        name: 'dispatch',
        ph: 's',
        pid: 2,
        tid: schedTid,
        ts: dispatchUs
      });

      events.push({
        cat: 'flow',
        id: this.flowIdCounter++,
        name: 'dispatch',
        ph: 'f',
        pid: 4,
        tid: coreTid,
        ts: task.start_time_us,
        bp: 'e'
      });

      events.push({
        cat: 'flow',
        id: this.flowIdCounter,
        name: 'dispatch',
        ph: 's',
        pid: 2,
        tid: schedTid,
        ts: dispatchUs
      });

      events.push({
        cat: 'flow',
        id: this.flowIdCounter++,
        name: 'dispatch',
        ph: 'f',
        pid: 3,
        tid: aicpuTid,
        ts: dispatchUs,
        bp: 'e'
      });
    }
  }

  private addOrchestratorFlowEvents(events: TraceEvent[], tasks: TaskRecord[], coreToTid: Map<number, number>, orchestratorPhases: OrchestratorPhaseRecord[][], schedulerPhases: SchedulerPhaseRecord[][], coreToThread?: number[]): void {
    const orchAnchorByTask = new Map<number, { record: OrchestratorPhaseRecord; orchIdx: number; flowName: string }>();

    for (let orchIdx = 0; orchIdx < orchestratorPhases.length; orchIdx++) {
      for (const record of orchestratorPhases[orchIdx]) {
        const phase = record.phase;
        const taskId = record.task_id;
        if (taskId === undefined || taskId < 0) {
          continue;
        }

        const tidK = this.normalizePto2TaskIdInt(taskId);
        if (tidK === null) {
          continue;
        }

        const existing = orchAnchorByTask.get(tidK);
        if (phase === 'orch_submit' && (existing === undefined || existing.flowName !== 'submit→dispatch')) {
          orchAnchorByTask.set(tidK, { record, orchIdx, flowName: 'submit→dispatch' });
        } else if (existing === undefined && phase === 'orch_fanin') {
          orchAnchorByTask.set(tidK, { record, orchIdx, flowName: 'fanin→dispatch' });
        } else if (existing === undefined && phase === 'orch_params') {
          orchAnchorByTask.set(tidK, { record, orchIdx, flowName: 'params→dispatch' });
        }
      }
    }

    if (orchAnchorByTask.size === 0) {
      return;
    }

    const coreToSchedThread = new Map<number, number>();

    if (coreToThread && coreToThread.length > 0) {
      for (let coreId = 0; coreId < coreToThread.length; coreId++) {
        const threadIdx = coreToThread[coreId];
        if (threadIdx >= 0) {
          coreToSchedThread.set(coreId, threadIdx);
        }
      }
    } else {
      const dispatchPhasesByThread = new Map<number, SchedulerPhaseRecord[]>();
      for (let threadIdx = 0; threadIdx < schedulerPhases.length; threadIdx++) {
        const dispatchRecords = schedulerPhases[threadIdx].filter(r => r.phase === 'dispatch');
        if (dispatchRecords.length > 0) {
          dispatchPhasesByThread.set(threadIdx, dispatchRecords);
        }
      }

      const coreThreadVotes = new Map<number, Map<number, number>>();
      for (const task of tasks) {
        const dispatchUs = task.dispatch_time_us || 0;
        if (dispatchUs < 0) {
          continue;
        }

        const coreId = task.core_id;
        for (const [threadIdx, dispatchRecords] of dispatchPhasesByThread.entries()) {
          for (const dr of dispatchRecords) {
            if (dr.start_time_us <= dispatchUs && dispatchUs <= dr.end_time_us) {
              if (!coreThreadVotes.has(coreId)) {
                coreThreadVotes.set(coreId, new Map());
              }
              const votes = coreThreadVotes.get(coreId)!;
              votes.set(threadIdx, (votes.get(threadIdx) || 0) + 1);
              break;
            }
          }
        }
      }

      for (const [coreId, votes] of coreThreadVotes.entries()) {
        let maxVotes = -1;
        let bestThread = -1;
        for (const [threadIdx, count] of votes.entries()) {
          if (count > maxVotes) {
            maxVotes = count;
            bestThread = threadIdx;
          }
        }
        if (bestThread >= 0) {
          coreToSchedThread.set(coreId, bestThread);
        }
      }
    }

    for (const task of tasks) {
      const taskId = this.normalizePto2TaskIdInt(task.task_id);
      if (taskId === null) {
        continue;
      }

      const anchor = orchAnchorByTask.get(taskId);
      if (!anchor) {
        continue;
      }

      const dispatchUs = task.dispatch_time_us || 0;
      if (dispatchUs < 0) {
        continue;
      }

      const anchorUs = anchor.record.end_time_us;
      const matchedThread = coreToSchedThread.get(task.core_id);

      if (matchedThread === undefined) {
        continue;
      }

      const schedTid = 2000 + matchedThread;
      const orchTid = 1000 + anchor.orchIdx;

      events.push({
        cat: 'flow',
        id: this.flowIdCounter,
        name: anchor.flowName,
        ph: 's',
        pid: 1,
        tid: orchTid,
        ts: anchorUs
      });

      events.push({
        cat: 'flow',
        id: this.flowIdCounter++,
        name: anchor.flowName,
        ph: 'f',
        pid: 2,
        tid: schedTid,
        ts: dispatchUs,
        bp: 'e'
      });
    }
  }

  private formatTaskDisplay(mixedTaskId: number | bigint): string {
    const tid = typeof mixedTaskId === 'bigint' ? mixedTaskId : BigInt(mixedTaskId);

    if (tid < 0n) {
      const unsigned = tid & ((1n << 64n) - 1n);
      return this.formatTaskDisplay(unsigned);
    }

    const ring = Number((tid >> 32n) & 0xFFn);
    const local = Number(tid & 0xFFFFFFFFn);

    if (ring === 0) {
      return `t${local}`;
    }
    return `r${ring}t${local}`;
  }

  private normalizePto2TaskIdInt(taskId: number | bigint): number | null {
    try {
      const tid = typeof taskId === 'bigint' ? taskId : BigInt(taskId);
      let unsigned: bigint;
      if (tid < 0n) {
        unsigned = tid & ((1n << 64n) - 1n);
      } else {
        unsigned = tid;
      }
      if (unsigned > BigInt(Number.MAX_SAFE_INTEGER)) {
        return null;
      }
      return Number(unsigned);
    } catch {
      return null;
    }
  }

  private funcIdToLetter(funcId: number): string {
    const n = Number(funcId);
    if (isNaN(n) || n < 0) {
      return String(funcId);
    }
    const letters: string[] = [];
    let m = n + 1; // shift so that 0 maps to 'a' (1-based bijective base-26)
    while (m > 0) {
      m -= 1;
      const rem = m % 26;
      letters.push(String.fromCharCode('a'.charCodeAt(0) + rem));
      m = Math.floor(m / 26);
    }
    return `${n}_${letters.reverse().join('')}`;
  }

  private getTaskName(funcId: number, tdisp: string, funcIdToName?: Record<string, string>): string {
    if (funcIdToName && funcIdToName[String(funcId)]) {
      return `${funcIdToName[String(funcId)]}(${tdisp})`;
    }
    return `func_${this.funcIdToLetter(funcId)}(${tdisp})`;
  }
}