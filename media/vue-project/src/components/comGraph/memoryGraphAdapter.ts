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
import type { ChipConfig, ChipEdge, ChipNode } from '../../config/chip-config.types';
import { resolveEdgeStyle, resolveNodeStyle } from '../../config/chip-style-resolver';

interface BufferState {
  memId: number | string;
  memType: string;
  addrStart: number;
  size: number;
  status: 0 | 1 | 2;
}

interface MemoryTypeData {
  size?: number;
  bufferList?: BufferState[];
}

type GraphData = Record<string, MemoryTypeData>;

interface AnimationState {
  activePaths: Set<string>;
  animationMap: Map<string, BufferState[]>;
  errorMemTypes: string[];
  changeBufferList: BufferState[];
  startTime: number;
  endTime: number;
  errorMsg: {
    freeSize: number;
    requestSize: number;
  };
}

export interface MemoryFlowElements {
  nodes: any[];
  edges: any[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const bytesToKB = (bytes: number): number => Math.ceil(bytes / 1024);

const sumActiveBytes = (bufferList: BufferState[]): number => bufferList.filter(buffer => buffer.status !== 0).reduce((sum, buffer) => sum + (buffer.size || 0), 0);

const getTierColor = (status: number): string => {
  const colorMap: Record<number, string> = {
    0: '#626263',
    1: '#2E619C',
    2: '#98C6F3',
  };
  return colorMap[status] || '#626263';
};

const getTiers = (bufferList: BufferState[], unitKB: number) => bufferList.map((buffer, index) => ({
  startLocation: (buffer.addrStart / 1024) / unitKB,
  size: (buffer.size / 1024) / unitKB,
  color: getTierColor(buffer.status),
  bufferMsg: {
    ...buffer,
  },
}));

const getRelatedMemTypes = (config: ChipConfig, memType: string): string[] => {
  const target = config.memoryTypeMap[memType];
  if (!target) {
    return [memType];
  }

  const related = Object.entries(config.memoryTypeMap)
    .filter(([, mappedTarget]) => mappedTarget === target)
    .map(([type]) => type);

  return related.includes(memType) ? related : [...related, memType];
};

const getRuntimeBuffers = (config: ChipConfig, graphData: GraphData, memType: string): BufferState[] => {
  const relatedMemTypes = getRelatedMemTypes(config, memType);
  return relatedMemTypes.flatMap(type => graphData[type]?.bufferList || []);
};

const getAnimationBuffers = (config: ChipConfig, animationMap: Map<string, BufferState[]>, graphData: GraphData, memType: string) => {
  const relatedMemTypes = getRelatedMemTypes(config, memType);
  const hasAnimation = relatedMemTypes.some(type => animationMap.has(type));

  if (!hasAnimation) {
    return {
      animate: false,
      bufferList: getRuntimeBuffers(config, graphData, memType),
    };
  }

  return {
    animate: true,
    bufferList: relatedMemTypes.flatMap(type => animationMap.get(type) || graphData[type]?.bufferList || []),
  };
};

const getPathMemType = (config: ChipConfig, memType: string): string => {
  const targetNode = config.memoryTypeMap[memType];
  return targetNode === 'gm' ? 'MEM_L2' : memType;
};

const normalizeAnimation = (animationData: any): any => animationData?.value ?? animationData ?? null;

const getSpeed = (time: number, memType: string, bufferList: BufferState[], unitKB: number, animationSpeed: number, config: ChipConfig): number => {
  const relatedMemTypes = new Set(getRelatedMemTypes(config, memType));
  const changedBuffers = bufferList.filter(buffer => relatedMemTypes.has(buffer.memType));
  const total = changedBuffers.reduce((sum, buffer) => sum + (buffer.size || 0), 0);

  if (time <= 0 || total <= 0) {
    return 0;
  }

  const speedRatio = animationSpeed === 4 ? 2 : animationSpeed || 1;
  return (time * 10 / speedRatio) / (total / 1024 / unitKB);
};

const buildAnimationState = (config: ChipConfig, graphData: GraphData, animationData: any): AnimationState => {
  const animation = normalizeAnimation(animationData);
  const state: AnimationState = {
    activePaths: new Set<string>(),
    animationMap: new Map<string, BufferState[]>(),
    errorMemTypes: [],
    changeBufferList: [],
    startTime: 0,
    endTime: 0,
    errorMsg: {
      freeSize: 0,
      requestSize: 0,
    },
  };

  if (!animation?.action) {
    return state;
  }

  const { action } = animation;
  const originBufferList: BufferState[] = action.originBufferList || [];
  const targetBufferList: BufferState[] = action.targetBufferList || [];
  const errorMemTypes: string[] = action.errorMemType || [];
  const inputMemIds = animation.inputMemIds || [];
  const outputMemIds = animation.outputMemIds || [];

  state.changeBufferList = targetBufferList;
  state.errorMemTypes.push(...errorMemTypes);
  state.startTime = Number(animation.clock || 0);
  state.endTime = Number(animation.cycleEnd || state.startTime + 100);

  if (errorMemTypes.length > 0) {
    state.errorMsg.freeSize = (animation.bufferSnapshot?.freeIntervals?.[0]?.size || 0) / 1024;
    state.errorMsg.requestSize = (animation.requestSize || 0) / 1024;
  }

  inputMemIds.forEach(input => {
    outputMemIds.forEach(output => {
      const inputMem = originBufferList.find(buffer => buffer?.memId === input) || targetBufferList.find(buffer => buffer?.memId === input);
      const outputMem = originBufferList.find(buffer => buffer?.memId === output) || targetBufferList.find(buffer => buffer?.memId === output);

      if (!inputMem || !outputMem) {
        return;
      }

      const inputName = getPathMemType(config, inputMem.memType);
      const outputName = getPathMemType(config, outputMem.memType);

      if (outputName === 'MEM_L0C') {
        state.activePaths.add(`E-${inputName}-MEM_CUBE`);
        state.activePaths.add('E-MEM_CUBE-MEM_L0C');
      }

      state.activePaths.add(`E-${inputName}-${outputName}`);
    });
  });

  targetBufferList.forEach(buffer => {
    const existingBuffers = state.animationMap.get(buffer.memType) || [...(graphData[buffer.memType]?.bufferList || [])];
    const targetIndex = existingBuffers.findIndex(item => item?.memId === buffer?.memId);

    if (targetIndex === -1) {
      if (buffer.status !== 0) {
        existingBuffers.push(buffer);
      }
    } else if (buffer.status === 0) {
      existingBuffers[targetIndex] = buffer;
    } else {
      existingBuffers[targetIndex] = buffer;
    }

    state.animationMap.set(buffer.memType, existingBuffers);
  });

  return state;
};

const buildNodeData = (node: ChipNode, isSplitChild = false): Record<string, any> => {
  const resolvedStyle = resolveNodeStyle(node).data;
  const data: Record<string, any> = {
    ...clone(resolvedStyle),
    ...(node.data ? clone(node.data) : {}),
    label: node.label,
    handles: isSplitChild ? [] : node.handles || [],
  };

  if (node.grid) {
    data.cols = node.grid.cols;
    data.rows = node.grid.rows;
    data.shape = node.grid.shape;
    data.unitKB = node.grid.unitKB;
    data.filledCount = node.initialFilledCount || 0;

    if (node.showHeader !== undefined) {
      data.showHeader = node.showHeader;
    } else if (data.showHeader === undefined) {
      data.showHeader = node.kind !== 'compute';
    }

    data.showStats = node.showStats || false;
  }

  if (node.size) {
    data.width = node.size.width;
    data.height = node.size.height;
  }

  if (node.visibility === 'hidden') {
    data.containerStyle = {
      ...(data.containerStyle || {}),
      visibility: 'hidden',
    };
  }

  if (node.memType) {
    data.memType = node.memType;
  }

  if (node.splitType) {
    data.splitType = node.splitType;
  }

  return data;
};

const buildFlowNode = (node: ChipNode): any => {
  const data = buildNodeData(node);
  const splitChild = node.splitChildren?.[0];

  if (splitChild) {
    data.splitData = buildNodeData(splitChild, true);
  }

  return {
    id: node.id,
    type: node.component,
    position: node.position || { x: 0, y: 0 },
    parentNode: node.parentId,
    memId: node.memType,
    data,
  };
};

const buildFlowEdge = (edge: ChipEdge): any => {
  const resolvedStyle = resolveEdgeStyle(edge);
  const flowEdge: any = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: 'labeled',
    data: {
      ...clone(resolvedStyle.data),
      label: edge.label || '',
      dashed: edge.dash || resolvedStyle.data.dashed,
      doubleArrow: edge.doubleArrow || false,
      labelX: edge.labelX,
      labelY: edge.labelY,
      labelWidth: edge.labelWidth,
      labelHeight: edge.labelHeight,
      borderRadius: edge.borderRadius,
      waypoints: edge.waypoints,
    },
    style: clone(resolvedStyle.style),
    path: edge.path,
  };

  if (edge.markerEnd !== false) {
    flowEdge.markerEnd = edge.markerEnd || 'arrowclosed';
  }

  return flowEdge;
};

export const buildBaseMemoryFlow = (config: ChipConfig): MemoryFlowElements => ({
  nodes: config.nodes.map(buildFlowNode),
  edges: config.edges.map(buildFlowEdge),
});

const applyMemoryRuntimeToData = (
  data: Record<string, any>,
  memType: string,
  graphData: GraphData,
  animationState: AnimationState,
  animationSpeed: number,
  config: ChipConfig,
): Record<string, any> => {
  const unitKB = data.unitKB || 1;
  const currentBuffers = getRuntimeBuffers(config, graphData, memType);
  const animationBuffers = getAnimationBuffers(config, animationState.animationMap, graphData, memType);
  const error = animationState.errorMemTypes.includes(memType);
  const filledBuffers = animationBuffers.animate ? animationBuffers.bufferList : currentBuffers;
  const filledCount = Math.ceil(sumActiveBytes(filledBuffers) / 1024 / unitKB);

  return {
    ...data,
    animate: animationBuffers.animate || error,
    speed: getSpeed(animationState.endTime - animationState.startTime, memType, animationState.changeBufferList, unitKB, animationSpeed, config),
    filledCount,
    bufferList: currentBuffers,
    tiers: getTiers(currentBuffers, unitKB),
    animationData: animationBuffers.animate || error ? {
      stepCount: animationSpeed === 4 ? 4 : 1,
      originTiers: getTiers(currentBuffers, unitKB),
      targetTiers: getTiers(animationBuffers.bufferList, unitKB),
      error,
      animationSpeed,
      errorMsg: animationState.errorMsg,
    } : {},
  };
};

const applyRuntimeToNode = (node: any, config: ChipConfig, graphData: GraphData, animationState: AnimationState, animationSpeed: number): any => {
  if (!node.memId) {
    return node;
  }

  const nextNode = clone(node);
  nextNode.data = applyMemoryRuntimeToData(nextNode.data, node.memId, graphData, animationState, animationSpeed, config);

  const splitMemType = nextNode.data.splitData?.memType;
  if (splitMemType) {
    nextNode.data.splitData = applyMemoryRuntimeToData(nextNode.data.splitData, splitMemType, graphData, animationState, animationSpeed, config);
  }

  return nextNode;
};

const applyRuntimeToEdge = (edge: any, animationState: AnimationState, animationSpeed: number): any => {
  if (!edge.path || !animationState.activePaths.has(edge.path)) {
    return edge;
  }

  return {
    ...edge,
    data: {
      ...edge.data,
      flowStage: 1,
      startTime: 0,
      endTime: (Number(animationState.endTime) / animationSpeed - Number(animationState.startTime) / animationSpeed) * 10,
    },
  };
};

export const buildMemoryFlow = (
  config: ChipConfig,
  graphData?: GraphData | null,
  animationData?: any,
  animationSpeed = 1,
): MemoryFlowElements => {
  const baseFlow = buildBaseMemoryFlow(config);

  if (!graphData) {
    return baseFlow;
  }

  const animationState = buildAnimationState(config, graphData, animationData);

  return {
    nodes: baseFlow.nodes.map(node => applyRuntimeToNode(node, config, graphData, animationState, animationSpeed)),
    edges: baseFlow.edges.map(edge => applyRuntimeToEdge(edge, animationState, animationSpeed)),
  };
};

export const buildGraphDataFromBuffers = (config: ChipConfig, bufferList: BufferState[]): GraphData => {
  const memoryTypes = new Set([...Object.keys(config.memoryCapacityBytes), ...Object.keys(config.memoryTypeMap)]);
  const graphData: GraphData = {};

  memoryTypes.forEach(memType => {
    graphData[memType] = {
      size: bytesToKB(config.memoryCapacityBytes[memType] || 0),
      bufferList: bufferList.filter(buffer => buffer.memType === memType && buffer.status !== 0),
    };
  });

  return graphData;
};
