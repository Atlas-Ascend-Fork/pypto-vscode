/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
