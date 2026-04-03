import { generateColorList, getColorByString } from './color-list';
import { dirname, join, extname, resolve } from 'path';
import { createReadStream,  createWriteStream, existsSync, mkdirSync } from 'fs';
import { getSwimGraphParsedInfoStore } from './core/swimSqlInit';
import { hismartliteEx } from './hismarliteEx';
import JSONStream from 'JSONStream';
import { parser } from 'stream-json';
import { chain } from 'stream-chain';
import {streamObject} from 'stream-json/streamers/StreamObject';

import { t } from 'i18next';

const getLeafIndex = (event, task2topo) => {
  const { args } = event;
  const seqNo = args?.seqNo;
  const taskId = args?.taskId;
  if (seqNo === undefined || taskId === undefined) {
    return null;
  }
  const key = `${seqNo}-${taskId}`;
  return task2topo[key]?.leafIndex;
};

export function getSemanticColor(event: any, baseColorslist:any, lightColorslist:any): { dark: { base: string; light: string } } {
  let dBaseColor: string, dLightColor: string;
  const label = event?.color || '';
  const dres = getColorByString(label, baseColorslist, lightColorslist);
  dBaseColor = dres.baseColor ?? '#666666';
  dLightColor = dres.lightColor ?? '#666666';
  return { dark: { base: dBaseColor, light: dLightColor }};
}

const FAKE_CORE_KEYWORD = 'Fake Core';

function layoutFakeCoreEvent(event, lines, allEventsMap, globalMaxTime) {
  const originalDuration = event.endTime - event.startTime;

  // --- Step 1: 计算合法窗口 [minStart, maxEnd] ---
  let minStart = event.startTime;
  let maxEnd = event.endTime;

  // 前驱约束
  if (event.dependencies?.predecessors?.length) {
    let latestPredEnd = null;

    for (const id of event.dependencies.predecessors) {
      const pred = allEventsMap.get(id);
      if (pred && pred.endTime) {
        const predEnd = pred.endTime;
        if (latestPredEnd === null || predEnd > latestPredEnd) {
          latestPredEnd = predEnd;
        }
      }
    }

    if (latestPredEnd !== null) {
      minStart = Math.min(minStart, latestPredEnd);
    }
  }

  // 后继约束
  if (event.dependencies?.successors?.length) {

    let earliestSuccStart = null;
    
    for (const id of event.dependencies.successors) {
      const succ = allEventsMap.get(id);
      if (succ && succ.startTime) {
        const succStart = succ.startTime;
        if (earliestSuccStart === null || succStart < earliestSuccStart) {
          earliestSuccStart = succStart;
        }
      }
    }
    
    if (earliestSuccStart !== null) {
      maxEnd = Math.max(maxEnd, earliestSuccStart);
    }
  }

  const linesBN = lines.map(line => {
    return line || 0;
  });

  // --- Step 2: 尝试放入已有行 ---
  for (let i = 0; i < linesBN.length; i++) {
    const rowLastEnd = linesBN[i];
    const renderStart = Math.max(minStart, rowLastEnd); // 不重叠 + 满足前驱

    if (renderStart >= maxEnd) {
      continue; // 该行没空间了
    }

    // 策略：尽可能保持原始 duration，但不超过可用空间
    const renderEnd = Math.min(renderStart + originalDuration, maxEnd);

    // 即使 available 很小（如 0.0001ms），也允许放置！
    // UI 层负责确保 canvas 上至少画 1~2px
    event.renderStartTime = renderStart;
    event.renderDuration = Math.round((renderEnd - renderStart) / 10);
    event.renderEndTime = event.renderStartTime + event.renderDuration;
    event.line = i;
    lines[i] = event.renderEndTime;
    applyGlobalClip();
    return;
  }

  // --- Step 3: 新开一行 ---
  const renderStart = minStart;
  const renderEnd = Math.min(renderStart + originalDuration, maxEnd);
  event.renderStartTime = renderStart;
  event.renderDuration = Math.round((renderEnd - renderStart) / 10);
  event.renderEndTime = event.renderStartTime + event.renderDuration;
  event.line = lines.length;
  lines.push(event.renderEndTime);

  applyGlobalClip();

  function applyGlobalClip() {
    if (event.renderEndTime > globalMaxTime) {
      event.renderEndTime = globalMaxTime;
      event.renderStartTime = Math.max(event.renderStartTime, globalMaxTime - originalDuration);
      // 如果 originalDuration 很大，可能仍超出，那就紧贴结尾
      if (event.renderStartTime >= event.renderEndTime) {
        event.renderStartTime = globalMaxTime - 1;
        event.renderEndTime = globalMaxTime;
      }
      event.renderDuration = event.renderEndTime - event.renderStartTime;
    }
  }
}

