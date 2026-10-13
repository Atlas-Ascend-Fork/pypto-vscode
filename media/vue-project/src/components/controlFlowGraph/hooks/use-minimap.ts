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
import { Graph, MinimapOptions } from '@antv/g6';
import { Component, computed, h, Ref, ref } from 'vue';

/** 缩略图宽度 */
const MINIMAP_WIDTH = 260;

/** 缩略图高度 */
const MINIMAP_HEIGHT = 160;

/** 缩略图边距 */
const MINIMAP_PADDING = 10;

/** 缩略图 */
export function useMinimap(graph: Ref<Graph>, offsetRight: Ref<number> = ref(0)) {
  const minimapRef = ref<HTMLElement | null>(null);
  /** 缩略图容器 */
  const MinimapContainer: Component = () =>
    h('div', {
      ref: minimapRef,
      style: {
        width: `${MINIMAP_WIDTH}px`,
        height: `${MINIMAP_HEIGHT}px`,
        '--minimap-offset-right':`${offsetRight.value}px`
      },
      onClick: handleClickMinimap,
      class:'minimap-container'
    });

  /** G6缩略图插件配置 */
  const minimapPluginOptions = computed<MinimapOptions>(() => {
    return {
      type: 'minimap',
      key: 'my-minimap',
      size: [MINIMAP_WIDTH, MINIMAP_HEIGHT],
      padding: MINIMAP_PADDING,
      container: minimapRef.value,
      maskStyle: {
        border: '1px solid rgba(49,122,247,0.51)',
      },
    };
  });

  let isMoving = false;
  async function handleClickMinimap({ offsetX, offsetY, target }: MouseEvent) {
    if (isMoving || !isMinimapCanvas(target)) {
      return;
    }
    isMoving = true;
    const [graphX, graphY] = getGraphPointByMinimap([offsetX, offsetY], graph.value);
    const [centerX, centerY] = graph.value.getViewportCenter();
    const zoom = graph.value.getZoom();
    await graph.value.translateBy([-(graphX - centerX) * zoom, -(graphY - centerY) * zoom]);
    isMoving = false;
  }

  function isMinimapCanvas(target: unknown): target is HTMLCanvasElement {
    return target instanceof HTMLCanvasElement && target.parentElement === minimapRef.value;
  }

  return { minimapPluginOptions, MinimapContainer };
}

/**
 * 获取缩略图点击对应的大图坐标
 * @param param0
 * @param graph
 * @returns
 */
function getGraphPointByMinimap([x, y]: [number, number], graph: Graph): [number, number] {
  const { scale, paddingX, paddingY } = getScaleAndPaddings(graph);
  return [x * scale - paddingX, y * scale - paddingY];
}

/**
 * 获取缩略图和大图的缩放比例及四边距离
 * @param graph
 * @returns
 */
function getScaleAndPaddings(graph: Graph) {
  const minimapWidth = MINIMAP_WIDTH - MINIMAP_PADDING * 2;
  const minimapHeight = MINIMAP_HEIGHT - MINIMAP_PADDING * 2;
  const [graphWidth, graphHeight] = getGraphSize(graph);
  const scaleX = graphWidth / minimapWidth;
  const scaleY = graphHeight / minimapHeight;

  /** 缩放比例：缩略图需要宽高都不溢出，取宽高中差异较大的一方 */
  const graphScale = Math.max(scaleX, scaleY);

  let paddingX = MINIMAP_PADDING * graphScale;
  let paddingY = MINIMAP_PADDING * graphScale;
  // 边距增加缩略图等比填充后的空白区域
  if (scaleX < scaleY) {
    paddingX += (minimapWidth * graphScale - graphWidth) / 2;
  } else {
    paddingY += (minimapHeight * graphScale - graphHeight) / 2;
  }

  return { scale: graphScale, paddingX, paddingY };
}

/**
 * 获取整张图尺寸
 * @param graph
 * @returns
 */
function getGraphSize(graph: Graph) {
  const {
    min: [minX, minY],
    max: [maxX, maxY],
  } = graph.getCanvas().getBounds('elements');
  return [maxX - minX, maxY - minY];
}
