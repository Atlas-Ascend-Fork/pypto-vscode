import { generateColorList, getColorByString } from './color-list';
import BigNumber from 'bignumber.js'

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
    } else if (event.args && event.args['ascend-hint']) {
      const subGraphArr = event.args['ascend-hint'].split(',');
      const subGraphItem = subGraphArr.find(item => item.includes('subGraphId'));
      subGraphId = subGraphItem ? subGraphItem.split(':')[1] : null;
    }
    if (subGraphId === null) {
      subGraphId = nameParts[nameParts.length - 1];
    }
  } else if (mode === "stichedFunc") {
    subGraphId = nameParts[0];
  }

  return Number(subGraphId) || 15;
};


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
function calculateLine(event, lable2lines) {
  const isFakeCore = event.threadName.includes(FAKE_CORE_KEYWORD);
  const label = `${event.pid}@${event.tid}`;
  let lines = lable2lines[label];
  if (!lines) {
    lable2lines[label] = [];
    lines = lable2lines[label];
  }
  let placed = false;

  for (let i = 0; i < lines.length; i++) {
    if (event.startTime >= lines[i]) {
      event.line = isFakeCore ? 0 : i;
      lines[i] = Math.max(lines[i], event.endTime);
      placed = true;
      break;
    }
  }
  if (!placed) {
    event.line = isFakeCore ? 0 : lines.length;
    lines.push(event.endTime);
  }
  return lines.length;
};

function calculateDuration (eventTasks, processedTasks) {
  let taskIndex = 0;
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
        duration: tStart.dur,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      processedTasks.push(event);
      taskIndex += 1;
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
      processedTasks.push(processedEvent);
      taskIndex += 2;
    } else {
      taskIndex += 1;
    }
  }
};

export function parsePmuInfo(csvData: string) {
  const pmuInfo = {};
  const lines = csvData.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const TaskInfo = {};
    const curLine = lines[i].split(',');

    for (let j = 0; j < headers.length; j++) {
      TaskInfo[headers[j]] = curLine[j] ? curLine[j].trim() : ''; 
    }
    pmuInfo[String(TaskInfo['seqNo']) + '-' + String(TaskInfo['sub task id'])] = TaskInfo; 
  }
  return pmuInfo;
}

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
        parent.dependencies.successors.push(child.id);
        child.dependencies.predecessors.push(parent.id);
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

  function processTaskPmuCalc(event: any, pmuTotal: any, pmuInfo: any) {
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
    
    pmuTotal['total cycle'] += BigInt(taskPmuInfo['total cycle']);
    pmuTotal.cube_busy_cycles += BigInt(taskPmuInfo.cube_busy_cycles);
    pmuTotal.vec_busy_cycles += BigInt(taskPmuInfo.vec_busy_cycles);
    pmuTotal.scalar_busy_cycles += BigInt(taskPmuInfo.scalar_busy_cycles);
    pmuTotal.mte1_busy_cycles += BigInt(taskPmuInfo.mte1_busy_cycles);
    pmuTotal.mte2_busy_cycles += BigInt(taskPmuInfo.mte2_busy_cycles);
    pmuTotal.mte3_busy_cycles += BigInt(taskPmuInfo.mte3_busy_cycles);
    pmuTotal.icache_miss += BigInt(taskPmuInfo.icache_miss);
    pmuTotal.icache_req += BigInt(taskPmuInfo.icache_req);
  }

  function processTotalPmuCalc(pmuTotal :any) {
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
  
  export async function parseSwimLaneInfo(traceData: any, pmuInfo: any, task2topo: any) {
    let counterEvents: any[] = [];
    let processedEvents: any[] = [];
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
    const mode = 'subGraph'
  
    for (let index = 0; index < traceData.traceEvents.length; index++) {
      const event = traceData.traceEvents[index];
      if (event.name === 'process_name') {
        processNames.set(event.pid, event.args.name);
      } else if (event.name === 'thread_name') {
        threadNames.set(`${event.pid}-${event.tid}`, event.args.name);
      } else if (event.cat === 'event' || event.ph === 'C') {
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
      } else if (event.cat === 'machine-view-last-dep') {
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
  
    let processedTasks: any[] = [];
    calculateDuration(eventTasks, processedTasks);
  
    processedTasks = processedTasks.sort((a, b) => a.startTime - b.startTime);
    const lable2lines = {};
    let pmuTotal: any = {};
    if (Object.keys(pmuInfo).length > 0) {
      pmuTotal = {
        'total cycle': 0n,
        vec_busy_cycles: 0n,
        cube_busy_cycles: 0n,
        scalar_busy_cycles: 0n,
        mte1_busy_cycles: 0n,
        mte2_busy_cycles: 0n,
        mte3_busy_cycles: 0n,
        icache_miss: 0n,
        icache_req: 0n
      };
    }
    for (const event of processedTasks) {
      //处理带dur的event
      const isFakeCore = event.threadName.includes(FAKE_CORE_KEYWORD);
      const lineCount = isFakeCore ? 1 : calculateLine(event, lable2lines);
      lane2line.set(`${event.pid}@${event.tid}`, lineCount);
      
      //pmu info process
      if (Object.keys(pmuInfo).length > 0) {
        processTaskPmuCalc(event, pmuTotal, pmuInfo);
      }
    }
  
    if (Object.keys(pmuInfo).length > 0) {
      processTotalPmuCalc(pmuTotal);
    }
  
    // 计算依赖关系
    calculateDependencies(processedTasks, connections);
  
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
  
    processedEvents = processedTasks;
    const data = {};
    data['counterEvents'] = counterEvents;
    data['processedEvents'] = processedEvents;
    data['processes'] = processes;
    data['processExpanded'] = processExpanded;
    data['lane2line'] = lane2line;
    data['pmu_total'] = pmuTotal;
    return data;
  };
