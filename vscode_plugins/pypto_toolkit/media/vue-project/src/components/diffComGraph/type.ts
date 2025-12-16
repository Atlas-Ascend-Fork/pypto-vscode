import { InjectionKey } from 'vue';

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

export type TDiffLayout = 'horizontal' | 'vertical';

export interface DiffComGraphContext {
  getOtherNodeTitle(curNode: any, curType: 'before' | 'after'): string | undefined;
}

export const DiffComGraphProvideKey = 'diffComGraph' as unknown as InjectionKey<DiffComGraphContext>;
