import { generateColorList, getColorByString } from './color-list';
import BigNumber from 'bignumber.js'
import { getMTime, SQLiteCache } from './core/sqliteCache';
import { dirname, join, extname, resolve } from 'path';
import * as vscode from 'vscode';
import { createReadStream, existsSync, readFileSync, readdirSync, writeFileSync} from 'fs';
import { hismartliteEx } from './hismarliteEx';

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
  
  export async function parseSwimLaneInfo(traceData: any, pmuInfo: any, task2topo: any, mode: string) {
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
    for (const event of processedTasks) {
      //处理带dur的event
      const isFakeCore = event.threadName.includes(FAKE_CORE_KEYWORD);
      const lineCount = isFakeCore ? 1 : calculateLine(event, lable2lines);
      lane2line.set(`${event.pid}@${event.tid}`, lineCount);
      
      //pmu info process
      if (Object.keys(pmuInfo).length > 0) {
        processTaskPmuCalc(event, pmuInfo);
      }
    }
  
    // 计算依赖关系
    const hasTopo = Object.keys(task2topo).length > 0;
    const status = hasTopo ? calculateDependenciesBytopo(processedTasks, task2topo) : false;
    if (!status) {
      calculateDependencies(processedTasks, connections);
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
  
    processedEvents = processedTasks;
    const data = {};
    data['counterEvents'] = counterEvents;
    data['processedEvents'] = processedEvents;
    data['processes'] = processes;
    data['processExpanded'] = processExpanded;
    data['lane2line'] = lane2line;
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

  export async function saveParsedInfoToDB(swimPath: string, lastChangeTime: string, dynTopoLastChangeTime: string, pmuLastChangeTime: string ,info: string) {
    const sanitizedTime = lastChangeTime.replace(/[:<>"|?*]/g, '-');
    const sanitizedPath = swimPath.replace(/[\/\\:<>"|?*\s]/g, '-');
    const fileName = `${sanitizedPath}-${sanitizedTime}.json`;
    const dbSwimStore = join(hismartliteEx.context!.globalStorageUri.fsPath, 'swimlane-db-info', fileName);
    const fileUri = vscode.Uri.file(dbSwimStore);
    const data = new TextEncoder().encode(info);
    await vscode.workspace.fs.writeFile(fileUri, data);
    await SQLiteCache.getInstance().swimGraphParsedInfoSet(swimPath, lastChangeTime, dynTopoLastChangeTime, pmuLastChangeTime, dbSwimStore);
    await SQLiteCache.getInstance().save();
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
