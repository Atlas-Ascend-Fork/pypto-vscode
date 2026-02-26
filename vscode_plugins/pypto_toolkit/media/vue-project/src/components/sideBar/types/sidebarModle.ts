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
  showSingleDelete?: boolean; // 显示单个删除按钮

  disableSelect?: boolean;
  disableCheck?: boolean;
  disableToggle?: boolean;

  // 从接口继承的属性
  absolutePath?: string;
  outputPath?: string;
  pathName?: string;
  directoryPath?: string;

  [key: string]: unknown;
}
