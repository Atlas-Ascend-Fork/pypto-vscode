const OFFSET = 20;
const SCALE = 100;
const defaultWidthMapStr = `007LLmW'55;N0500LLLLLLLLLL00NNNLzWW\\\\WQb\\0FWLg\\bWb\\WQ\\WrWWQ000CL5LLFLL0LL**F*gLLLL5F0LF\\FFF5.5N`;

function getTextWidthMap(mapStr: string) {
  const map: Record<string, number> = {};
  if (typeof JSON === 'undefined') {
    return map;
  }
  for (let i = 0; i < mapStr.length; i++) {
    const char = String.fromCharCode(i + 32);
    const size = (mapStr.charCodeAt(i) - OFFSET) / SCALE;
    map[char] = size;
  }
  return map;
}

const DEFAULT_TEXT_WIDTH_MAP = getTextWidthMap(defaultWidthMapStr);

/* 返回指定字符串的宽度，默认按字体大小为12计算总宽度 */
export function getTextWidth(text: string, fontSize = 12) {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const preCalcWidth = DEFAULT_TEXT_WIDTH_MAP[text[i]];
    width += preCalcWidth == null ? fontSize : preCalcWidth * fontSize;
  }
  return width;
}

/* diff双图场景，返回当前操作的区域，after/before */
export function getCurrentArea(e: MouseEvent) {
  const composedPath = e.composedPath() as HTMLElement[];
  let moveArea = '';
  composedPath.forEach((item) => {
    if (item.id === 'sprotty-after') {
      moveArea = 'after';
    }
    if (item.id === 'sprotty-before') {
      moveArea = 'before';
    }
  });
  return moveArea;
}

const syncNode = new Set<String> (['SYNC_SRC', 'SYNC_DST', 'BAR.V', 'PHASE1', 'PHASE2']);

function addDiffElements(eleChangeType, eleNodeType, magic, eleNodeId, diffList: any, opCode = 'Default') {
  if (syncNode.has(opCode)) {
    return;
  }
  diffList.push({ changeType: eleChangeType, nodeType: eleNodeType, magic: magic, nodeId: eleNodeId });
}

function addDiffDetail(newOp, oldOp, diffDetail: any, opCode = 'Default') {
  if (syncNode.has(opCode)) {
    return;
  }
  diffDetail.push({ new: newOp ? { ...newOp } : newOp, old: oldOp ? { ...oldOp } : oldOp });
}

function setCompreTypeOverrate(arr: any[]): void {
  for (let i = 0, len = arr.length; i < len; i++) {
    const item = arr[i];
    const target = item.__v_raw || item.__raw || item;
    if ('compareType' in target) {
      target.compareType = 'overrate';
    }
  }
}

