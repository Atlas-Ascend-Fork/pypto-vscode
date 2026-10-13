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
interface CanvasTextTraceEntry {
  fillStyle: string;
  parentClass: string;
  rotated: boolean;
  text: string;
  timestamp: number;
  x: number;
  y: number;
}

interface CanvasPathTraceEntry {
  canvasWidth: number;
  canvasHeight: number;
  color: string;
  points: Array<{ x: number; y: number }>;
}

interface MockVsCodeApi {
  getState: () => null;
  postMessage: (message: unknown) => void;
  setState: () => void;
}

interface Window {
  __canvasPathTrace: CanvasPathTraceEntry[];
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
