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

import { LocalModelSource, TYPES } from 'sprotty';
import { ILayoutConfigurator } from 'sprotty-elk';
import { createDiContainer } from './di.config';
import { createMiniMapDiContainer } from './minimap-di.config';
import { comGraphStore } from '../service/com-graph-store';
import type { LayoutConfig, SprottyGraphData } from './types';

export interface SprottyContext {
  modelSource: LocalModelSource;
  miniMapModelSource: LocalModelSource;
  currentData: unknown;
  currentLayoutConfig: LayoutConfig;
  originSprottyGraph: SprottyGraphData | null;
  isColorBySubgraph: boolean;
  renderType: string;
  filePath?: 'before' | 'after';
  // server 由 useViewServer 返回 Proxy 包装器（ExposeViewServer），
  // 其类型与 IComViewServer 完整接口不兼容，此处使用 any 保持与原闭包用法一致
  server: any;
  jsonGraphWatchHandle: any;
  SPROTTY_CONTAINER_ID: string;
  MINIMAP_ID: string;
}

export function createContext(containerId?: string, filePath?: 'before' | 'after'): SprottyContext {
  const SPROTTY_CONTAINER_ID = containerId ?? 'sprotty';
  const renderType = filePath ?? '';
  const MINIMAP_ID = `${renderType}_minimap`;

  const container = createDiContainer(SPROTTY_CONTAINER_ID);
  const minimapContainer = createMiniMapDiContainer(MINIMAP_ID);
  const modelSource = container.get<LocalModelSource>(TYPES.ModelSource);
  const miniMapModelSource = minimapContainer.get<LocalModelSource>(TYPES.ModelSource);

  const currentLayoutConfig: LayoutConfig = {
    direction: 'RIGHT',
    showTensor: true,
    filePath: filePath ?? '',
  };

  const ctx: SprottyContext = {
    modelSource,
    miniMapModelSource,
    currentData: null,
    currentLayoutConfig,
    originSprottyGraph: null,
    isColorBySubgraph: false,
    renderType,
    filePath,
    server: undefined as any,
    jsonGraphWatchHandle: undefined,
    SPROTTY_CONTAINER_ID,
    MINIMAP_ID,
  };

  // Store minimap container reference on context for resetMiniMap
  (ctx as any)._minimapContainer = minimapContainer;

  if (filePath) {
    resetModelSourceInContext(ctx);
  }

  window.colorBySubgraph = false;

  return ctx;
}

function resetModelSourceInContext(ctx: SprottyContext) {
  const container = createDiContainer(ctx.SPROTTY_CONTAINER_ID);
  ctx.modelSource = container.get<LocalModelSource>(TYPES.ModelSource);
  const layoutConfigurator = container.get(
    ILayoutConfigurator,
  ) as import('./di.config').AstgrLayoutConfigurator;
  comGraphStore.setData('layoutDirection', ctx.currentLayoutConfig.direction);
  layoutConfigurator.setLayoutDirection(ctx.currentLayoutConfig.direction);
  layoutConfigurator.setShowTensor(ctx.currentLayoutConfig.showTensor);
  layoutConfigurator.setFilePath(ctx.currentLayoutConfig.filePath);
}
