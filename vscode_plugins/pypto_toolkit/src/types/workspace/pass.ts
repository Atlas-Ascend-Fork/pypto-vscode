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
