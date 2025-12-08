import type { InjectionKey, Ref } from 'vue';

export interface ComGraphContext {
  toggleHealthReport: (status: boolean) => void;
  toggleLeafCalledRecord: (status: boolean, leafName: string) => void;
  showLayerControl: Ref<boolean>;
  leafCalledRecordMap: Ref<Record<string, number>>;
}
export const ComGraphProvideKey = 'comGraph' as unknown as InjectionKey<ComGraphContext>;

export enum GraphType {
  TENSOR_GRAPH,
  TILE_GRAPH,
  EXECUTE_GRAPH,
  BLOCK_GRAPH,
  LEAF_VF_GRAPH,
  INVALID,
}

export type SortDirection = 'default' | 'asc' | 'desc';

export interface LeafCalledRowData {
  name: string;
  value: number;
  percent: number;
}
export type SortMethod<T = LeafCalledRowData> = (a: T, b: T) => boolean;
