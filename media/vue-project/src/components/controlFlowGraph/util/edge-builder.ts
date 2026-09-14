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
