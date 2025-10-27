export interface DevUITreeNode {
  id: string;
  label: string;
  type: 'dir' | 'file';
  date?: string;
  expanded: boolean;
  isLeaf: boolean; // 新增：标识是否为叶子节点（文件为true，文件夹为false）
  children?: DevUITreeNode[];

  selected?: boolean;
  checked?: boolean;

  disableSelect?: boolean;
  disableCheck?: boolean;
  disableToggle?: boolean;

  // 从接口继承的属性
  absolutePath?: string;
  outputPath?: string;
  pathName?: string;

  [key: string]: unknown;
}
