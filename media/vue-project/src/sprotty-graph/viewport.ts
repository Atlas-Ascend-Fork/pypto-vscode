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

import { LocalModelSource } from 'sprotty';
import { SetViewportAction, SelectAction } from 'sprotty-protocol';
import { createFitAction } from './fit-action';
import type { SprottyContext } from './context';

export function useViewport(ctx: SprottyContext) {
  const fitGraphToScreen = (animate = false) => {
    const fitAction = createFitAction({ maxZoom: 1.0, padding: 50, animate });
    ctx.modelSource.actionDispatcher.dispatch(fitAction).then(() => {
      syncFitScreenViewport();
    });
  };

  const fitToScreenAction = async () => {
    const selectedElements = (await ctx.modelSource.getSelection()).map((e: { id: string }) => e.id) as string[];
    if (selectedElements.length > 0) {
      ctx.modelSource.actionDispatcher.dispatch(
        SelectAction.create({ selectedElementsIDs: [], deselectedElementsIDs: selectedElements }),
      );
    }
    fitGraphToScreen(true);
  };

  const setViewportAction = async (rootId: string, x: number, y: number, zoomPara: number, animatePara?: boolean) => {
    const newViewport = { scroll: { x, y }, zoom: zoomPara };
    ctx.modelSource.actionDispatcher.dispatch(
      SetViewportAction.create(rootId, newViewport, { animate: animatePara }),
    );
  };

  const setMinimapViewportAction = async (x: number, y: number, zoomPara: number, animatePara?: boolean) => {
    const newViewport = { scroll: { x, y }, zoom: zoomPara };
    ctx.miniMapModelSource.actionDispatcher.dispatch(
      SetViewportAction.create(ctx.miniMapModelSource.model.id, newViewport, { animate: animatePara }),
    );
  };

  // Internal helpers

  function emitMinimapRenderOver(viewInfo: { zoom: number; scroll: { x: number; y: number } }) {
    (window as any).ascEventBus.emit(`${ctx.renderType}_render-over`, [
      viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y,
    ]);
  }

  function emitMainMapRenderOver(viewInfo: { zoom: number; scroll: { x: number; y: number } }) {
    (window as any).ascEventBus.emit(`${ctx.renderType}_master_render_over`, [
      viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y,
    ]);
  }

  async function syncWheelViewport(zoom: number, x = 0, y = 0) {
    try {
      const viewInfo = await ctx.modelSource.getViewport();
      if (!x && !y) {
        x = viewInfo.scroll.x * (viewInfo.zoom / zoom);
        y = viewInfo.scroll.y * (viewInfo.zoom / zoom);
      }
      (window as any).ascEventBus.emit('viewer_update', {
        zoom,
        scroll: { x, y },
      });
      setViewportAction(ctx.modelSource.model.id, x, y, zoom, false);
      (window as any).ascEventBus.emit('minimap-wheel', [zoom, x, y, ctx.renderType]);
      (window as any).ascEventBus.emit(`${ctx.renderType}_view_zoom`, [zoom, x, y, false]);
    } catch {
      console.error('get model viewport error');
    }
  }

  async function syncFitScreenViewport() {
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
  }

  return {
    fitGraphToScreen,
    fitToScreenAction,
    setViewportAction,
    setMinimapViewportAction,
    emitMinimapRenderOver,
    emitMainMapRenderOver,
    syncWheelViewport,
    syncFitScreenViewport,
  };
}
