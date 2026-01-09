import { generateColorList, getColorByString } from './color-list';
import BigNumber from 'bignumber.js'
import { getMTime, SQLiteCache } from './core/sqliteCache';
import { dirname, join, extname, resolve } from 'path';
import * as vscode from 'vscode';
import { createReadStream,  createWriteStream } from 'fs';
import { hismartliteEx } from './hismarliteEx';
import JSONStream from 'JSONStream';
import { parser } from 'stream-json';
import { chain } from 'stream-chain';
import {pick} from 'stream-json/filters/Pick';
import {streamObject} from 'stream-json/streamers/StreamObject';
import { t } from 'i18next';

// 异步初始化颜色列表
let darkThemeColors: any = null;
let lithtThemeColors: any = null;
let darkThemeBaseColors: string[] = [];
let darkThemeLightColors: string[] = [];
let lightThemeBaseColors: string[] = [];
let lightThemeLightColors: string[] = [];

// 初始化颜色列表的函数
async function initializeColors() {
  if (!darkThemeColors) {
    darkThemeColors = generateColorList(360);
    lithtThemeColors = generateColorList(360, false);
    darkThemeBaseColors = darkThemeColors.baseColorList;
    darkThemeLightColors = darkThemeColors.lightColorList;
    lightThemeBaseColors = lithtThemeColors.baseColorList;
    lightThemeLightColors = lithtThemeColors.lightColorList;
  }
}

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


const getSubGraphId = (event, mode) => {
  let subGraphId;
  const nameParts = event.name.split('(')[0].split('-').map(part => part.trim());

  if (mode === "subGraph") {
    if (event.leafIndex) {
      subGraphId = event.leafIndex;
    } else if (event.args && event.args['event-hint']) {
      const subGraphArr = event.args['event-hint'].split(',');
      const subGraphItem = subGraphArr.find(item => item.includes('subGraphId'));
      subGraphId = subGraphItem ? subGraphItem.split(':')[1] : null;
    }
    if (subGraphId === null || subGraphId === undefined) {
      subGraphId = nameParts[nameParts.length - 1];
    }
  } else if (mode === "stichedFunc") {
    subGraphId = nameParts[0];
  }

  return Number(subGraphId) || 15;
};

export function getSemanticColor(event: any, baseColorslist:any, lightColorslist:any): { dark: { base: string; light: string } } {
  let dBaseColor: string, dLightColor: string;
  const label = event?.color || '';
  const dres = getColorByString(label, baseColorslist, lightColorslist);
  dBaseColor = dres.baseColor ?? '#666666';
  dLightColor = dres.lightColor ?? '#666666';
  return { dark: { base: dBaseColor, light: dLightColor }};
}

async function getEventColor(event: any, mode: string): Promise<{ dark: { base: string, light: string }, light: { base: string, light: string } }> {
  // 确保颜色已初始化
  await initializeColors();
  let dBaseColor: string, dLightColor: string, lBaseColor: string, lLightColor: string;
  if (mode !== "label") {
    const subGraphId = getSubGraphId(event, mode);
    dBaseColor = darkThemeBaseColors[subGraphId];
    dLightColor = darkThemeLightColors[subGraphId];
    lBaseColor = lightThemeBaseColors[subGraphId];
    lLightColor = lightThemeLightColors[subGraphId];
 
   if (subGraphId > 360 && !dBaseColor) {
     dBaseColor = darkThemeBaseColors[subGraphId % 360];
     dLightColor = darkThemeLightColors[subGraphId % 360];
     lBaseColor = lightThemeBaseColors[subGraphId % 360];
     lLightColor = lightThemeLightColors[subGraphId % 360];
   }
  } else {
    const label = event.args?.color || '';
    const dres = getColorByString(label, darkThemeBaseColors, darkThemeLightColors);
    const lres = getColorByString(label, lightThemeBaseColors, lightThemeLightColors);
    dBaseColor = dres.baseColor;
    dLightColor = dres.lightColor;
    lBaseColor = lres.baseColor;
    lLightColor = lres.lightColor;
  }
  dBaseColor = dBaseColor ?? '#666666';
  dLightColor = dLightColor ?? '#666666';
  lBaseColor = lBaseColor ?? '#666666';
  lLightColor = lLightColor ?? '#666666';
  return { dark: { base: dBaseColor, light: dLightColor }, light: { base: lBaseColor, light: lLightColor } };
};

