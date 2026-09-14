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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
