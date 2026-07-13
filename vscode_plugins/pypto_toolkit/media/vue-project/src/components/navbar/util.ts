/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import type { ControlFlowData, PathTreeData } from './navbar-types';
import type { PathInPass, LeafInPass, controlFlowNode } from '../../../../../src/types/control-flow';

function pruneIFNode(node: controlFlowNode): ControlFlowNode | null {
  if (node.nodeType === 'PATH') {
    return node;
  }

  if (!node.children || node.children.length === 0) {
    return null;
  }

  const prunedChildren: ControlFlowNode[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child) {
      const pruned = pruneIFNode(child);
      if (pruned) {
        prunedChildren.push(pruned);
      }
    }
  }

  if (prunedChildren.length === 0) {
    return null;
  }

  return {
    ...node,
    children: prunedChildren,
  };
}

export function pruneControlFlowData(data: ControlFlowData[]): ControlFlowData[] {
  const result: ControlFlowData[] = [];
  for (let i = 0; i < data.length; i++) {
    const pruned = pruneIFNode(data[i]);
    if (pruned) {
      result.push(pruned);
    }
  }
  return result;
}

export function transformAndFlatTreeData(
  treeData: ControlFlowData[],
  TreeDataMap: Record<PathTreeData['label'], PathTreeData>,
  parent?: PathTreeData,
) {
  const res: PathTreeData[] = [];
  for (let i = 0; i < treeData.length; i++) {
    const item = treeData[i];
    const itemData: PathTreeData = {
      controlFlowData: item,
      label: item.magicName,
      parentNode: parent,
      magicName: parseMagicName(item),
    };
    TreeDataMap[item.magicName] = itemData;
    res.push(itemData);

    if (item.children?.length) {
      itemData.expanded = true;
      itemData.disableToggle = true;
      itemData.children = transformAndFlatTreeData(item.children, TreeDataMap, itemData);
    }
  }

  return res;
}

function parseIfMagicName(magicName: string) {
  const index = magicName.indexOf('(');
  if (index !== -1) {
    return magicName.substring(0, index);
  }
  return magicName;
}

function parseMagicName(item: ControlFlowData) {
  if (item.nodeType === 'PATH') {
    return item.magicName.substring(item.magicName.indexOf('PATH'));
  } else {
    return item.magicName;
  }
}

export function transformPassList(list: PathInPass[]) {
  const res: Partial<Record<PathInPass['passStage'], PathInPass[]>> = {};

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (res[item.passStage]) {
      res[item.passStage]!.push(item);
    } else {
      res[item.passStage] = [item];
    }
  }

  return res;
}

export function UpperFirstStr(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function transformLeafFunctionList(functions: LeafInPass[]) {
  const ownedList: LeafInPass[] = [];
  const notOwnedList: LeafInPass[] = [];

  for (let i = 0; i < functions.length; i++) {
    const item = functions[i];
    if (item.isOwnedLeaf) {
      ownedList.push(item);
    } else {
      notOwnedList.push(item);
    }
  }

  return { ownedList, notOwnedList };
}

export function findFirstPath(controlFlowList: ControlFlowData[]) {
  for (let i = 0; i < controlFlowList.length; i++) {
    const item = controlFlowList[i];
    if (item.nodeType === 'PATH') {
      return item;
    } else if (item.children) {
      return findFirstPath(item.children);
    }
  }
}

const passDirectoryRegExp = /^Pass_(\d+)_(\w+)/;
export function parsePassName(passName: string) {
  const [_, __, newPassName] = passName.match(passDirectoryRegExp) ?? [];

  return newPassName;
}

export function parsePathMagicName(magicName: string) {
  return magicName.substring(magicName.indexOf('PATH'));
}

export function getMaxDepth(data: ControlFlowData[], depth = 0): number {
  if (!data || data.length === 0) {
    return depth;
  }
  let maxDepth = depth;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.children && item.children.length > 0) {
      const childDepth = getMaxDepth(item.children, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    } else {
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  return maxDepth;
}