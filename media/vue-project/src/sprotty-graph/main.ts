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

import 'reflect-metadata';
import { createContext } from './context';
import { useViewport } from './viewport';
import { useGraphRenderer } from './graph-renderer';
import { useNodeActions } from './node-actions';
import { useEventBinder } from './event-binder';
import { UpdateModelAction } from 'sprotty-protocol';
import type { EventBinding } from './types';
import { comGraphStore } from '../service/com-graph-store';
import { useViewServer } from '../core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';

// VSCode webview 全局变量，由 webview HTML 注入，无法避免
declare const vscode: any;

const { server } = useViewServer<IComViewServer>();

export function useSprottyLoad(containerId?: string, filePath?: 'before' | 'after') {
  const ctx = createContext(containerId, filePath);
  ctx.server = server;

  const viewport = useViewport(ctx);
  const renderer = useGraphRenderer(ctx);
  const nodeActions = useNodeActions(ctx);

  const bindings: EventBinding[] = [
    { event: `${ctx.renderType}_minimap_rect_move`, handler: (args: number[]) => viewport.setViewportAction(ctx.modelSource.model.id, args[0], args[1], args[2], false) },
    { event: 'minimap_center', handler: (args: number[]) => viewport.setMinimapViewportAction(args[0], args[1], args[2], false) },
    { event: `${ctx.renderType}_mainmap_wheel`, handler: (args: number) => viewport.syncWheelViewport(args) },
    { event: `${ctx.renderType}_mainmap_fitscreen`, handler: () => viewport.fitToScreenAction() },
    { event: 'svgOutput', handler: (args: boolean) => nodeActions.requestExportSvgAction(args) },
    { event: 'jump2SiblingNode', handler: (args: string) => nodeActions.jump2SiblingNodeListener(args) },
    { event: 'SearchModeOpen', handler: (args: number) => nodeActions.searchModeOpenListener(args) },
    { event: 'OpenSubGraphInThreeColumn', handler: (params: any) => nodeActions.openSubGraphInThreeColumn(params) },
    { event: 'jump2SiblingNodeByHotKey', handler: (args: any) => nodeActions.jump2SiblingNodeByHotKeyListener(args) },
  ];

  const eventBinder = useEventBinder(bindings);
  eventBinder.registerAll();

  comGraphStore.setData('centerNodeActionFunc', nodeActions.centerNodeAction);
  comGraphStore.setData('renderMinimapFunc', renderer.renderMinimap);
  comGraphStore.setData('updateModelActionFunc', nodeActions.updateModelAction);

  const colorBySubGraph = (colorBySubgraph: boolean) => {
    window.colorBySubgraph = colorBySubgraph;
    ctx.isColorBySubgraph = colorBySubgraph;
    ctx.modelSource.actionDispatcher.dispatch(
      UpdateModelAction.create(ctx.modelSource.model, { animate: false }),
    );
  };

  vscode.postMessage({ type: 'webviewReady' });

  return {
    fitToScreenAction: viewport.fitToScreenAction,
    initComDocText: renderer.initComDocText,
    colorBySubGraph,
    centerNodeAction: nodeActions.centerNodeAction,
    selectAction: nodeActions.selectAction,
    setViewportAction: viewport.setViewportAction,
    updateGraph: renderer.updateGraph,
    getSelectedNodeId: nodeActions.getSelectedNodeId,
    setModelDirection: renderer.setModelDirection,
    syncDiffView: nodeActions.syncDiffView,
    createSelectNodesRect: nodeActions.createSelectNodesRect,
    removeSelectNodesRect: nodeActions.removeSelectNodesRect,
    resetModelSource: renderer.resetModelSource,
    hoverFeedbackAction: nodeActions.hoverFeedbackAction,
    updateDiffViewport: nodeActions.updateDiffViewport,
    getModelSourceChildren: nodeActions.getModelSourceChildren,
    removeEventListeners: eventBinder.removeAll,
    updateModelAction: nodeActions.updateModelAction,
  };
}
