/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
