import type { Ref } from 'vue';

export interface ComGraphContext {
  toggleHealthReport: (status: boolean) => void;
  showLayerControl: Ref<boolean>;
}

export enum GraphType {
  TENSOR_GRAPH,
  TILE_GRAPH,
  EXECUTE_GRAPH,
  BLOCK_GRAPH,
  LEAF_VF_GRAPH,
  INVALID,
}