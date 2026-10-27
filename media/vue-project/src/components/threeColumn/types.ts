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
import { InjectionKey, Ref } from 'vue';

export interface ILayoutInfo {
  showLeft?: boolean;
  showRight?: boolean;
  showBottomLeft?: boolean;
  showBottomRight?: boolean;
  currentWidth?: string;
  currentHeight?: string;
  currentHeightRight?: string;
}
export type LayoutMode = 'triangular' | 'threeColumn';
export type BlockType = 'left' | 'right' | 'bottomLeft' | 'bottomRight' | '';
export type GraphType = 'editor' | 'comGraph' | 'swimGraph' | 'extra';
export interface IBlockToGraphMap extends Record<Exclude<BlockType, ''>, GraphType> {}
export interface IShowBlockMap extends Record<Exclude<BlockType, ''>, Ref<boolean>> {}

export interface IThreeColumnCtx {
  resizing: Ref<boolean>;
  currentActiveBlock: Ref<BlockType>;
  currentLayoutMode: Ref<LayoutMode>;
  isComGraphFullscreen: Ref<boolean>;
  isSwimFullscreen: Ref<boolean>;
  BlockToGraphMap: IBlockToGraphMap;
  dragStartBlock: Ref<BlockType>;
  onToggleComGraphFullscreen: () => void;
  onToggleSwimFullscreen: () => void;
  emitSizeChange(): void;
  resetLayout(): void;
}

export const ThreeColumnProvideKey = 'three-column' as unknown as InjectionKey<IThreeColumnCtx>;

export interface ISwimGraphState {
  detailsPanelExpanded: Ref<boolean>;
}

export const SwimGraphStateKey = 'swim-graph-state' as unknown as InjectionKey<ISwimGraphState>;
