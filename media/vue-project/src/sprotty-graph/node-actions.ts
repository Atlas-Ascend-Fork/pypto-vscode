/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

import { SModelRootImpl, SCompartmentImpl } from 'sprotty';
import { SelectAction, CenterAction, SetViewportAction, UpdateModelAction, HoverFeedbackAction } from 'sprotty-protocol';
import { findDestNode, findNeighborNode } from './menu';
import { createSvg } from './svgExport';
import { findNodeIdsBySemanticLabel } from '../utils/search';
import { comGraphStore } from '../service/com-graph-store';
import { cancelRectAnimation, startRectAnimation } from './animation';
import { createFitAction } from './fit-action';
import type { SprottyContext } from './context';
import type { HotKeyEvent, SubGraphEvent } from './types';

export function useNodeActions(ctx: SprottyContext) {
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

  /**
   * 检查节点是否在当前视图中可见
   */
  const checkNodeVisible = (nodeIds: string[]): boolean => {
    return !!(ctx.modelSource as any).currentRoot?.children.find(
      (t: { id: string }) => nodeIds.includes(t.id),
    );
  };

  /**
   * 执行节点居中动作并同步视图
   */
  const executeCenterAction = async (selectedElements: string[], options: any) => {
    ctx.modelSource.actionDispatcher.dispatch(CenterAction.create(selectedElements, options)).then(() => {
      syncFitScreenViewport();
      ctx.modelSource.getViewport().then((viewInfo: { zoom: number; scroll: { x: number; y: number } }) => {
        (window as any).ascEventBus.emit('viewer_update', {
          model: ctx.modelSource.model,
          zoom: viewInfo.zoom,
          scroll: viewInfo.scroll,
        });
      });
    });
  };

  const centerNodeAction = async (
    elementIdsPara: string[],
    animatePara?: boolean,
    retainZoomPara?: boolean,
    zoomScalePara?: number,
  ) => {
    const selectedElements = elementIdsPara.length
      ? elementIdsPara
      : ((await ctx.modelSource.getSelection()).map((e: { id: string }) => e.id) as string[]);
    if (selectedElements.length === 0) return;

    if (!checkNodeVisible(selectedElements)) {
      (window as any).ascEventBus.emit('node_hidden_message_notice', 'comGraph.searchingNodeUntraced');
      return;
    }

    const options = {
      animate: animatePara,
      retainZoom: retainZoomPara,
      zoomScale: zoomScalePara,
    };
    await executeCenterAction(selectedElements, options);
  };

  const selectAction = async (elementIdsPara: string[]) => {
    const selectedIds = (await ctx.modelSource.getSelection()).map((e: { id: string }) => e.id) as string[];
    const selectAction: SelectAction = {
      kind: 'elementSelected',
      selectedElementsIDs: elementIdsPara,
      deselectedElementsIDs: selectedIds ?? [],
    };
    ctx.modelSource.actionDispatcher.dispatch(selectAction);
  };

  const getSelectedNodeId = async () => {
    const node = await ctx.modelSource.getSelection();
    if (Array.from(node).length > 0) {
      return Array.from(node)[0].id;
    }
    return;
  };

  const createSelectNodesRect = async (semanticLabel: string, isLocate: boolean) => {
    const selectedNodes = findNodeIdsBySemanticLabel(ctx.currentData as Object, semanticLabel);
    if (selectedNodes.length <= 0) {
      removeSelectNodesRect();
      return;
    }

    if (comGraphStore.data.selectedNodeSemanticLabel !== semanticLabel) {
      const modelRoot = (ctx.modelSource as any).currentRoot;
      (ctx.modelSource.model as any).notNeedLayout = true;

      ctx.modelSource.removeElements([{ elementId: 'show-node-rect', parentId: modelRoot.id }]);
      comGraphStore.data.selectedNodeSemanticLabel = semanticLabel;
      const newRect = {
        id: 'show-node-rect',
        type: 'rect',
        position: { x: 0, y: 0 },
        size: { width: 120, height: 80 },
        customSize: { width: 0, height: 0 },
        selectedNodes,
        needCalPostion: true,
      };
      // 挂载到 root children 末尾（append 即最后渲染），保证高亮框不被节点遮挡；
      // 不依赖图数据自身的 children 顺序（布局缓存中的旧图顺序可能未更新）
      await ctx.modelSource.addElements([{ element: newRect, parentId: modelRoot.id }]);
    }
    const fitAction = createFitAction({ maxZoom: 2.0, padding: 50, elementIds: selectedNodes, animate: false });
    isLocate && ctx.modelSource.actionDispatcher.dispatch(fitAction).then(() => {
      syncFitScreenViewport();
    });

    startRectAnimation(ctx.modelSource);
  };

  const removeSelectNodesRect = async () => {
    cancelRectAnimation();
    comGraphStore.data.stableRect = false;
    comGraphStore.data.selectedNodeSemanticLabel = '';
    const modelRoot = (ctx.modelSource as any).currentRoot;
    if (modelRoot?.children?.some((t: { id: string }) => t.id === 'show-node-rect')) {
      await ctx.modelSource.removeElements([{ elementId: 'show-node-rect', parentId: modelRoot.id }]);
    }
  };

  const jump2SiblingNodeListener = (nodeId: string) => {
    centerNodeAction([nodeId]);
    selectAction([nodeId]);
  };

  /**
   * 根据事件键获取按钮位置和目标节点
   */
  const getButtonPosAndDestNode = (
    eventKey: string,
    previousNodeId: string,
    nextNodeId: string,
  ): { buttonPos: string; destNode: string } => {
    const isLeft = eventKey === 'ArrowLeft';
    return {
      buttonPos: isLeft ? 'left' : 'right',
      destNode: isLeft ? previousNodeId : nextNodeId,
    };
  };

  const jump2SiblingNodeByHotKeyListener = (event: HotKeyEvent) => {
    const selectedNodeId = event.nodeId;
    const eventKey = event.eventKey;
    const [previousNodeId, nextNodeId] = findNeighborNode(
      selectedNodeId,
      (ctx.modelSource as any).currentRoot as unknown as Readonly<SModelRootImpl>,
    );

    const { buttonPos, destNode } = getButtonPosAndDestNode(eventKey, previousNodeId, nextNodeId);
    const newNodeId = findDestNode(selectedNodeId, buttonPos, destNode);

    if (newNodeId === '') {
      return;
    }
    (window as any).ascEventBus.emit('jump2SiblingNode', newNodeId);
  };

  const searchModeOpenListener = (nodeMagic: number) => {
    const data = {
      nodeMagic,
      funcHash: typeof comGraphStore.data.curPath === 'string'
        ? JSON.parse(comGraphStore.data.curPath).at(-1)
        : comGraphStore.data.curPath[0],
    };
    ctx.server.openSearchMode({ data });
  };

  const openSubGraphInThreeColumn = (params: SubGraphEvent) => {
    const funcName = comGraphStore.data.calleeMap[params.selectedNode.calleehash];
    const newPath = [
      ...(typeof comGraphStore.data.curPath === 'string'
        ? JSON.parse(comGraphStore.data.curPath)
        : comGraphStore.data.curPath),
    ];
    newPath.push(params.selectedNode.calleehash);
    const curPathList = JSON.stringify(newPath);
    const first = params.selectedNode.children?.[0] as unknown as SCompartmentImpl;
    const calleeOpSubgraphId = (first as any).subgraphId;
    ctx.server.getSubgraph({
      paramObj: {
        calleehash: params.selectedNode.calleehash,
        subFuncmagicname: funcName.func_magicname,
        curPath: curPathList,
        calleeOpMagic: params.selectedNode.magic,
        calleeOpSubgraphId: calleeOpSubgraphId,
      },
      query: { isSearch: false, nodeMagic: null },
    });
  };

  /**
   * 获取 SVG 容器，如果不存在则返回 null
   */
  const getSvgContainer = (): SVGSVGElement | null => {
    return document.getElementById('sprotty')?.querySelector('svg') || null;
  };

  const requestExportSvgAction = async (copyStyles?: boolean) => {
    const originViewInfo = await ctx.modelSource.getViewport();
    const x: number = originViewInfo.scroll.x;
    const y: number = originViewInfo.scroll.y;
    const svgViewport = {
      scroll: { x, y },
      zoom: 1.0,
    };
    const viewOptions = { animate: false };

    await ctx.modelSource.actionDispatcher.dispatch(
      SetViewportAction.create(ctx.modelSource.model.id, svgViewport, viewOptions),
    );

    // 等待 SetViewport 动画完成后再截取 SVG
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    await delay(1000);

    const svgContainer = getSvgContainer();
    if (!svgContainer) {
      console.warn('SVG element not found in #sprotty container');
      return;
    }

    createSvg(svgContainer, copyStyles);

    await ctx.modelSource.actionDispatcher.dispatch(
      SetViewportAction.create(ctx.modelSource.model.id, originViewInfo, viewOptions),
    );
  };

  const hoverFeedbackAction = () => {
    ctx.modelSource.actionDispatcher.dispatch(
      HoverFeedbackAction.create({ mouseIsOver: true, mouseoverElement: 'root' }),
    );
  };

  const updateModelAction = async (animate?: boolean, cause?: boolean) => {
    ctx.modelSource.actionDispatcher.dispatch(
      UpdateModelAction.create((ctx.modelSource as any).currentRoot, { animate, cause: cause as any }),
    );
  };

  const syncDiffView = (args: number[]) => {
    // Re-use setViewportAction logic inline since it's in viewport module
    const [x, y, zoom] = args;
    ctx.modelSource.actionDispatcher.dispatch(
      SetViewportAction.create(
        ctx.modelSource.model.id,
        { scroll: { x, y }, zoom },
        { animate: false },
      ),
    );
  };

  const updateDiffViewport = async () => {
    syncFitScreenViewport();
  };

  const getModelSourceChildren = () => {
    return ctx.modelSource.model.children ?? [];
  };

  return {
    centerNodeAction,
    selectAction,
    getSelectedNodeId,
    createSelectNodesRect,
    removeSelectNodesRect,
    jump2SiblingNodeListener,
    jump2SiblingNodeByHotKeyListener,
    searchModeOpenListener,
    openSubGraphInThreeColumn,
    requestExportSvgAction,
    hoverFeedbackAction,
    updateModelAction,
    syncDiffView,
    updateDiffViewport,
    getModelSourceChildren,
  };
}
