export interface SelectFileChangeEventParam {
  fileContent: any;
  fileName: string;
}

export interface DiffListItem {
  changeType: 'change' | 'add' | 'delete';
  nodeType: 'tensor' | 'op';
  magic: number | string;
  nodeId: string;
}
