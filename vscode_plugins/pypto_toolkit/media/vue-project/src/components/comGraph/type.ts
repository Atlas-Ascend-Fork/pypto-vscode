import type { InjectionKey, Ref } from 'vue';

export interface ComGraphContext {
  toggleHealthReport: (status: boolean) => void;
  toggleMemoryAllocation: (status: boolean) => void;
  toggleLeafCalledRecord: (status: boolean, leafName: string) => void;
  updateRunningNode: (id: number | string) => void;
  showLayerControl: Ref<boolean>;
  showMemoryAllocation: Ref<boolean>;
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

export interface DrillDownPathItem {
  calleehash: string;
  subFuncmagicname: string;
}
export enum TabName {
  healthReport = 'healthReport',
  precisionReport = 'precisionReport',
}
export enum GraphName {
  TensorGraph = 'TensorGraph',
  TileGraph = 'TileGraph',
  ExecuteGraph = 'ExecuteGraph',
  BlockGraph = 'BlockGraph',
}
export interface ComGraphReportContext {
  jsonData: Ref<Record<string, any>>;
  graphName: Ref<GraphName>;
  rootEmits: (event: 'update:modelValue' | 'onLocate' | 'open' | 'locateSubgraph', ...args: any[]) => void;
}
export const ComGraphReportProvideKey = 'com-graph-report' as unknown as InjectionKey<ComGraphReportContext>;
