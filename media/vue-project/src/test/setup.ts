/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { vi } from 'vitest';

const vscodeApi = {
  getState: vi.fn(() => undefined),
  postMessage: vi.fn(),
  setState: vi.fn(),
};

Object.defineProperty(window, 'vscode', {
  configurable: true,
  value: vscodeApi,
});
vi.stubGlobal('acquireVsCodeApi', () => vscodeApi);

const canvasContext = {
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  lineTo: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
  moveTo: vi.fn(),
  stroke: vi.fn(),
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: vi.fn(() => canvasContext),
});

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle));
