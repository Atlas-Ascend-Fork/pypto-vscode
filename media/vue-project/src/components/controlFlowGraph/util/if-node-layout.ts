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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CombsType, ControlFlowNodesType, GroupNode } from '../type/node-detail-types';
import type { TraversalState } from './parse-data';

export function computeFunctionStats(node: GroupNode) {
  return {
    leafFunction: node?.meta?.leafFunctions?.length || 0,
    called: node?.meta?.calledRecords?.length || 0,
    callee: node?.meta?.calleeRecords?.length || 0,
  };
}

// 对子节点都为空的节点进行剪枝
function pruneIfNodes(node: GroupNode): GroupNode | null {
  if (node.nodeType !== 'IF') {
    return node;
  }
  if (!node.children || node.children.length === 0) {
    return null;
  }
  const prunedChildren: (GroupNode | null)[] = [];
  for (const child of node.children) {
    prunedChildren.push(child ? pruneIfNodes(child) : null);
  }
  if (!prunedChildren.some(child => child !== null)) {
    return null;
  }
  return { ...node, children: prunedChildren };
}

// 构建IF嵌套的层级结构
function calculateIfNode(root: GroupNode) {
  const levelWidths: number[] = [];
  let maxLever = 0;

  // 构建队列
  const queue: { node: GroupNode; level: number }[] = [];
  queue.push({ node: root, level: 0 });

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (level >= levelWidths.length) {
      levelWidths[level] = 0;
    }
    levelWidths[level] += 1;
    //     设置当前节点坐标
    node.x = levelWidths[level];
    node.y = level;

    if (node.children && node.children.length > 0) {
      const nextLevel = level + 1;
      const childCount = node.children.length;

      for (let i = 0; i < childCount; i++) {
        const child = node.children[i];
        if (child) {
          queue.push({ node: child, level: nextLevel });
        }
      }
    }
    maxLever = Math.max(maxLever, level);
  }
  maxLever = levelWidths[levelWidths.length - 2];
  return { levelWidths, maxLever };
}

function computeLeverEdgeWidths(levelWidths: number[], maxWidth: number): number[] {
  const leverEdgeWidth = [maxWidth / 4];
  for (let i = 0; i < levelWidths.length - 1; i++) {
    const offsetWidth = leverEdgeWidth[i];
    leverEdgeWidth.push(levelWidths[i + 1] > levelWidths[i] ? offsetWidth / 2 : offsetWidth);
  }
  return leverEdgeWidth;
}

function layoutTree(
  root: GroupNode,
  level: number,
  startX: number,
  leverEdgeWidth: number[],
  starY: number,
  parentId: string | null,
  magicName: string,
  deepRankSep: number,
  state: TraversalState,
) {
  const verticalSpacing = -40;
  const nodeHeight = 220;
  root.y = level;
  if (root.children && root.children.length !== 0) {
    const offsetIf = leverEdgeWidth[level];
    let leftLeafX = startX - offsetIf;
    let rightLeafX = startX + offsetIf;
    // 只有一个子节点时放在正下方
    if (!root.children[0]) {
      rightLeafX = startX;
    }
    if (!root.children[1]) {
      leftLeafX = startX;
    }
    if (root.children[0]) {
      layoutTree(root.children[0], level + 1, leftLeafX, leverEdgeWidth, starY, parentId, magicName, deepRankSep, state);
    }
    if (root.children[1]) {
      layoutTree(root.children[1], level + 1, rightLeafX, leverEdgeWidth, starY, parentId, magicName, deepRankSep, state);
    }
  }
  let name = '';
  if (root.nodeType === 'PATH') {
    name = root.magicName.substring(root.magicName.indexOf('PATH'));
  }
  //     计算functionStats
  const functionStats = computeFunctionStats(root);
  //     计算errorStats（todo:本版本无err，预留接口）
  const errorStats = {};
  if (root.x !== undefined && root.y !== undefined) {
    root.hash = root.hash === '' ? `${root.x}_${root.y}_${parentId}` : root.hash;
    const newNode: ControlFlowNodesType = {
      id: root.hash,
      type: root.nodeType === 'PATH' ? 'path-card-node' : 'if-card-node',
      parentId: magicName,
      combo: parentId,
      data: {
        source: root,
        name,
        functionStats,
        errorStats,
      },
      style: {
        x: startX + (45 * (deepRankSep - 1) + 20) / 2,
        y: starY + root.y * (nodeHeight + verticalSpacing),
      },
    };
    root.x = startX;
    root.y = starY + root.y * (nodeHeight + verticalSpacing);
    state.lastNodeY = Math.max(newNode.style.y, state.lastNodeY);
    newNode.data = {
      ...newNode.data,
      type: root.nodeType === 'IF' ? 'IF-CARD' : 'IF-PATH',
    };
    state.nodes.push(newNode);
  }
}

export function drawIfNode(
  root: GroupNode,
  parentId: string | null,
  magicName: string,
  deepRankSep: number,
  state: TraversalState,
): number {
  const prunedRoot = pruneIfNodes(root);
  if (!prunedRoot) {
    return 0;
  }
  const { levelWidths, maxLever } = calculateIfNode(prunedRoot);
  const starY = state.lastNodeY + state.loopTopCount * 40 + state.loopLastPathCount * 25 + 30;
  const maxWidth = Math.pow(2, maxLever) * 200 + Math.pow(2, maxLever) * 50;
  const leverEdgeWidth = computeLeverEdgeWidths(levelWidths, maxWidth);
  layoutTree(prunedRoot, 0, maxWidth / 2, leverEdgeWidth, starY, parentId, magicName, deepRankSep, state);
  return maxWidth - 50;
}
