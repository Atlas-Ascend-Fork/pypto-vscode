import { InjectionKey, Ref } from 'vue';

export interface ILayoutInfo {
  showEditor?: boolean;
  showComGraph?: boolean;
  showSwim?: boolean;
  showHResizeBar?: boolean;
  showVResizeBar?: boolean;
  currentWidth?: string;
  currentHeight?: string;
}

export type ActiveType = 'editor' | 'comGraph' | 'swim' | '';

export interface IThreeColumnCtx {
  currentActive: Ref<ActiveType>;
  isComGraphFullscreen: Ref<boolean>;
  isSwimFullscreen: Ref<boolean>;
  onToggleComGraphFullscreen: () => void;
  onToggleSwimFullscreen: () => void;
}

export const ThreeColumnProvideKey = 'three-column' as unknown as InjectionKey<IThreeColumnCtx>;
