import { InjectionKey, Ref } from 'vue';

export interface ILayoutInfo {
  showLeft?: boolean;
  showRight?: boolean;
  showBottom?: boolean;
  currentWidth?: string;
  currentHeight?: string;
}
export type LayoutMode = 'triangular' | 'threeColumn';
export type BlockType = 'left' | 'right' | 'bottom' | '';
export type GraphType = 'editor' | 'comGraph' | 'swimGraph';
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
