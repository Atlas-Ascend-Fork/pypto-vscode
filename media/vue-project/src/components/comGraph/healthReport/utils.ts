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
import type { ItemData } from './types';

export function formatData(data) {
  return Array.isArray(data) ? data.length : data;
}

export function formateNum(num: number) {
  if (num === 0) {
    return num;
  } else {
    return num.toFixed(1) + '%';
  }
}

export function arrChange(arr: number[], len: number) {
  const newArr: ItemData[][] = [];
  while (arr.length > 0) {
    newArr.push(arr.splice(0, len).map((item) => ({ label: item })));
  }
  return newArr;
}
