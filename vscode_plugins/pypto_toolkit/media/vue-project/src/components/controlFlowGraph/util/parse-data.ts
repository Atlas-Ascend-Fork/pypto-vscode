/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { CombsType, ControlFlowNodesType, EdgesType, GroupNode } from '../type/node-detail-types';

interface TraverseContext {
  nodes: ControlFlowNodesType[];
  combos: CombsType[];
  lastNodeY: number;
  isFirstNode: boolean;
  magicName: string;
  loopTopCount: number;
  loopLastPathCount: number;
  lastPathBottomCount: number;
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
    if (child) {
      const pruned = pruneIfNodes(child);
      prunedChildren.push(pruned);
    } else {
      prunedChildren.push(null);
    }
  }
  const hasValidChild = prunedChildren.some(child => child !== null);
  if (!hasValidChild) {
    return null;
  }
  return {
    ...node,
    children: prunedChildren,
  };
}

// 构建IF嵌套的层级结构
function calculateIfNode(root: GroupNode): { levelWidths: number[]; maxLever: number } {
  const levelWidths: number[] = [];
  let maxLever = 0;

  const queue: { node: GroupNode; level: number }[] = [];
  queue.push({ node: root, level: 0 });

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (level >= levelWidths.length) {
      levelWidths[level] = 0;
    }
    levelWidths[level] += 1;
    node.x = levelWidths[level];
    node.y = level;

    if (node.children && node.children.length > 0) {
      const nextLevel = level + 1;
      for (let i = 0; i < node.children.length; i++) {
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

function getLevelWidths(root: GroupNode): number[] {
  const levelWidths: number[] = [];
  const queue: { node: GroupNode; level: number }[] = [];
  queue.push({ node: root, level: 0 });

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (level >= levelWidths.length) {
      levelWidths[level] = 0;
    }
    levelWidths[level] += 1;
    if (node.children) {
      for (const child of node.children) {
        queue.push({ node: child, level: level + 1 });
      }
    }
  }
  return levelWidths;
}

// 构建顺序节点之间的边
function buildSequentialEdges(nodes: ControlFlowNodesType[]): EdgesType[] {
  const edges: EdgesType[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    if (!next || current.type !== 'path-card-node') {
      continue;
    }
    if (current.type === next.type || next.type === 'if-card-node') {
      if (current.data?.type === 'IF-PATH') {
        continue;
      }
      edges.push({
        source: current.id,
        target: next.id,
        style: { lineWidth: 0, opacity: 0 },
      });
    } else if (current.data?.type === 'IF-PATH') {
      if (next.data?.type === 'IF-PATH') {
        continue;
      }
      edges.push({
        source: current.id,
        target: next.id,
      });
    }
  }
  return edges;
}

// 构建if节点指向子节点的边
function buildIfChildEdges(nodes: ControlFlowNodesType[]): EdgesType[] {
  const edges: EdgesType[] = [];
  for (const node of nodes) {
    if (node.type === 'if-card-node' && node.data.source.children) {
      for (const child of node.data.source.children) {
        if (child) {
          edges.push({
            source: node.id,
            target: child.hash,
            type: 'polyline',
            style: {
              lineWidth: 1,
              radius: 20,
              stroke: '#666666',
              opacity: 0.8,
              controlPoints: [[node.style.x, (node.style.y + child.y) / 2]],
              endArrow: true,
              router: {
                type: 'orth',
              },
            },
          });
        }
      }
    }
  }
  return edges;
}

export function transformData(rootNodes: GroupNode[]): {
  nodes: ControlFlowNodesType[];
  edges: EdgesType[];
  combos: CombsType[];
} {
  const nodes: ControlFlowNodesType[] = [];
  const combos: CombsType[] = [];
  const context: TraverseContext = {
    nodes,
    combos,
    lastNodeY: 0,
    isFirstNode: false,
    magicName: '',
    loopTopCount: 0,
    loopLastPathCount: 0,
    lastPathBottomCount: 0,
  };

  function drawNode(root: GroupNode, ctx: TraverseContext, parentId: string | null, deepRankSep: number): number {
    const prunedRoot = pruneIfNodes(root);
    if (!prunedRoot) {
      return 0;
    }
    const verticalSpacing = -40;
    const nodeHeight = 220;
    const { levelWidths, maxLever } = calculateIfNode(prunedRoot);
    const starY = ctx.lastNodeY + ctx.loopTopCount * 40 + ctx.loopLastPathCount * 25 + 30;
    const maxWidth = Math.pow(2, maxLever) * 200 + Math.pow(2, maxLever) * 50;
    const leverEdgeWidth = [maxWidth / 4];
    for (let i = 0; i < levelWidths.length - 1; i++) {
      if (levelWidths[i + 1] > levelWidths[i]) {
        leverEdgeWidth.push(leverEdgeWidth[i] / 2);
      } else {
        leverEdgeWidth.push(leverEdgeWidth[i]);
      }
    }

    function layoutTree(node: GroupNode, level: number, startX: number): void {
      node.y = level;
      if (node.children && node.children.length !== 0) {
        const offsetIf = leverEdgeWidth[level];
        let leftLeafX = startX - offsetIf;
        let rightLeafX = startX + offsetIf;
        if (!node.children[0]) {
          rightLeafX = startX;
        }
        if (!node.children[1]) {
          leftLeafX = startX;
        }
        if (node.children[0]) {
          layoutTree(node.children[0], level + 1, leftLeafX);
        }
        if (node.children[1]) {
          layoutTree(node.children[1], level + 1, rightLeafX);
        }
      }
      const name = node.nodeType === 'PATH' ? node.magicName.substring(node.magicName.indexOf('PATH')) : '';
      const functionStats = {
        leafFunction: node?.meta?.leafFunctions?.length || 0,
        called: node?.meta?.calledRecords?.length || 0,
        callee: node?.meta?.calleeRecords?.length || 0,
      };
      if (node.x !== undefined && node.y !== undefined) {
        node.hash = node.hash === '' ? `${node.x}_${node.y}_${parentId}` : node.hash;
        const newNode: ControlFlowNodesType = {
          id: node.hash,
          type: node.nodeType === 'PATH' ? 'path-card-node' : 'if-card-node',
          parentId: ctx.magicName,
          combo: parentId,
          data: {
            source: node,
            name,
            functionStats,
            errorStats: {},
            type: node.nodeType === 'IF' ? 'IF-CARD' : 'IF-PATH',
          },
          style: {
            x: startX + (45 * (deepRankSep - 1) + 20) / 2,
            y: starY + node.y * (nodeHeight + verticalSpacing),
          },
        };
        node.x = startX;
        node.y = starY + node.y * (nodeHeight + verticalSpacing);
        ctx.lastNodeY = Math.max(newNode.style.y, ctx.lastNodeY);
        ctx.nodes.push(newNode);
      }
    }

    layoutTree(prunedRoot, 0, maxWidth / 2);
    return maxWidth - 50;
  }

  function handleIfNode(node: GroupNode, ctx: TraverseContext, parentId: string | null, deepRankSep: number): number | null {
    if (node.nodeType !== 'IF' && (node.nodeType !== 'PATH' || ctx.isFirstNode)) {
      return null;
    }
    const ifWidth = drawNode(node, ctx, parentId, deepRankSep);
    ctx.lastNodeY += ctx.loopTopCount * 40 + ctx.loopLastPathCount * 25 + 30;
    ctx.loopTopCount = 0;
    ctx.lastPathBottomCount = ctx.loopLastPathCount;
    ctx.loopLastPathCount = deepRankSep;
    if (ctx.isFirstNode) {
      ctx.isFirstNode = false;
    }
    return ifWidth;
  }

  function handlePathNode(node: GroupNode, ctx: TraverseContext, parentId: string | null, parentType: string, deepRankSep: number): number {
    if (ctx.isFirstNode) {
      ctx.lastNodeY += ctx.loopTopCount * 40 + ctx.loopLastPathCount * 25 + 30;
      ctx.loopTopCount = 0;
      ctx.lastPathBottomCount = ctx.loopLastPathCount;
      ctx.loopLastPathCount = deepRankSep;
      ctx.isFirstNode = false;
    } else {
      ctx.lastNodeY += ctx.loopTopCount * 40 + ctx.lastPathBottomCount * 25 + 30;
      ctx.loopTopCount = 0;
      ctx.lastPathBottomCount = ctx.loopLastPathCount;
      ctx.loopLastPathCount = deepRankSep;
    }

    const name = node.magicName.substring(node.magicName.indexOf('PATH'));
    const functionStats = {
      leafFunction: node?.meta?.leafFunctions?.length || 0,
      called: node?.meta?.calledRecords?.length || 0,
      callee: node?.meta?.calleeRecords?.length || 0,
    };
    const nodeSize = [200, 140];
    const newNode: ControlFlowNodesType = {
      id: node.hash,
      type: 'path-card-node',
      parentId: ctx.magicName,
      combo: parentId,
      data: {
        source: node,
        name,
        functionStats,
      },
      style: {
        x: 45 * (deepRankSep - 1) + 30,
        y: ctx.lastNodeY,
      },
    };
    ctx.lastNodeY += nodeSize[1] + 20;
    ctx.nodes.push(newNode);

    const id = node.magicName.substring('TENSOR_'.length);
    if (node.children) {
      for (const child of node.children) {
        traverse(child, id, node.nodeType, deepRankSep);
      }
    }
    return 200;
  }

  function traverse(node: GroupNode, parentId: string | null, parentType: string, deepRankSep: number): number {
    let comboWidth = 0;
    const id = node.magicName.substring('TENSOR_'.length);

    if (node.nodeType === 'LOOP') {
      deepRankSep++;
      context.loopTopCount++;
    }

    // 处理常规Path节点
    if (node.nodeType === 'PATH' && parentType === 'LOOP') {
      return handlePathNode(node, context, parentId, parentType, deepRankSep);
    }

    // 处理IF嵌套节点
    if (node.nodeType === 'IF' || (node.nodeType === 'PATH' && parentType === 'IF')) {
      if (context.isFirstNode || parentType === 'LOOP') {
        const result = handleIfNode(node, context, parentId, deepRankSep);
        if (result !== null) {
          return result;
        }
      }
    }

    parentType = node.nodeType;

    // 递归子节点
    if (node.children) {
      for (const child of node.children) {
        const childWidth = traverse(child, node.nodeType === 'IF' ? parentId : id, parentType, deepRankSep);
        comboWidth = Math.max(comboWidth, childWidth + 60);
      }
    }

    // 生成combs父子节点记录
    if (parentType === 'LOOP' && node.nodeType === 'LOOP') {
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
      combos.push(combosRecord);
    }
    return comboWidth + 30;
  }

  // 遍历所有根节点
  for (const root of rootNodes) {
    context.magicName = root.magicName;
    context.isFirstNode = true;
    traverse(root, null, 'LOOP', 0);
  }

  // 构建edges数组
  const edges = [...buildSequentialEdges(nodes), ...buildIfChildEdges(nodes)];

  return { nodes, edges, combos };
}