// --- 工厂函数：生成 calculateLine ---
function createCalculateLine(allEventsMap, globalMaxTime) {

  return function calculateLine(event, label2lines) {
    const isFakeCore = event.threadName?.includes?.(FAKE_CORE_KEYWORD);
    const label = `${event.pid}@${event.tid}`;

    let lines = label2lines[label];
    if (!lines) {
      label2lines[label] = lines = [];
    }

    if (isFakeCore) {
      layoutFakeCoreEvent(event, lines, allEventsMap, globalMaxTime);
    } else {
      // 普通线程：固定 renderTime，传统不重叠布局
      event.renderStartTime = event.startTime;
      event.renderEndTime = event.endTime;
      event.renderDuration = event.duration;

      let placed = false;
      for (let i = 0; i < lines.length; i++) {
        if (event.startTime >= lines[i]) {
          event.line = i;
          lines[i] = event.endTime;
          placed = true;
          break;
        }
      }
      if (!placed) {
        event.line = lines.length;
        lines.push(event.endTime);
      }
    }

    return lines.length;
  };
}

function calculateDuration (eventTasks, processedTasks) {
  let taskIndex = 0;
  let minTime = Infinity;
  let maxTime = -Infinity;
  while (taskIndex <= eventTasks.length - 1) {
    const tStart = eventTasks[taskIndex];
    if (tStart.ph.toUpperCase() === 'X') {      
      
      const ts = tStart.ts;
      const dur = Math.round(tStart.dur * 1000);
      
      const event = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: ts,
        endTime: ts + dur,
        renderStartTime: ts,
        renderEndTime: ts + dur,
        renderDuration: dur,
        duration: dur,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      processedTasks.push(event);
      taskIndex += 1;
      minTime = Math.min(minTime, event.startTime);
      maxTime = Math.max(maxTime, event.endTime);
      continue;
    }
    const tEnd = eventTasks[taskIndex + 1];

    if (tEnd && tStart.id === tEnd.id && tStart.ph.toUpperCase() === 'B' && tEnd.ph.toUpperCase() === 'E') {

      const startTs = tStart.ts;
      const endTs = tEnd.ts;

      const processedEvent = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: startTs,
        endTime: endTs,
        duration: endTs - startTs,
        renderStartTime: startTs,
        renderEndTime: endTs,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      minTime = Math.min(minTime, processedEvent.startTime);
      maxTime = Math.max(maxTime, processedEvent.endTime);
      processedTasks.push(processedEvent);
      taskIndex += 2;
    } else {
      taskIndex += 1;
    }
  }
  if (minTime === Infinity) minTime = 0;
  if (maxTime === -Infinity) maxTime = 0;
  return [maxTime, minTime];
};

