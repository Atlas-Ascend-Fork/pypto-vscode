import type { Ref } from 'vue';

export interface ComGraphContext {
  toggleHealthReport: (status: boolean) => void;
  showLayerControl: Ref<boolean>;
}
