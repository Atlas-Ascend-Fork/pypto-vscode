/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
export const enum PassStage {
  TENSOR_GRAPH = 'tensor',
  TILE_GRAPH = 'tile',
  BLOCK_GRAPH = 'block',
}

/**
 * 标记各阶段结束的Pass名称
 * [名称, 下一阶段]
 */
export const StageEndPassNames: Record<PassStage, [string, PassStage]> = {
  [PassStage.TENSOR_GRAPH]: ['ExpandFunction', PassStage.TILE_GRAPH],
  [PassStage.TILE_GRAPH]: ['SubgraphToFunction', PassStage.BLOCK_GRAPH],
  // 最后一个阶段指向自己，避免判断异常跳转到空阶段
  [PassStage.BLOCK_GRAPH]: ['', PassStage.BLOCK_GRAPH],
};
