/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { ControlFlowNodesType, EdgesType } from '../type/node-detail-types';

export function buildPathEdges(nodes: ControlFlowNodesType[]): EdgesType[] {
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
      // if节点下的最后一个Path指向下一个非'IF-PATH'类型节点
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

export function buildIfEdges(nodes: ControlFlowNodesType[]): EdgesType[] {
  const edges: EdgesType[] = [];
  for (const node of nodes) {
    if (node.type !== 'if-card-node' || !node.data.source.children) {
      continue;
    }
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
  return edges;
}
