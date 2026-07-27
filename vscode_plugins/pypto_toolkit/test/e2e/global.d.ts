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
