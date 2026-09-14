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