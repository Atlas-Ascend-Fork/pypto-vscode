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
import { CombsType, ControlFlowNodesType, EdgesType, GroupNode } from '../type/node-detail-types';
import { computeFunctionStats, drawIfNode } from './if-node-layout';
import { buildPathEdges, buildIfEdges } from './edge-builder';

export interface TraversalState {
  nodes: ControlFlowNodesType[];
  combos: CombsType[];
  lastNodeY: number;
  isFirstNode: boolean;
  magicName: string;
  loopTopCount: number;
  loopLastPathCount: number;
  lastPathBottomCount: number;
}

function updateSpacing(state: TraversalState, deepRankSep: number, useLoopLastPath: boolean) {
  const spacingCount = useLoopLastPath ? state.loopLastPathCount : state.lastPathBottomCount;
  state.lastNodeY += state.loopTopCount * 40 + spacingCount * 25 + 30;
  state.loopTopCount = 0;
  state.lastPathBottomCount = state.loopLastPathCount;
  state.loopLastPathCount = deepRankSep;
}

function handlePathUnderLoop(
  node: GroupNode,
  parentId: string | null,
  deepRankSep: number,
  state: TraversalState,
): number {
  const pathWidth = 200;
  const id = node.magicName.substring('TENSOR_'.length);

  updateSpacing(state, deepRankSep, state.isFirstNode);
  if (state.isFirstNode) {
    state.isFirstNode = false;
  }

  const name = node.magicName.substring(node.magicName.indexOf('PATH'));
  const functionStats = computeFunctionStats(node);
  // 计算errorStats（todo：预留err 对象接口）
  const errorStats = {};
  const nodeSize = node.nodeType === 'PATH' ? [200, 140 + Object.keys(errorStats).length * 30] : [200, 100];
  const newNode: ControlFlowNodesType = {
    id: node.hash,
    type: 'path-card-node',
    parentId: state.magicName,
    combo: parentId,
    data: {
      source: node,
      name,
      functionStats,
    },
    style: {
      x: 45 * (deepRankSep - 1) + 30,
      y: state.lastNodeY,
    },
  };
  state.lastNodeY += nodeSize[1] + 20;
  state.nodes.push(newNode);
  // 递归子节点
  if (node.children) {
    for (const child of node.children) {
      traverseNode(child, id, node.nodeType, deepRankSep, state);
    }
  }
  return pathWidth;
}

function traverseNode(
  node: GroupNode,
  parentId: string | null,
  parentType: string,
  deepRankSep: number,
  state: TraversalState,
): number {
  let comboWidth = 0;
  const id = node.magicName.substring('TENSOR_'.length);
  if (node.nodeType === 'LOOP') {
    deepRankSep++;
    state.loopTopCount++;
  }

  //  如果是常规Path节点
  if (node.nodeType === 'PATH' && parentType === 'LOOP') {
    return handlePathUnderLoop(node, parentId, deepRankSep, state);
  }

  //  如果是if嵌套节点
  if (node.nodeType === 'IF' || (node.nodeType === 'PATH' && parentType === 'IF')) {
    if (state.isFirstNode) {
      const ifWidth = drawIfNode(node, parentId, state.magicName, deepRankSep, state);
      updateSpacing(state, deepRankSep, true);
      state.isFirstNode = false;
      return ifWidth;
    }
    if (parentType === 'LOOP') {
      const ifWidth = drawIfNode(node, parentId, state.magicName, deepRankSep, state);
      updateSpacing(state, deepRankSep, true);
      return ifWidth;
    }
  }

  parentType = node.nodeType;

  // 递归子节点
  if (node.children) {
    for (const child of node.children) {
      const childWidth = traverseNode(child, node.nodeType === 'IF' ? parentId : id, parentType, deepRankSep, state);
      comboWidth = Math.max(comboWidth, childWidth + 60); //padding 30，左右两侧60
    }
  }
  if (parentType === 'LOOP' && node.nodeType === 'LOOP') {
    // 生成combs父子节点记录
    const combosRecord: CombsType = {
      id,
      ...(parentId ? { combo: parentId } : {}),
      data: {
        nodeType: node.nodeType,
        magic: node.magic,
        magicName: node.magicName,
        hash: node.hash,
        sourceCode: node.sourceCode,
      },
      comboWidth,
    };
    state.combos.push(combosRecord);
  }
  return comboWidth + 30;
}

export function transformData(rootNodes: GroupNode[]): {
  nodes: ControlFlowNodesType[];
  edges: EdgesType[];
  combos: CombsType[];
} {
  const state: TraversalState = {
    nodes: [],
    combos: [],
    lastNodeY: 0,
    isFirstNode: false,
    magicName: '',
    loopTopCount: 0,
    loopLastPathCount: 0,
    lastPathBottomCount: 0,
  };

  // 遍历所有根节点
  for (const root of rootNodes) {
    state.magicName = root.magicName;
    state.isFirstNode = true;
    traverseNode(root, null, 'LOOP', 0, state);
  }

  return {
    nodes: state.nodes,
    edges: [...buildPathEdges(state.nodes), ...buildIfEdges(state.nodes)],
    combos: state.combos,
  };
}