const FAKE_CORE_KEYWORD = 'Fake Core';

function layoutFakeCoreEvent(event, lines, allEventsMap, globalMaxTime) {
  const originalDuration = event.endTime - event.startTime;

  // --- Step 1: 计算合法窗口 [minStart, maxEnd] ---
  let minStart = event.startTime;
  let maxEnd = event.endTime;

  // 前驱约束
  if (event.dependencies?.predecessors?.length) {
    const latestPredEnd = Math.max(
      ...event.dependencies.predecessors.map(id => {
        const pred = allEventsMap.get(id);
        return pred ? pred.endTime : -Infinity;
      }).filter(v => v !== -Infinity)
    );
    if (latestPredEnd !== -Infinity) {
      minStart = Math.min(minStart, latestPredEnd);
    }
  }

  // 后继约束
  if (event.dependencies?.successors?.length) {
    const earliestSuccStart = Math.min(
      ...event.dependencies.successors.map(id => {
        const succ = allEventsMap.get(id);
        return succ ? succ.startTime : Infinity;
      }).filter(v => v !== Infinity)
    );
    if (earliestSuccStart !== Infinity) {
      maxEnd = Math.max(maxEnd, earliestSuccStart);
    }
  }

  // --- Step 2: 尝试放入已有行 ---
  for (let i = 0; i < lines.length; i++) {
    const rowLastEnd = lines[i];
    const renderStart = Math.max(minStart, rowLastEnd); // 不重叠 + 满足前驱

    if (renderStart >= maxEnd) {
      continue; // 该行没空间了
    }

    // 策略：尽可能保持原始 duration，但不超过可用空间
    const renderEnd = Math.min(renderStart + originalDuration, maxEnd);

    // 即使 available 很小（如 0.0001ms），也允许放置！
    // UI 层负责确保 canvas 上至少画 1~2px
    event.renderStartTime = renderStart;
    event.renderDuration = (renderEnd - renderStart) / 10;
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
  event.renderDuration = (renderEnd - renderStart) / 10;
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
        event.renderStartTime = globalMaxTime - 0.00001;
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
  let maxTime = 0;

  while (taskIndex <= eventTasks.length - 1) {
    const tStart = eventTasks[taskIndex];
    if (tStart.ph.toUpperCase() === 'X') {
      const event = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: tStart.ts,
        endTime: tStart.ts + tStart.dur,
        renderStartTime: tStart.ts,
        renderEndTime: tStart.ts + tStart.dur,
        renderDuration: tStart.dur,
        duration: tStart.dur,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      processedTasks.push(event);
      taskIndex += 1;
      maxTime = Math.max(maxTime, event.endTime);
      continue;
    }
    const tEnd = eventTasks[taskIndex + 1];

    if (tEnd && tStart.id === tEnd.id && tStart.ph.toUpperCase() === 'B' && tEnd.ph.toUpperCase() === 'E') {
      const processedEvent = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: tStart.ts,
        endTime: tEnd.ts,
        duration: tEnd.ts - tStart.ts,
        renderStartTime: tStart.ts,
        renderEndTime: tEnd.ts,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      maxTime = Math.max(maxTime, processedEvent.endTime);
      processedTasks.push(processedEvent);
      taskIndex += 2;
    } else {
      taskIndex += 1;
    }
  }
  return [maxTime, 0];
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

  function processTaskPmuCalc(event: any, pmuInfo: any) {
    const taskPmuKey = String(event['args']['seqNo']) + '-' + String(event['args']['taskId']);
    const taskPmuInfo = pmuInfo[taskPmuKey];
    if(event.threadName.includes(FAKE_CORE_KEYWORD) == true) {
      return;
    }
    if (taskPmuInfo === undefined) {
      console.error("PMU: taskID not found:", taskPmuKey);
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
  }

  export function processTotalPmuCalc(pmuTotal :any) {
    pmuTotal['vec_ratio'] = ((new BigNumber(pmuTotal.vec_busy_cycles)).dividedBy(new BigNumber(pmuTotal['total cycle']))).toString();
    pmuTotal['cube_ratio'] = ((new BigNumber(pmuTotal.cube_busy_cycles)).dividedBy(new BigNumber(pmuTotal['total cycle']))).toString();
    pmuTotal['scalar_ratio'] = ((new BigNumber(pmuTotal.scalar_busy_cycles)).dividedBy(new BigNumber(pmuTotal['total cycle']))).toString();
    pmuTotal['mte1_ratio'] = ((new BigNumber(pmuTotal.mte1_busy_cycles)).dividedBy(new BigNumber(pmuTotal['total cycle']))).toString();
    pmuTotal['mte2_ratio'] = ((new BigNumber(pmuTotal.mte2_busy_cycles)).dividedBy(new BigNumber(pmuTotal['total cycle']))).toString();
    pmuTotal['mte3_ratio'] = ((new BigNumber(pmuTotal.mte3_busy_cycles)).dividedBy(new BigNumber(pmuTotal['total cycle']))).toString();
    pmuTotal['icache_hit'] = new BigNumber(1)
      .minus(
        (new BigNumber(pmuTotal.icache_miss))
          .dividedBy(new BigNumber(pmuTotal.icache_req))
        ).toString();

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
  
  export async function parseSwimLaneInfo(traceData: any, pmuInfo: any, task2topo: any, mode: string) {
    let counterEvents: any[] = [];
    let processes = new Map();
    let processExpanded = new Map();
    let lane2line = new Map();
    if (!traceData || !traceData.traceEvents) {
      return;
    }
    

    const processNames = new Map();
    const threadNames = new Map();
    const eventTasks: any[] = [];
    const connections: any[] = [];
  
    let errorMsg: any = {};

    let minThresh = Infinity;
    for (let index = 0; index < traceData.traceEvents.length; index++) {
      if (traceData.traceEvents[index].ts < minThresh) {
        minThresh = traceData.traceEvents[index].ts;
      }
    }


    for (let index = 0; index < traceData.traceEvents.length; index++) {
      const event = traceData.traceEvents[index];
      event.ts -= minThresh; 

      errorMsg = await validate(event);
      if ('errMsg' in errorMsg) {
        return errorMsg;
      }

      if (event.name === 'process_name') {
        processNames.set(event.pid, event.args.name);
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
          const color = await getEventColor(event, mode);
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
  
    // 计算依赖关系
    const hasTopo = Object.keys(task2topo).length > 0;
    const status = hasTopo ? calculateDependenciesBytopo(processedTasks, task2topo) : false;
    if (!status) {
      calculateDependencies(processedTasks, connections);
    }

    const allEventsMap = new Map(processedTasks.map(e => [e.id, e]));
    const globalMaxTime = processedTasks.reduce((max, e) => 
      e.endTime > max ? e.endTime : max, 
      -Infinity
    );
    const calculateLine = createCalculateLine(allEventsMap, globalMaxTime);
    const lable2lines = {};
    for (const event of processedTasks) {
      //处理带dur的event
      const lineCount = calculateLine(event, lable2lines);
      lane2line.set(`${event.pid}@${event.tid}`, lineCount);
      
      //pmu info process
      if (Object.keys(pmuInfo).length > 0) {
        processTaskPmuCalc(event, pmuInfo);
      }
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
    data['counterEvents'] = counterEvents;
    data['processes'] = processes;
    data['processExpanded'] = processExpanded;
    data['lane2line'] = lane2line;
    data['timeInfo'] = { maxTime, minTime};
    return data;
  };

  export async function refreshSwimGraphDB(swimPath: string, swimData: any, swimLastChangeTime: string, colorRendering: string) {
    await SQLiteCache.getInstance().swimGraphProcessDel(swimPath);
    await SQLiteCache.getInstance().swimGraphThreadDel(swimPath);
    await SQLiteCache.getInstance().swimGraphEventDel(swimPath);
    await SQLiteCache.getInstance().swimGraphLane2lineDel(swimPath);
    saveLane2LineToDB(swimPath, swimData.lane2line, swimLastChangeTime);
    saveProcessesToDB(swimPath, swimData.processes, swimLastChangeTime, colorRendering);
  }

  export async function saveProcessesToDB(swimPath: string, processes: Object, lastChangeTime: string, colorRendering: string) {
    for (const processKey in processes) {
      const process = processes[processKey];
      await SQLiteCache.getInstance().swimGraphProcessSet(swimPath, lastChangeTime, process.pid, process.processName, colorRendering);
      console.log('insert to db Process', processKey);
      let threadId = 1;
      for (const threadKey in process.threads) {
        const thread = process.threads[threadKey];
        thread.pid = process.pid;
        await SQLiteCache.getInstance().swimGraphThreadSet(swimPath, thread.tid, lastChangeTime, thread.threadName, JSON.stringify(thread.argKey), 
          thread.isCounter, thread.isFakeCore, thread.maxCount, thread.pid, threadId);
        for (const eventKey in thread.events) {
          const event = thread.events[eventKey];
          if (!event.id) {
            event.id = 'C_' + event.name + '_' + eventKey; 
          }
          const seqNo = event.args?.seqNo;
          const taskId = event.args?.taskId;
          const uid = String(event.args?.seqNo) && String(event.args?.taskId) 
            ? `${event.args.seqNo}-${event.args.taskId}`: '';
          let eventType = 'Task';
            if (event.isCounter) {
            eventType = 'Counter';
          }
          
          await SQLiteCache.getInstance().swimGraphEventSet(
            swimPath, 
            lastChangeTime, 
            event.id,
            threadId,
            eventType,
            JSON.stringify(event.args ?? {}), 
            JSON.stringify(event.dependencies?.predecessors ?? []), 
            JSON.stringify(event.dependencies?.successors ?? []), 
            event.duration ?? 0, 
            event.endTime ?? 0, 
            event.pid ?? 0, 
            event.tid ?? 0, 
            event.line ?? 0, 
            event.isCounter ? 1 : 0, 
            event.isFakeCore ? 1 : 0, 
            event.name ?? '', 
            uid,
            event.renderEndTime ?? 0, 
            event.renderStartTime ?? 0, 
            event.renderDuration ?? 0,
            event.startTime ?? 0, 
            event.threadName ?? '', 
            event.ts ?? 0, 
            event.leafIndex ?? '',
            seqNo ?? 0,
            taskId ?? 0,
            JSON.stringify(event.color ?? {})
          );
        }
        threadId++;
      }
    }
    console.log('insert process done');
  }

  export async function saveLane2LineToDB(swimPath: string, lane2line: Object, lastChangeTime: string) {
    for (const key in lane2line) {
      await SQLiteCache.getInstance().swimGraphLane2lineSet(swimPath, lastChangeTime, key, lane2line[key]);
    }
  }

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
      await SQLiteCache.getInstance().swimGraphParsedInfoSet(swimPath, lastChangeTime, dynTopoLastChangeTime, pmuLastChangeTime, dbSwimStore);
      await SQLiteCache.getInstance().save();
      console.log(`${dbSwimStore} save done`);
    }
  }


  export async function savePmuToDB(pmuPath: string, pmuInfo: Object, lastChangeTime: string) {
    for (const uid in pmuInfo) {
      const taskInfo = pmuInfo[uid];
      await SQLiteCache.getInstance().swimGraphPmuSet(pmuPath, lastChangeTime, uid, taskInfo['sub task id'], 
        taskInfo.seqNo, taskInfo['thread id'], taskInfo['task id'], taskInfo['core id'], taskInfo['total cycle'],
        taskInfo.vec_busy_cycles, taskInfo.cube_busy_cycles, taskInfo.scalar_busy_cycles, taskInfo.mte1_busy_cycles, 
        taskInfo.mte2_busy_cycles, taskInfo.mte3_busy_cycles, taskInfo.icache_miss, taskInfo.icache_req, 
        taskInfo.cube_ratio, taskInfo.vec_ratio, taskInfo.scalar_ratio, taskInfo.mte1_ratio, taskInfo.mte2_ratio, 
        taskInfo.mte3_ratio, taskInfo.icache_hit);
    }
  }

  export async function convertSwimInfo(swimPath: string, dbProcessInfo: any, pmuInfo: any, newColorRendering: string) {
    const processes = {};
    const processedEvents: any = [];
    const processExpanded: any = {};
    
    for(const [index, processRow] of dbProcessInfo.entries()) {
      processes[processRow.pid] = {};
      processes[processRow.pid].expanded = false;
      processes[processRow.pid].pid = processRow.pid;
      processes[processRow.pid].processName = processRow.process_name;
      processes[processRow.pid].threads = {};
      if (index == 0) {
        processExpanded[processRow.pid] = true;
      } else {
        processExpanded[processRow.pid] = false;
      }
      
      const dbThreadInfo = await SQLiteCache.getInstance().swimGraphThreadGetByFilePathPid(swimPath, processRow.pid);
      
      const threadPromises = dbThreadInfo.map(async (threadRow) => {
        let threadKey = '';
        if (!threadRow.is_counter) {
          threadKey = processRow.pid + '-' + threadRow.tid;
        } else {
          threadKey = threadRow.thread_name;
        }
        
        const threadData: any = {
          argKey: JSON.parse(threadRow.arg_key),
          isCounter: Boolean(threadRow.is_counter),
          isFakeCore: Boolean(threadRow.is_fake_core),
          maxCount: threadRow.max_count,
          tid: threadRow.tid,
          threadName: threadRow.thread_name,
          threadId: threadRow.thread_id,
          events: []
        };
        
        let dbEventInfo: any[];
        if (threadRow.is_counter) {
          dbEventInfo = await SQLiteCache.getInstance().swimGraphEventGetByFilePathPidTidOrderByTsAsc(swimPath, processRow.pid, threadRow.thread_id);
        } else {
          dbEventInfo = await SQLiteCache.getInstance().swimGraphEventGetByFilePathPidTid(swimPath, processRow.pid, threadRow.thread_id);
        }
        
        const eventPromises = dbEventInfo.map(async (eventRow) => {
          const event: any = {};
          event.args = JSON.parse(eventRow.args);
          event.isCounter = Boolean(eventRow.is_counter);
          event.isFakeCore = Boolean(eventRow.is_fake_core);
          event.name = eventRow.name;
          event.pid = eventRow.pid;
          event.tid = eventRow.tid;
          event.ts = eventRow.ts;
          event.id = eventRow.id;
          event.eventTpe = eventRow.event_type;
          if (!eventRow.is_counter) {
            const predecessors = JSON.parse(eventRow.predecessors);
            const successors = JSON.parse(eventRow.successors);
            event.dependencies = {};
            event.dependencies.predecessors = predecessors;
            event.dependencies.successors = successors;
            event.duration = eventRow.duration;
            event.endTime = eventRow.end_time;
            event.renderEndTime = eventRow.render_end_time;
            event.renderStartTime = eventRow.render_start_time;
            event.startTime = eventRow.start_time;
            event.threadName = eventRow.thread_name;
            event.threadId = eventRow.thread_id;
            event.pmu_info = pmuInfo[eventRow.uid];
            event.color = JSON.parse(eventRow.color);
            event.leafIndex = eventRow.leaf_index;
            if (processRow.colorRendering != newColorRendering) {
              event.color = await getEventColor(event, newColorRendering);
            }
            processedEvents.push(event);
          }
          return event;
        });
        
        threadData.events = await Promise.all(eventPromises);
        return { threadKey, threadData };
      });
      
      const threadResults = await Promise.all(threadPromises);
      
      threadResults.forEach(({ threadKey, threadData }) => {
        processes[processRow.pid].threads[threadKey] = threadData;
      });
    }
    
    return [processes, processedEvents, processExpanded];
}



  export async function convertPmuInfo(dbPmuInfo: any) {
    const pmuInfo: any = {};
    for (const pmuRow of dbPmuInfo) {
      const uid = pmuRow.uid;
      const pmu: any = {};
      pmu['core id'] = pmuRow.core_id;
      pmu.cube_busy_cycles = pmuRow.cube_busy_cycles;
      pmu.vec_busy_cycles = pmuRow.vec_busy_cycles;
      pmu['sub task id'] = pmuRow.sub_task_id;
      pmu.seqNo = pmuRow.seq_no;
      pmu['thread id'] = pmuRow.thread_id;
      pmu['task id'] = pmuRow.task_id;
      pmu['core id'] = pmuRow.core_id;
      pmu['total cycle'] = pmuRow.total_cycle;
      pmu.scalar_busy_cycles = pmuRow.scalar_busy_cycles;
      pmu.mte1_busy_cycles = pmuRow.mte1_busy_cycles;
      pmu.mte2_busy_cycles = pmuRow.mte2_busy_cycles;
      pmu.mte3_busy_cycles = pmuRow.mte3_busy_cycles;
      pmu.icache_miss = pmuRow.icache_miss;
      pmu.icache_req = pmuRow.icache_req;
      pmu.cube_ratio = pmuRow.cube_ratio;
      pmu.vec_ratio = pmuRow.vec_ratio;
      pmu.scalar_ratio = pmuRow.scalar_ratio;
      pmu.mte1_ratio = pmuRow.mte1_ratio;
      pmu.mte2_ratio = pmuRow.mte2_ratio;
      pmu.mte3_ratio = pmuRow.mte3_ratio;
      pmu.icache_hit = pmuRow.icache_hit;
      pmuInfo[uid] = pmu;
    }
    return pmuInfo;
  }

  

  export async function convertLane2LineInfo(dbLane2LineInfo: any) {
    const lane2line: any = {};
    for (const l2lRow of dbLane2LineInfo) {
      lane2line[l2lRow.name] = l2lRow.value;
    }
    return lane2line;
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
      writeStream.write(`"timeInfo": ${JSON.stringify(obj.timeInfo)}\n`);
      writeStream.write('}');
      
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


export async function getSavedSwimDataFileStreamByKey(swimPath: string, key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    console.log(`开始读取缓存文件 ${swimPath}, key ${key}`);
    
    const pipeline = chain([
      createReadStream(swimPath, { encoding: 'utf8' }),
      parser(),
      pick({filter:key}),
      streamObject() 
    ]);
    
    let result: any = {};
    
    pipeline.on('data', (data) => {
      console.log(data);
      result[data.key] = data.value;
    });
    
    pipeline.on('end', () => {
      console.log(`解析完成`);
      resolve(result);
    });
    
    pipeline.on('error', (error) => {
      reject(new Error(`JSON解析失败: ${error.message}`));
    });
  });
}