export function parsePmuInfo(csvData: string) {
  const pmuInfo = {};
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const taskInfo: { [key: string]: any } = {};
    const curLine = lines[i].split(',');

    for (let j = 0; j < headers.length; j++) {
      taskInfo[headers[j]] = curLine[j] ? curLine[j].trim() : ''; 
    }
    if (taskInfo.seqNo === undefined || taskInfo['sub task id'] === undefined) {
      continue
    }
    const uid = String(taskInfo['seqNo']) + '-' + String(taskInfo['sub task id']);
    pmuInfo[uid] = taskInfo; 
    pmuInfo[uid]['vec_ratio'] = taskInfo.vec_busy_cycles / taskInfo['total cycle'];
    pmuInfo[uid]['cube_ratio'] = taskInfo.cube_busy_cycles / taskInfo['total cycle'];
    pmuInfo[uid]['scalar_ratio'] = taskInfo.scalar_busy_cycles / taskInfo['total cycle'];
    pmuInfo[uid]['mte1_ratio'] = taskInfo.mte1_busy_cycles / taskInfo['total cycle'];
    pmuInfo[uid]['mte2_ratio'] = taskInfo.mte2_busy_cycles / taskInfo['total cycle'];
    pmuInfo[uid]['mte3_ratio'] = taskInfo.mte3_busy_cycles / taskInfo['total cycle'];
    pmuInfo[uid]['icache_hit'] = 1 - taskInfo.icache_miss / taskInfo.icache_req;
    
  }
  return pmuInfo;
}

const calculateDependenciesBytopo = (events, task2topo) => {
  const predecessors: Record<string, string[]> = Object.fromEntries(Object.keys(task2topo).map(taskId => [taskId, []]));
  for (const taskId in task2topo) {
    const taskInfo = task2topo[taskId];
    for (const successor of taskInfo.successors) {
      predecessors[successor] = [...(predecessors[successor] || []), taskId];
    }
  }
  const topoDependencies: Record<string, { predecessors: string[]; successors: string[]}> = Object.fromEntries(
    Object.keys(task2topo).map(taskId => [
      taskId,
      {
        predecessors: predecessors[taskId],
        successors: task2topo[taskId].successors
      }
    ])
  );
  const taskMap = new Map<string, any>();
  for (const event of events) {
    const taskId = `${event.args.seqNo}-${event.args.taskId}`;
    if (taskMap.has(taskId)) {
      return false;
    }
    taskMap.set(taskId, event);
  }
  for (const taskId of Object.keys(topoDependencies)) {
    const taskDependencies = topoDependencies[taskId];
    const event = taskMap.get(taskId);
    if (event) {
      event.dependencies.predecessors = taskDependencies.predecessors.map(predecessor => taskMap.get(predecessor)?.id || '');
      event.dependencies.successors = taskDependencies.successors.map(successor => taskMap.get(successor)?.id || '');
    }
  }
  return true;
};

