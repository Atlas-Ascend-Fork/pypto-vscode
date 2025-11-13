import { InjectionKey, Ref } from 'vue';

export interface ILayoutInfo {
  showLeft?: boolean;
  showRight?: boolean;
  showBottom?: boolean;
  showHResizeBar?: boolean;
  showVResizeBar?: boolean;
  currentWidth?: string;
  currentHeight?: string;
}

export interface IThreeColumnCtx {
  isComGraphFullscreen: Ref<boolean>;
  isSwimFullscreen: Ref<boolean>;
  onToggleComGraphFullscreen: () => void;
  onToggleSwimFullscreen: () => void;
}

export const ThreeColumnProvideKey = 'three-column' as unknown as InjectionKey<IThreeColumnCtx>;
