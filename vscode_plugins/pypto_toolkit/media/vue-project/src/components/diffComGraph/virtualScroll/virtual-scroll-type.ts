import type { ExtractPropTypes, PropType } from 'vue';

export interface IItemData {
  index: number;
  data: Record<string, any>;
  $height: number;
  $offsetTop: number;
}

export interface IScrollParams {
  distance: number;
  renderCountPerScreen: number;
  scrollScale: Array<number>;
  originData: Array<IItemData>;
}

export const virtualScrollProps = {
  data: {
    type: Array as PropType<Array<Record<string, any>>>,
    default: () => [],
  },
  itemHeight: {
    type: Number,
    default: 30,
  },
};
export type VirtualScrollProps = ExtractPropTypes<typeof virtualScrollProps>;
