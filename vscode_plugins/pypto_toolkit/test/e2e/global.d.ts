/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
interface CanvasTextTraceEntry {
  fillStyle: string;
  parentClass: string;
  rotated: boolean;
  text: string;
  timestamp: number;
  x: number;
  y: number;
}

interface MockVsCodeApi {
  getState: () => null;
  postMessage: (message: unknown) => void;
  setState: () => void;
}

interface Window {
  __canvasTextTrace: CanvasTextTraceEntry[];
  __gmMemoryPerformance?: {
    fingerprint: Record<string, unknown>;
    longTasks: Array<{ duration: number; startTime: number }>;
    marks: Record<string, number>;
    stages: Record<string, number>;
  };
  __vscodeMessages: unknown[];
  acquireVsCodeApi: () => MockVsCodeApi;
}
