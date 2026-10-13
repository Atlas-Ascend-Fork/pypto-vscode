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
import { onBeforeUnmount, onMounted, Ref, toRaw } from 'vue';
import { SplitView } from './SplitViewContainer.vue';

/**
 * 监听外部容器缩放，等比缩放view
 */
export function useResizeObserver(containerRef: Ref<HTMLDivElement>, renderViews: Ref<SplitView[]>, minHeight: Ref<number>) {
  const observer = new ResizeObserver(([container]) => {
    const views = structuredClone(toRaw(renderViews.value));
    if (container) {
      const originHeight = views.at(-1).top + views.at(-1).height;
      const resizedHeight = container.contentRect.height;
      let lockedHeight = 0;
      let unLockedViewIndexes: number[] = [];
      views.forEach((view, index) => {
        if (view.locked) {
          lockedHeight += view.height;
        } else {
          unLockedViewIndexes.push(index);
        }
      });
      resizeViews(unLockedViewIndexes, lockedHeight);
      let stackHeight = 0;
      renderViews.value.forEach((view) => {
        view.top = stackHeight;
        stackHeight += view.height;
      });
      function resizeViews(viewIndexes: number[], reducingHeight: number) {
        const resizeRate = (resizedHeight - reducingHeight) / (originHeight - reducingHeight);
        const unlockedIndexes: number[] = [];
        for (const viewIndex of viewIndexes) {
          if (views[viewIndex].height * resizeRate < minHeight.value) {
            renderViews.value[viewIndex].height = minHeight.value;
            reducingHeight += minHeight.value;
          } else {
            unlockedIndexes.push(viewIndex);
            renderViews.value[viewIndex].height = views[viewIndex].height * resizeRate;
          }
        }
        if (unlockedIndexes.length < viewIndexes.length) {
          resizeViews(unlockedIndexes, reducingHeight);
        }
      }
    }
  });

  onMounted(() => {
    observer.observe(containerRef.value);
  });

  onBeforeUnmount(() => {
    observer.disconnect();
  });
}
