/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

import { LocalModelSource, TYPES } from 'sprotty';
import { ILayoutConfigurator } from 'sprotty-elk';
import { toRaw, watch } from 'vue';
import { createDiContainer } from './di.config';
import { createMiniMapDiContainer } from './minimap-di.config';
import { comGraphStore } from '../service/com-graph-store';
import { createFitAction } from './fit-action';
import type { SprottyContext } from './context';
import type { UpdateGraphOptions } from './types';

export function useGraphRenderer(ctx: SprottyContext) {
  // Re-export viewport helpers that graph-renderer needs
  const emitMinimapRenderOver = (viewInfo: { zoom: number; scroll: { x: number; y: number } }) => {
    (window as any).ascEventBus.emit(`${ctx.renderType}_render-over`, [
      viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y,
    ]);
  };

  const emitMainMapRenderOver = (viewInfo: { zoom: number; scroll: { x: number; y: number } }) => {
    (window as any).ascEventBus.emit(`${ctx.renderType}_master_render_over`, [
      viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y,
    ]);
  };

  const emitViewerUpdate = (viewInfo: { zoom: number; scroll: { x: number; y: number } }) => {
    (window as any).ascEventBus.emit('viewer_update', {
      model: ctx.modelSource.model,
      zoom: viewInfo.zoom,
      scroll: viewInfo.scroll,
    });
  };

  const syncFitScreenViewport = async () => {
    try {
      const viewInfo = await ctx.modelSource.getViewport();
      (window as any).ascEventBus.emit(`${ctx.renderType}_view_zoom`, [
        viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y, true,
      ]);
      (window as any).ascEventBus.emit('viewer_update', {
        zoom: viewInfo.zoom,
        scroll: { x: viewInfo.scroll.x, y: viewInfo.scroll.y },
      });
    } catch {
      console.error('get model viewport error');
    }
  };

  const fitGraphToScreen = (animate = false) => {
    const fitAction = createFitAction({ maxZoom: 1.0, padding: 50, animate });
    ctx.modelSource.actionDispatcher.dispatch(fitAction).then(() => {
      syncFitScreenViewport();
    });
  };

  /**
   * 同步 minimap 和 main map 的 viewport 信息并触发渲染完成事件
   */
  const syncMinimapAndViewport = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ctx.modelSource.getViewport().then((viewInfo: { zoom: number; scroll: { x: number; y: number } }) => {
          emitMainMapRenderOver(viewInfo);
          emitViewerUpdate(viewInfo);
        });
        ctx.miniMapModelSource.getViewport().then((viewInfo: { zoom: number; scroll: { x: number; y: number } }) => {
          emitMinimapRenderOver(viewInfo);
        });
        (window as any).ascEventBus.emit('layoutEnding', ctx.filePath);
      });
    });
  };

  const renderMinimap = (model?: any) => {
    ctx.miniMapModelSource.updateModel(model || ctx.modelSource.model).then(() => {
      const fitAction = createFitAction({ maxZoom: 1.0, padding: 50, center: true, animate: false });
      ctx.miniMapModelSource.actionDispatcher.dispatch(fitAction).then(() => {
        syncMinimapAndViewport();
      });
    });
  };

  const resetModelSource = (resetHandle?: boolean) => {
    if (resetHandle) {
      ctx.jsonGraphWatchHandle?.stop();
    }
    const container = createDiContainer(ctx.SPROTTY_CONTAINER_ID);
    ctx.modelSource = container.get<LocalModelSource>(TYPES.ModelSource);
    const layoutConfigurator = container.get(
      ILayoutConfigurator,
    ) as import('./di.config').AstgrLayoutConfigurator;
    comGraphStore.setData('layoutDirection', ctx.currentLayoutConfig.direction);
    layoutConfigurator.setLayoutDirection(ctx.currentLayoutConfig.direction);
    layoutConfigurator.setShowTensor(ctx.currentLayoutConfig.showTensor);
    layoutConfigurator.setFilePath(ctx.currentLayoutConfig.filePath);
  };

  const resetMiniMap = () => {
    ctx.jsonGraphWatchHandle?.stop();
    const newContainer = createMiniMapDiContainer(ctx.MINIMAP_ID);
    ctx.miniMapModelSource = newContainer.get<LocalModelSource>(TYPES.ModelSource);
  };

  const setModelDirection = (direction: 'RIGHT' | 'DOWN') => {
    if (ctx.currentLayoutConfig.direction !== direction) {
      ctx.currentLayoutConfig.direction = direction;
      resetModelSource();
      if (ctx.originSprottyGraph) {
        ctx.originSprottyGraph.isFinial = false;
        ctx.modelSource.setModel(ctx.originSprottyGraph as any).then(() => {
          fitGraphToScreen();
          renderMinimap(ctx.modelSource.model);
        });
      }
    }
  };

  /**
   * 统计图中节点和边的数量
   */
  const countNodesAndEdges = (sprottyGraph: any): { nodeCount: number; edgeCount: number } => {
    const nodeCount = sprottyGraph.children?.filter((child: { type: string | string[] }) =>
      child.type.includes('node'),
    ).length || 0;
    const edgeCount = sprottyGraph.children?.filter((child: { type: string | string[] }) =>
      child.type.includes('edge'),
    ).length || 0;
    return { nodeCount, edgeCount };
  };

  /**
   * 处理模型设置成功后的逻辑
   */
  const handleModelSetSuccess = async (
    sprottyGraph: any,
    nodeMagic: any,
    searchLevel: any,
    isThreeMode: boolean,
  ) => {
    if (ctx.modelSource.model) {
      if (!sprottyGraph.isFinial && !nodeMagic) {
        ctx.server.setFinalResult({
          data: ctx.modelSource.model,
          layout: ctx.currentLayoutConfig,
          threeMode: isThreeMode,
        });
      }
      if ((searchLevel !== undefined) && (searchLevel > -1)) {
        resetMiniMap();
        renderMinimap(ctx.modelSource.model);
      } else {
        renderMinimap(ctx.modelSource.model);
      }
    }
    if (!sprottyGraph.children) return;
    fitGraphToScreen();
  };

  const updateGraph = (isDark: boolean, option?: UpdateGraphOptions) => {
    if (!ctx.currentData) return;

    const showTensorNodes = option?.showTensorNodes ?? true;
    const showSyncNodes = option?.showSyncNodes ?? false;
    const selectedSubgraphId = option?.subgraphFilterSelect;
    const isThreeMode = option?.isThreeMode ?? false;
    if (option?.showTensorNodes !== undefined) {
      ctx.currentLayoutConfig.showTensor = showTensorNodes;
      resetModelSource(true);
    }

    let nodeMagic: any;
    let searchLevel: any;
    if (option?.openMode === 'path') {
      nodeMagic = option?.nodeMagic;
      searchLevel = option?.searchLevel;
      if (searchLevel > -2) {
        resetModelSource(true);
      }
    }
    const data = {
      layout: ctx.currentLayoutConfig,
      comGraphData: JSON.parse(JSON.stringify(comGraphStore.data)),
      filePath: ctx.filePath,
      currentData: ctx.currentData,
      showTensorNodes,
      showSyncNodes,
      colorBySubgraph: ctx.isColorBySubgraph,
      isDark,
      selectedSubgraphId,
      nodeMagic,
      searchLevel,
      version: comGraphStore.data.version,
      threeMode: isThreeMode,
    };
    ctx.server.getJsonGraphData({ data, diffType: ctx.filePath });
    ctx.jsonGraphWatchHandle = watch(ctx.server.JsonGraphData, (newValue: any) => {
      comGraphStore.setData('isCached', newValue.isCached);
      comGraphStore.setData('wrongRawMagicList', newValue.wrongRawMagicList);
      comGraphStore.setData('failOpMagicList', newValue.failOpMagicList);
      comGraphStore.setData('failMagicList', newValue.failMagicList);
      if (!ctx.filePath || ctx.filePath === newValue.data.filePath) {
        (window as any).ascEventBus.emit('comGraphRendering', 'rendering');
        const sprottyGraph = toRaw(newValue.data);
        sprottyGraph['renderMode'] = option?.openMode || 'all';

        ctx.originSprottyGraph = JSON.parse(JSON.stringify(sprottyGraph));

        const { nodeCount, edgeCount } = countNodesAndEdges(sprottyGraph);
        console.log(`Graph stats: ${nodeCount} nodes, ${edgeCount} edges`);
        ctx.modelSource
          .setModel(sprottyGraph)
          .then(async () => {
            await handleModelSetSuccess(sprottyGraph, nodeMagic, searchLevel, isThreeMode);
          })
          .catch((error: any) => {
            console.error('Error setting model:', error);
          });
      }
    });
  };

  const initComDocText = (
    jsonData: Object,
    isDark = true,
    openMode: string,
    nodeMagic: number,
    searchLevel = -1,
    isThreeMode = false,
  ) => {
    try {
      ctx.currentData = jsonData;
      updateGraph(isDark, { openMode, searchLevel, nodeMagic, isThreeMode });
    } catch (e) {
      console.error('Error parsing JSON or building graph:', e);
      const containerDiv = document.getElementById(ctx.SPROTTY_CONTAINER_ID);
      if (containerDiv) containerDiv.innerHTML = `<p style="color:red;">Error rendering graph: ${e}</p>`;
    }
  };

  return {
    updateGraph,
    renderMinimap,
    resetModelSource,
    resetMiniMap,
    setModelDirection,
    initComDocText,
  };
}
