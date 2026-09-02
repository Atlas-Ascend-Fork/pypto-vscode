/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

export interface LayoutConfig {
  direction: 'RIGHT' | 'DOWN';
  showTensor: boolean;
  filePath: string;
}

export interface UpdateGraphOptions {
  openMode?: any;
  nodeMagic?: any;
  searchLevel?: number;
  isThreeMode?: any;
  showTensorNodes?: any;
  showSyncNodes?: any;
  subgraphFilterSelect?: any;
}

export interface SprottyGraphData {
  isFinial: boolean;
  [key: string]: any;
}

export interface HotKeyEvent {
  nodeId: string;
  eventKey: 'ArrowLeft' | 'ArrowRight';
}

export interface SubGraphEvent {
  selectedNode: {
    calleehash: string;
    magic?: string;
    children?: unknown[];
  };
}

export interface EventBinding {
  event: string;
  handler: (...args: any[]) => void;
}
