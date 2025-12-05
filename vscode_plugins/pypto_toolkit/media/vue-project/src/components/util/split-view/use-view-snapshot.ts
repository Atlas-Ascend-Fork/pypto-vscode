import { Ref, toRaw } from 'vue';

import { SplitView } from './SplitViewContainer.vue';

export function useViewSnapshot(views: Ref<SplitView[]>) {
  let viewSnapshots: SplitView[];
  function snapshot() {
    viewSnapshots = structuredClone(toRaw(views.value));
  }

  function getViewSnapshot(index: number): SplitView {
    return viewSnapshots[index];
  }

  return { snapshot, getViewSnapshot };
}