const calculateDependencies = (events, connections) => {
    // 构建索引：以 (tid, startTime, endTime) 为键，事件对象为值
    // 由于 startTime 和 endTime 是范围，我们可以使用 Map 存储每个 tid 的事件列表，并按 startTime 排序
    const eventIndex = new Map();
  
    // 预处理 events，按 tid 分组并排序
    events.forEach(event => {
      if (!event.isCounter) {
        event.dependencies = {};
        event.dependencies.predecessors = [];
        event.dependencies.successors = [];
      }
      if (!eventIndex.has(event.tid)) {
        eventIndex.set(event.tid, []);
      }
      eventIndex.get(event.tid).push(event);
    });
  
    // 对每个 tid 的事件列表按 startTime 排序
    for (let eventsList of eventIndex.values()) {
      eventsList.sort((a, b) => a.startTime - b.startTime);
    }
  
    let cIndex = 0;
    while (cIndex < connections.length) {
      const start = connections[cIndex];
      const end = connections[cIndex + 1];
      const tid1 = start.tid;
      const tid2 = end.tid;
  
      // 使用索引快速查找 parent 事件
      const parentEvents = eventIndex.get(tid1);
      const parent = parentEvents ? findEvent(parentEvents, start.ts) : null;
  
      // 使用索引快速查找 child 事件
      const childEvents = eventIndex.get(tid2);
      const child = childEvents ? findEvent(childEvents, end.ts) : null;
  
      if (parent && child && start.ts <= end.ts) {
        if (!parent.dependencies.successors.includes(child.id)) {
          parent.dependencies.successors.push(child.id);
        }
        if (!child.dependencies.predecessors.includes(parent.id)) {
          child.dependencies.predecessors.push(parent.id);
        }
      }
  
      cIndex += 2;
    }
  };
  
  // 二分查找辅助函数
  const findEvent = (eventsList, timestamp) => {
    let left = 0;
    let right = eventsList.length - 1;
  
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const event = eventsList[mid];
  
      if (timestamp >= event.startTime && timestamp <= event.endTime) {
        return event;
      } else if (timestamp < event.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
  
    return null;
  }

  function processTaskPmuCalc(event: any, pmuInfo: any, pmuNotFoundList: any, effectPmu: any) {
    if (event.threadName.includes(FAKE_CORE_KEYWORD) == true) {
      return;
    }
    const seqNo = event.args?.seqNo;
    const taskId = event.args?.taskId;
    if (seqNo === undefined || taskId === undefined) {
      return;
    }
    const taskPmuKey = String(event['args']['seqNo']) + '-' + String(event['args']['taskId']);
    const taskPmuInfo = pmuInfo[taskPmuKey];
    if (taskPmuInfo === undefined) {
      pmuNotFoundList.push(taskPmuKey);
      return;
    }
    event['pmu_info'] = taskPmuInfo;
    event['pmu_calc_info'] = {};
    event['pmu_calc_info']['vec_ratio'] = taskPmuInfo.vec_busy_cycles / taskPmuInfo['total cycle'];
    event['pmu_calc_info']['cube_ratio'] = taskPmuInfo.cube_busy_cycles / taskPmuInfo['total cycle'];
    event['pmu_calc_info']['scalar_ratio'] = taskPmuInfo.scalar_busy_cycles / taskPmuInfo['total cycle'];
    event['pmu_calc_info']['mte1_ratio'] = taskPmuInfo.mte1_busy_cycles / taskPmuInfo['total cycle'];
    event['pmu_calc_info']['mte2_ratio'] = taskPmuInfo.mte2_busy_cycles / taskPmuInfo['total cycle'];
    event['pmu_calc_info']['mte3_ratio'] = taskPmuInfo.mte3_busy_cycles / taskPmuInfo['total cycle'];
    event['pmu_calc_info']['icache_hit'] = 1 - taskPmuInfo.icache_miss / taskPmuInfo.icache_req;
    effectPmu[taskPmuKey] = taskPmuInfo;
    delete pmuInfo[taskPmuKey];
    return true;
  }

  export function processTotalPmuCalc(pmuTotal :any) {
    pmuTotal['vec_ratio'] = (Number(pmuTotal.vec_busy_cycles) / Number(pmuTotal['total cycle'])).toString();
    pmuTotal['cube_ratio'] = (Number(pmuTotal.cube_busy_cycles) / Number(pmuTotal['total cycle'])).toString();
    pmuTotal['scalar_ratio'] = (Number(pmuTotal.scalar_busy_cycles) / Number(pmuTotal['total cycle'])).toString();
    pmuTotal['mte1_ratio'] = (Number(pmuTotal.mte1_busy_cycles) / Number(pmuTotal['total cycle'])).toString();
    pmuTotal['mte2_ratio'] = (Number(pmuTotal.mte2_busy_cycles) / Number(pmuTotal['total cycle'])).toString();
    pmuTotal['mte3_ratio'] = (Number(pmuTotal.mte3_busy_cycles) / Number(pmuTotal['total cycle'])).toString();
    pmuTotal['icache_hit'] = (1 - Number(pmuTotal.icache_miss) / Number(pmuTotal.icache_req)).toString();

    pmuTotal['total cycle'] = pmuTotal['total cycle'].toString();
    pmuTotal.vec_busy_cycles = pmuTotal.vec_busy_cycles.toString();
    pmuTotal.cube_busy_cycles = pmuTotal.cube_busy_cycles.toString();
    pmuTotal.scalar_busy_cycles = pmuTotal.scalar_busy_cycles.toString();
    pmuTotal.mte1_busy_cycles = pmuTotal.mte1_busy_cycles.toString();
    pmuTotal.mte2_busy_cycles = pmuTotal.mte2_busy_cycles.toString();
    pmuTotal.mte3_busy_cycles = pmuTotal.mte3_busy_cycles.toString();
    pmuTotal.icache_miss = pmuTotal.icache_miss.toString();
    pmuTotal.icache_req = pmuTotal.icache_req.toString();
  }

  async function validate(event:any) {
    const errorMsg: any = {};

    if(!(event.ph === 'C' || event.ph === 'X' || event.ph === 'M' || event.ph === 's' || event.ph === 'f' || event.ph === 'B' || event.ph === 'E')) {
      errorMsg.errMsg = t('pypto.swimGraph.validate.unsupportedEventType', {type: event.ph});
      return errorMsg;
    }

    if (event.name === 'thread_name') {
      if (!('pid' in event) || !('tid' in event) || !('args' in event)) {
        if (event.pid && event.tid) {
          errorMsg.errMsg = t('pypto.swimGraph.validate.threadWithid', {pid: event.pid, tid: event.tid});
        } else {
          errorMsg.errMsg = t('pypto.swimGraph.validate.thread');
        }
        return errorMsg;
      }
      if (!('name' in event.args)) {
        if (event.pid && event.tid) {
          errorMsg.errMsg = t('pypto.swimGraph.validate.threadWithid', {pid: event.pid, tid: event.tid});
        } else {
          errorMsg.errMsg = t('pypto.swimGraph.validate.thread');
        }
        return errorMsg;
      }
    }
        
    if (event.ph == 'X' || event.ph == 'B' || event.ph == 'E') {
      if (!('name' in event) || !('pid' in event) || !('tid' in event) || !('ts' in event) ) {
        if (event.name) {
          errorMsg.errMsg = t('pypto.swimGraph.validate.eventWithName', {name: event.name});
        } else {
          errorMsg.errMsg = t('pypto.swimGraph.validate.event');
        }
        return errorMsg;
      }
    }

    if (event.ph === 'C') {
      if(!('name' in event) || !('pid' in event) || !('tid' in event) || !('ts' in event) || !('args' in event)) {
        if (event.name) {
          errorMsg.errMsg = t('pypto.swimGraph.validate.eventWithName', {name: event.name});
          return errorMsg;
        } else {
          errorMsg.errMsg = t('pypto.swimGraph.validate.event');
        return errorMsg;
        }
      }
      if (!('size' in event.args || '/byte' in event.args)) {
        errorMsg.errMsg = t('pypto.swimGraph.validate.cntEvent', {name: event.name});
        return errorMsg;
      }
      if (event.args.size) {
        if (!(typeof event.args.size === 'number')) {
          errorMsg.errMsg = t('pypto.swimGraph.validate.cntEvent', {name: event.name});
          return errorMsg;
        }
      }
      if (event.args['/byte']) {
        if (!(typeof event.args['/byte'] === 'number')) {
          errorMsg.errMsg = t('pypto.swimGraph.validate.cntEvent', {name: event.name});
          return errorMsg;
        }
      }
    }

    if (event.ph === 'X') {
      if(!('dur' in event)) {
        if (event.name) {
          errorMsg.errMsg = t('pypto.swimGraph.validate.eventWithName', {name: event.name});
        } else {
          errorMsg.errMsg = t('pypto.swimGraph.validate.event');
          return errorMsg;
        }
      }
    }
    return errorMsg;
  } 
  
  export async function parseSwimLaneInfo(traceData: any, pmuInfo: any, task2topo: any, effectPmu: any) {
    let counterEvents: any[] = [];
    let processes = new Map();
    let processExpanded = new Map();
    let lane2line = new Map();
    let errorMsg: any = {};
    if (!traceData || !traceData.traceEvents) {
      errorMsg.errMsg = t('pypto.swimGraph.validate.nodata');
      return errorMsg;
    }
    
    const processNames = new Map();
    const processTypes = new Map();
    const threadNames = new Map();
    const eventTasks: any[] = [];
    const connections: any[] = [];

    let minThresh = Infinity;
    for (let index = 0; index < traceData.traceEvents.length; index++) {
      const ts = traceData.traceEvents[index].ts;
      if (ts < minThresh) {
        minThresh = ts;
      }
    }

    let aicpuPid = new Set<number>();
    for (let index = 0; index < traceData.traceEvents.length; index++) {
      const event = traceData.traceEvents[index];
      event.ts = event.ts * 1000 - minThresh * 1000;

      errorMsg = await validate(event);
      if ('errMsg' in errorMsg) {
        return errorMsg;
      }

      if (event.name === 'process_name') {
        processNames.set(event.pid, event.args.name);
        if (event.args.type === 'aicpu') {
          processTypes.set(event.pid, 'aicpu');
        }
      } else if (event.name === 'thread_name') {
        threadNames.set(`${event.pid}-${event.tid}`, event.args.name);
      } else if (['X', 'B', 'E', 'C'].includes(event.ph) && !(event.name.startsWith('OOO_'))) {
        if (event.ph === 'C' && (typeof(event.args.size) === 'number' || typeof(event.args['/byte']) === 'number')) {
          const sId = event.name;
          if (!threadNames.has(sId)) {
            threadNames.set(sId, event.name);
          }
          counterEvents.push({ ...event, isCounter: true });
        } else {
          const leafIndex = getLeafIndex(event, task2topo);
          event['leafIndex'] = leafIndex;
          const color = {};
          const threadName =  threadNames.get(`${event.pid}-${event.tid}`);
          eventTasks.push({ ...event, originalIndex: index, color, threadName, leafIndex});
        }
      } else if (['s', 'f'].includes(event.ph)) {
        connections.push(event);
      }
    }
  
    let processThreadMap = new Map();
    counterEvents = counterEvents.sort((a, b) => a.ts - b.ts);
    [...eventTasks, ...counterEvents].forEach((event: any) => {
      const processKey = `${event.pid || 0}`;
      const threadKey =  event.isCounter ? event.name : `${event.pid || 0}-${event.tid || 0}`;
  
      if (!processThreadMap.has(processKey)) {
        processThreadMap.set(processKey, {
          pid: event.pid || 0,
          processName: processNames.get(event.pid) || `Process ${event.pid || 0}`,
          type: processTypes.get(event.pid) || 'kernel',
          threads: new Map()
        });
      }
  
      const process = processThreadMap.get(processKey);
      if (!process.threads.has(threadKey)) {
        const threadName = threadNames.get(threadKey) || `Thread ${event.tid || 0}`;
        process.threads.set(threadKey, {
          tid: event.tid || 0,
          threadName,
          events: []
        });
      }
    });
    
    let minTime: number;
    let maxTime: number;

    let processedTasks: any[] = [];
    [maxTime, minTime] = calculateDuration(eventTasks, processedTasks);
  
    processedTasks = processedTasks.sort((a, b) => a.startTime - b.startTime);

    let hasAicpu = false;
    let hasKernel = false;
    for (const proc of processThreadMap.values()) {
        if (proc.type === 'aicpu') hasAicpu = true;
        else hasKernel = true;
    }
    const isAicpuData = hasAicpu && !hasKernel;
    const isMixedAicpuKernel = hasAicpu && hasKernel;
  
    // 计算依赖关系

    let calcTopoDepRes = false;

    try {
      calcTopoDepRes = calculateDependenciesBytopo(processedTasks, task2topo);
    } catch (error) {
      console.log(error);
    }

    const useTopo = !isAicpuData && Object.keys(task2topo).length > 0;
    const status = useTopo ? calcTopoDepRes : false;
    if (!status) {
      calculateDependencies(processedTasks, connections);
    }

    const allEventsMap = new Map(processedTasks.map(e => [e.id, e]));
    const globalMaxTime = processedTasks.reduce((max, e) => {
      return e.endTime > max ? e.endTime : max;
    }, -Infinity); 
    const calculateLine = createCalculateLine(allEventsMap, globalMaxTime);
    const lable2lines = {};
    const pmuNotFoundList = [];
    for (const event of processedTasks) {
      //处理带dur的event
      const lineCount = calculateLine(event, lable2lines);
      lane2line.set(`${event.pid}@${event.tid}`, lineCount);
      
      //pmu info process
      if (!isAicpuData && Object.keys(pmuInfo).length > 0) {
        processTaskPmuCalc(event, pmuInfo, pmuNotFoundList, effectPmu);
      }
    }
    if (pmuNotFoundList.length > 0) {
      console.warn('info not found in pmu csv', pmuNotFoundList);
    }
    const uselessPmuInfo = Object.keys(pmuInfo);
    if (uselessPmuInfo.length > 0) {
      console.warn('useless pmu info', uselessPmuInfo);
    }
    let firstExpanded = false;
    // 组织数据结构
    [...processedTasks, ...counterEvents].forEach((event: any) => {
      const processKey = `${event.pid || 0}`;
      const threadKey =  event.isCounter ? event.name : `${event.pid || 0}-${event.tid || 0}`;
  
      if (!processes.has(processKey)) {
        const processInfo = processThreadMap.get(processKey);
        let expanded = false;
        if (!firstExpanded) {
          expanded = true;
          firstExpanded = true;
        }
        processes.set(processKey, {
          pid: processInfo.pid,
          processName: processInfo.processName,
          type: processInfo.type,
          threads: new Map(),
          expanded: expanded,
        });
        processExpanded.set(processKey, expanded);
      }
  
      const process = processes.get(processKey);
      if (!process.threads.has(threadKey)) {
        const threadInfo = processThreadMap.get(processKey).threads.get(threadKey);
        const info = {
          tid: threadInfo.tid,
          threadName: threadInfo.threadName,
          events: [],
          isCounter: false,
          isFakeCore: threadInfo.threadName.includes(FAKE_CORE_KEYWORD),
          maxCount: 0,
          argKey: 'size',
        };
        if (event.isCounter) {
          info.isCounter = true;
          info.maxCount = 0;
          info.argKey = Object.keys(event.args)[0];
        }
        process.threads.set(threadKey, info);
      }
  
      const thread = process.threads.get(threadKey);
      event.isFakeCore = thread.isFakeCore;
      thread.events.push(event);
      if (thread.isCounter) {
        thread.maxCount = Math.max(thread.maxCount, event.args[thread.argKey]);
      }
    });

    const data = {};

    for (const proc of processes.values()) {
      for (const thread of proc.threads.values() as any[]) {
        for (const event of thread.events) {
          event.startTime = event.startTime;
          event.endTime = event.endTime;
          event.duration = event.duration;
          event.renderDuration = event.renderDuration;
          event.renderStartTime = event.renderStartTime;
          event.renderEndTime = event.renderEndTime;
          event.ts = event.ts;
        }
      }
    }

    data['counterEvents'] = counterEvents;
    data['processes'] = processes;
    data['processExpanded'] = processExpanded;
    data['lane2line'] = lane2line;
    data['timeInfo'] = { maxTime: maxTime, minTime: minTime};
    if (isAicpuData) {
      data['isAicpu'] = true;
    }
    
    if (isMixedAicpuKernel) {
        data['isMixedAicpuKernel'] = true;
    }

    return data;
  };



  export async function saveParsedInfoToDB(useCache:boolean, swimPath: string, lastChangeTime: string, dynTopoLastChangeTime: string, pmuLastChangeTime: string ,info: any) {
    const sanitizedTime = lastChangeTime.replace(/[:<>"|?*]/g, '-');
    const sanitizedPath = swimPath.replace(/[\/\\:<>"|?*\s]/g, '-');
    const fileName = `${sanitizedPath}-${sanitizedTime}.json`;
    const dbSwimStore = join(hismartliteEx.context!.globalStorageUri.fsPath, 'swimlane-db-info', fileName);
    if (!info.pmu_total) {
      info.pmu_total = {};
    }
    if (useCache) {
      await writeLargeObjectToFileThreadGranular(info, dbSwimStore);
      await getSwimGraphParsedInfoStore().set({filePath: swimPath, lastChangeTime: lastChangeTime, dynTopoLastChangeTime: dynTopoLastChangeTime, pmuLastChangeTime: pmuLastChangeTime, infoPath: dbSwimStore});
      console.log(`${dbSwimStore} save done`);
    }
  }





  
  export async function readSwimlaneFileStream(swimPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`开始流式读取 ${swimPath} 文件`);
        
        const stream = createReadStream(swimPath, { encoding: 'utf8' });
        const parser = JSONStream.parse('*'); 
        
        let jsonData: any = null;
        
        parser.on('data', (data) => {
          jsonData = data;
        });
        
        parser.on('end', () => {
          console.log('文件流式读取完成');
          resolve(jsonData);
        });
        
        parser.on('error', (error) => {
          console.error('JSON 解析错误:', error);
          reject(error);
        });
        
        stream.on('error', (error) => {
          console.error('文件读取错误:', error);
          reject(error);
        });
        
        stream.pipe(parser);
        
      } catch (err) {
        console.error(`${swimPath} 读取文件时发生错误:`, err);
        reject(err);
      }
    });
  }

  async function writeLargeObjectToFileThreadGranular(obj: any, filePath: string): Promise<void> {
    const directory = dirname(filePath);
    if(!existsSync(directory)) {
      mkdirSync(directory, { recursive: true});
    }
    
    const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
    
    try {
      writeStream.write('{\n');
      writeStream.write(`"counterEvents": ${JSON.stringify(obj.counterEvents)},\n`);

      
      // 按process和thread粒度写入
      writeStream.write('"processes": {\n');
      
      const processEntries = Object.entries(obj.processes);
      for (let i = 0; i < processEntries.length; i++) {
        const [pid, process] : [any, any] = processEntries[i];
        const isLastProcess = i === processEntries.length - 1;
        
        writeStream.write(`"${pid}": {\n`);
        writeStream.write(`"pid": ${process.pid},\n`);
        writeStream.write(`"processName": ${JSON.stringify(process.processName)},\n`);
        if (process.type) {
          writeStream.write(`"type": ${JSON.stringify(process.type)},\n`);
        }
        
        // 按thread粒度写入
        writeStream.write('"threads": {\n');
        const threadEntries = Object.entries(process.threads);
        
        for (let j = 0; j < threadEntries.length; j++) {
          const [threadId, thread] = threadEntries[j];
          const isLastThread = j === threadEntries.length - 1;
          
          writeStream.write(`"${threadId}": ${JSON.stringify(thread)}`);
          if (!isLastThread) {
            writeStream.write(',\n');
          }
        }
        
        writeStream.write('\n}\n}');
        if (!isLastProcess) {
          writeStream.write(',\n');
        }
      }
      
      writeStream.write('\n},\n');
      
      writeStream.write(`"processExpanded": ${JSON.stringify(obj.processExpanded)},\n`);
      writeStream.write(`"lane2line": ${JSON.stringify(obj.lane2line)},\n`);
      writeStream.write(`"pmu_total": ${JSON.stringify(obj.pmu_total)},\n`);
      writeStream.write(`"timeInfo": ${JSON.stringify(obj.timeInfo)}`);
      if (obj.colorRendering) {
        writeStream.write(`,\n"colorRendering": ${JSON.stringify(obj.colorRendering)}`);
      }
      if (obj.isAicpu) {
        writeStream.write(`,\n"isAicpu": ${JSON.stringify(obj.isAicpu)}`);
      }
      if (obj.isMixedAicpuKernel) {
        writeStream.write(`,\n"isMixedAicpuKernel": ${JSON.stringify(obj.isMixedAicpuKernel)}`);
      }
      writeStream.write('\n}');
      
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        writeStream.end();
      });
      
    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

export async function getSavedSwimDataFileStreamAll(swimPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
      console.log(`开始流式解析整个对象 ${swimPath}`);

      const pipeline = chain([
          createReadStream(swimPath, { encoding: 'utf8' }),
          parser(), 
          streamObject() 
      ]);
      
      let result: any = {};
      
      pipeline.on('data', (data) => {
          result[data.key] = data.value;
      });
      
      pipeline.on('end', () => {
          console.log(`文件${swimPath} 解析完成`);
          resolve(result);
      });
      
      pipeline.on('error', (error) => {
          reject(new Error(`JSON解析失败: ${error.message}`));
      });
  });
}



