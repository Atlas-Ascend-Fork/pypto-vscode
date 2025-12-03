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
  const curTensorMap = new Map(currentData.tensors?.map((t) => [t.magic, t]) ?? []);
  const curOpMap = new Map(currentData.operations?.map((op) => [op.opmagic, op]) ?? []);
  const beforeTensorMap = new Map(beforeData.tensors?.map((t) => [t.magic, t]) ?? []);
  const beforeOpMap = new Map(beforeData.operations?.map((op) => [op.opmagic, op]) ?? []);
  for (const ct of curTensorMap.values()) {
    const bt = beforeTensorMap.get(ct.magic);
    if (!bt) {
      ct.compareType = 'add';
      diffList.push({ changeType: 'add', nodeType: 'tensor', magic: ct.magic, nodeId: CurrentTensorMagicMap[ct.magic] });
    } else if (JSON.stringify(ct.offset) !== JSON.stringify(bt.offset) || JSON.stringify(ct.shape) !== JSON.stringify(bt.shape)) {
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
      bt.compareType = 'delete';
      diffList.push({ changeType: 'delete', nodeType: 'tensor', magic: bt.magic, nodeId: BeforeTensorMagicMap[bt.magic] });
    }
  }

  for (const cop of curOpMap.values()) {
    const bop = beforeOpMap.get(cop.opmagic);
    if (!bop) {
      cop.compareType = 'add';
      addDiffElements('add', 'op', cop.opmagic, CurrentOpMagicMap[cop.opmagic], diffList, cop.opcode);
    } else if (cop.opcode != bop.opcode ||
              JSON.stringify(cop.ioperands) !== JSON.stringify(bop.ioperands) ||
              JSON.stringify(cop.ooperands) !== JSON.stringify(bop.ooperands)) {
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
      bop.compareType = 'delete';
      addDiffElements('delete', 'op', bop.opmagic, BeforeOpMagicMap[bop.opmagic], diffList, bop.opcode);
    }
  }
  let changeRate = diffList.length / (curOpMap.size + curTensorMap.size);
  if (changeRate > 0.5 && diffList.length >= 400) {
    beforeData.tensors = originBefore.tensors;
    beforeData.operations = originBefore.operations;
    currentData.tensors = originCurrent.tensors;
    currentData.operations = originCurrent.operations;
    diffList = [];
    (window as any).ascEventBus.emit('message_notice', 'compareLargerTips');
    return { diffList, showDiffList: false };
  }
  if (diffList.length === 0) {
    (window as any).ascEventBus.emit('message_notice', 'noCompareTips');
  }
  return { diffList, showDiffList: true };
}

// 判断是否是node节点
export function isNode(element): boolean {
  return element.type.includes('node');
}
