import type { ControlFlowData, PathTreeData } from './navbar-types';
import type { PathInPass } from '../../../../../src/types/control-flow';

export function transformAndFlatTreeData(
  treeData: ControlFlowData[],
  TreeDataMap: Record<PathTreeData['id'], PathTreeData>,
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
    TreeDataMap[itemData.id] = itemData;
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