// diff双图数据对比
export function compareJsonData(beforeData: Object, currentData: Object) {
  const BeforeOpMagicMap: Record<number, string> = {};
  const BeforeTensorMagicMap: Record<number, string> = {};
  const CurrentOpMagicMap: Record<number, string> = {};
  const CurrentTensorMagicMap: Record<number, string> = {};
  const originBefore = {
    tensors:
      beforeData.tensors?.map((t: any) => {
        const subgraphId = t.subgraphid !== undefined ? t.subgraphid : -1;
        BeforeTensorMagicMap[t.magic] = `tensor-${t.magic}-${subgraphId}`;
        return { ...t };
      }) ?? [],
    operations:
      beforeData.operations?.map((op: any, i: number) => {
        const subgraphId = op.subgraphid !== undefined ? op.subgraphid : -1;
        BeforeOpMagicMap[op.opmagic] = `operation-magic-${op.opmagic}-${subgraphId}`;
        return { ...op };
      }) ?? [],
  };
  const originCurrent = {
    tensors:
      currentData.tensors?.map((t: any) => {
        const subgraphId = t.subgraphid !== undefined ? t.subgraphid : -1;
        CurrentTensorMagicMap[t.magic] = `tensor-${t.magic}-${subgraphId}`;
        return { ...t };
      }) ?? [],
    operations:
      currentData.operations?.map((op: any, i: number) => {
        const subgraphId = op.subgraphid !== undefined ? op.subgraphid : -1;
        CurrentOpMagicMap[op.opmagic] = `operation-magic-${op.opmagic}-${subgraphId}`;
        return { ...op };
      }) ?? [],
  };
  let diffList: Record<string, any>[] = [];
  const diffDetail: Record<string, any>[] = []
  const curTensorMap = new Map(currentData.tensors?.map((t) => [t.magic, t]) ?? []);
  const curOpMap = new Map(currentData.operations?.map((op) => [op.opmagic, op]) ?? []);
  const beforeTensorMap = new Map(beforeData.tensors?.map((t) => [t.magic, t]) ?? []);
  const beforeOpMap = new Map(beforeData.operations?.map((op) => [op.opmagic, op]) ?? []);
  for (const ct of curTensorMap.values()) {
    const bt = beforeTensorMap.get(ct.magic);
    if (!bt) {
      diffDetail.push({ new: { ...ct } });
      ct.compareType = 'add';
      diffList.push({ changeType: 'add', nodeType: 'tensor', magic: ct.magic, nodeId: CurrentTensorMagicMap[ct.magic] });
    } else if (JSON.stringify(ct.offset) !== JSON.stringify(bt.offset) || JSON.stringify(ct.shape) !== JSON.stringify(bt.shape)) {
      diffDetail.push({ new: { ...ct }, old: { ...bt } });
      ct.compareType = 'change';
      bt.compareType = 'change';
      diffList.push({ changeType: 'change', nodeType: 'tensor', magic: ct.magic, nodeId: CurrentTensorMagicMap[ct.magic] });
    } else {
      ct.compareType = 'normal';
      bt.compareType = 'normal';
    }
  }

  for (const bt of beforeTensorMap.values()) {
    const ct = curTensorMap.get(bt.magic);
    if (!ct) {
      diffDetail.push({ old: { ...bt } });
      bt.compareType = 'delete';
      diffList.push({ changeType: 'delete', nodeType: 'tensor', magic: bt.magic, nodeId: BeforeTensorMagicMap[bt.magic] });
    }
  }

  for (const cop of curOpMap.values()) {
    const bop = beforeOpMap.get(cop.opmagic);
    if (!bop) {
      addDiffDetail(cop, undefined, diffDetail, cop.opcode);
      cop.compareType = 'add';
      addDiffElements('add', 'op', cop.opmagic, CurrentOpMagicMap[cop.opmagic], diffList, cop.opcode);
    } else if (cop.opcode != bop.opcode ||
              JSON.stringify(cop.ioperands) !== JSON.stringify(bop.ioperands) ||
              JSON.stringify(cop.ooperands) !== JSON.stringify(bop.ooperands)) {
      addDiffDetail(cop, bop, diffDetail, cop.opcode);
      cop.compareType = 'change';
      bop.compareType = 'change';
      addDiffElements('change', 'op', cop.opmagic, CurrentOpMagicMap[cop.opmagic], diffList, cop.opcode);
    } else {
      cop.compareType = 'normal';
      bop.compareType = 'normal';
    }
  }

  for (const bop of beforeOpMap.values()) {
    const cop = curOpMap.get(bop.opmagic);
    if (!cop) {
      addDiffDetail(undefined, bop, diffDetail, bop.opcode);
      bop.compareType = 'delete';
      addDiffElements('delete', 'op', bop.opmagic, BeforeOpMagicMap[bop.opmagic], diffList, bop.opcode);
    }
  }
  let changeRate = diffList.length / (curOpMap.size + curTensorMap.size);
  if (changeRate > 0.5 && diffList.length >= 400) {
    beforeData.tensors = originBefore.tensors;
    setCompreTypeOverrate(beforeData.tensors);
    beforeData.operations = originBefore.operations;
    setCompreTypeOverrate(beforeData.operations);
    currentData.tensors = originCurrent.tensors;
    setCompreTypeOverrate(currentData.tensors);
    currentData.operations = originCurrent.operations;
    setCompreTypeOverrate(currentData.operations);
    diffList = [];
    (window as any).ascEventBus.emit('message_notice', 'compareLargerTips');
    return { diffList, showDiffList: false };
  }
  if (diffList.length === 0) {
    (window as any).ascEventBus.emit('message_notice', 'noCompareTips');
  }
  return { diffList, diffDetail, showDiffList: true };
}

// 判断是否是node节点
export function isNode(element): boolean {
  return element.type.includes('node');
}

export function layoutFakeCoreEvent(event, lines, allEventsMap, globalMaxTime) {
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
