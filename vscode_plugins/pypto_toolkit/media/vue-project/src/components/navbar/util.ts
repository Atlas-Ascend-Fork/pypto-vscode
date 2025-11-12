import type { ControlFlowData, PathTreeData } from './navbar-types';
import type { PathInPass, LeafInPass } from '../../../../../src/types/control-flow';

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
      id: item.magic,
      label: item.magicName,
      parentNode: parent,
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
