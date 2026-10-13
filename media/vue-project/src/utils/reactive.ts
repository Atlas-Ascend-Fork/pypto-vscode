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
import { toRaw } from 'vue';

/**
 * 递归去除所有vue响应式生成的proxy
 * @param maybeProxy 输入
 * @param visitedObjects 递归过程中已访问的对象和数组
 */
export function deepToRaw<T>(maybeProxy: T, visitedObjects = new WeakSet<any>()): T {
  const raw = toRaw(maybeProxy);

  // 循环依赖
  if (visitedObjects.has(raw)) {
    return raw;
  }

  // 数组
  if (Array.isArray(raw)) {
    visitedObjects.add(raw);
    raw.forEach((item, index) => {
      raw[index] = deepToRaw(item, visitedObjects);
    });
    return raw;
  }

  // 对象
  if (raw instanceof Date || raw === null) {
    return raw;
  } else if (typeof raw === 'object') {
    visitedObjects.add(raw);
    const keys = Object.keys(raw);
    for (const key of keys) {
      raw[key] = deepToRaw(raw[key], visitedObjects);
    }
    return raw;
  }

  // 其他
  return raw;
}
