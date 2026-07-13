/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
