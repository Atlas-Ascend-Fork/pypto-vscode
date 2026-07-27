/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
export type ChipGridShape = 'square' | 'circle' | 'hexagon' | string;

export type ChipNodeKind = 'memory' | 'container' | 'compute' | 'cache' | 'hidden' | string;

export type ChipNodeComponent = 'gridNode' | 'vectorNode' | 'gmNode' | 'l2Node' | string;

export type ChipHandleEdge = 'top' | 'bottom' | 'left' | 'right';

export type ChipHandleType = 'source' | 'target';

export interface ChipPoint {
  x: number;
  y: number;
}

export interface ChipSize {
  width: number;
  height: number;
}

export interface ChipGrid {
  rows: number;
  cols: number;
  shape: ChipGridShape;
  unitKB: number;
}

export interface ChipHandle {
  id: string;
  type?: ChipHandleType;
  edge: ChipHandleEdge;
  pct: number | string;
}

export interface ChipLegendItem {
  shape: ChipGridShape;
  label: string;
  unitKB: number;
  styleToken: string;
}

export interface ChipNode {
  id: string;
  kind: ChipNodeKind;
  component: ChipNodeComponent;
  label: string;
  memType?: string;
  parentId?: string;
  position?: ChipPoint;
  size?: ChipSize;
  grid?: ChipGrid;
  styleToken?: string;
  showHeader?: boolean;
  showStats?: boolean;
  splitType?: 'horizontal' | 'vertical' | string;
  visibility?: 'visible' | 'hidden';
  handles?: ChipHandle[];
  splitChildren?: ChipNode[];
  initialFilledCount?: number;
  data?: Record<string, unknown>;
}

export interface ChipEdgeAnimation {
  enabled: boolean;
  pipeTypes?: string[];
}

export interface ChipEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  path?: string;
  label?: string;
  styleToken?: string;
  dash?: boolean;
  doubleArrow?: boolean;
  labelX?: number;
  labelY?: number;
  labelWidth?: number;
  labelHeight?: number;
  borderRadius?: number;
  markerEnd?: string | false;
  waypoints?: ChipPoint[];
  animation?: ChipEdgeAnimation;
}

export interface ChipConfig {
  schemaVersion: string;
  chip: {
    model?: string;
    arch: string;
    displayName: string;
    description?: string;
  };
  canvas?: {
    width: number;
    height: number;
    coordinateSystem?: string;
  };
  legend: ChipLegendItem[];
  memoryTypeMap: Record<string, string>;
  memoryCapacityBytes: Record<string, number>;
  nodes: ChipNode[];
  edges: ChipEdge[];
  fallbacks?: Record<string, unknown>;
}

export interface ChipConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SelectedChipConfig {
  config: ChipConfig;
  isFallback: boolean;
  warning?: string;
  validation: ChipConfigValidationResult;
}
