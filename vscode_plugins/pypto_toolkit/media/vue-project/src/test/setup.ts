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
