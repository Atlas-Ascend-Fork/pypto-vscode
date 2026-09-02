/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
