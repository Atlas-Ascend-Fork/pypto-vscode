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

export interface CacheKeyOptions {
  hasParent?: boolean;
  direction?: string;
  showTensor?: boolean;
  filePath?: string;
  threeMode?: boolean;
}

/**
 * 构建布局缓存 Key。
 * 消除原 baseGraphMsgHandler.ts 中 4 处重复的拼接逻辑。
 *
 * 拼接规则（按顺序）：
 * 1. 若 hasParent → 追加 '_hasParent'
 * 2. 若 direction === 'DOWN' → 追加 '_down'
 * 3. 若 !showTensor → 追加 '_notshowtensor'
 * 4. 追加 filePath（或空字符串）
 * 5. 若 threeMode → 追加 '_threeMode'
 */
export function buildLayoutCacheKey(baseHash: string, opts: CacheKeyOptions): string {
  let key = baseHash;
  if (opts.hasParent) key += '_hasParent';
  if (opts.direction === 'DOWN') key += '_down';
  if (!opts.showTensor) key += '_notshowtensor';
  key += opts.filePath || '';
  if (opts.threeMode) key += '_threeMode';
  return key;
}
