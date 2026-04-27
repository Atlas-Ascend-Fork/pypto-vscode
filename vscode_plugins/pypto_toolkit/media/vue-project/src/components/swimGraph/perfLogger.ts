let isDebugMode = false;
let totalStartTime = 0;
let transformTime = 0;

export const setDebugMode = (mode: boolean): void => {
  isDebugMode = mode;
};

export const setTotalStartTime = (time: number): void => {
  totalStartTime = time;
};

export const setTransformTime = (time: number): void => {
  transformTime = time;
};

export const isDebugEnabled = (): boolean => {
  return isDebugMode;
};

export const perfLogger = {
  time: (label: string): void => {
    if (!isDebugMode) return;
    console.time(`[Performance] ${label}`);
  },
  timeEnd: (label: string): void => {
    if (!isDebugMode) return;
    console.timeEnd(`[Performance] ${label}`);
  },
  log: (message: string, duration?: number): void => {
    if (!isDebugMode) return;
    if (duration !== undefined) {
      console.log(`[Performance] ${message}: ${duration}ms`);
    } else {
      console.log(`[Performance] ${message}`);
    }
  },
  measure: (label: string, startTime: number): number | undefined => {
    if (!isDebugMode) return;
    const duration = new Date().getTime() - startTime;
    console.log(`[Performance] ${label}: ${duration}ms`);
    return duration;
  },
  getStartTime: (): number => totalStartTime,
  getTransformTime: (): number => transformTime,
};