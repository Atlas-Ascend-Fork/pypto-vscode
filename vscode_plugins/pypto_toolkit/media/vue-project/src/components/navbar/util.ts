import type { PathData, PassData } from './navbar-types';

export function transformAndFlatTreeData(treeData: PathData[], TreeDataMap: Record<number, PathData>, parent?: PathData) {
  for (let i = 0; i < treeData.length; i++) {
    const itemData = treeData[i];
    itemData.id = itemData.magic;
    itemData.label = itemData.magicName;
    parent && (itemData.parentNode = parent);
    TreeDataMap[itemData.magic] = itemData;

    if (itemData.children?.length) {
      itemData.expanded = true;
      itemData.disableToggle = true;
      transformAndFlatTreeData(itemData.children, TreeDataMap, itemData);
    }
  }
}

export function transformPassList(list: PassData[]) {
  const res: Partial<Record<PassData['passStage'], PassData[]>> = {};

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
