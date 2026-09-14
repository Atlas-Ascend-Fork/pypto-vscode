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
