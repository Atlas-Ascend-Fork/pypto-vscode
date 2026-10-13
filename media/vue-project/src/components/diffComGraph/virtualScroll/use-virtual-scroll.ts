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
import { onMounted, ref, computed, watch } from 'vue';
import type { IItemData, IScrollParams, VirtualScrollProps } from './virtual-scroll-type';

export function useVirtualScroll(props: VirtualScrollProps) {
  const contentHeight = ref(0);
  const translate = ref(0);
  const scrollEl = ref<HTMLElement>();
  const renderData = ref<IItemData[]>([]);
  const sliceData = computed(() => props.data.slice());
  const scrollParams: IScrollParams = {
    distance: 0,
    renderCountPerScreen: 0,
    scrollScale: [0, 0],
    originData: [],
  };
  let tick = false;

  function initOriginData() {
    let totalHeight = 0;
    scrollParams.originData = [];
    for (let i = 0; i < props.data.length; i++) {
      const item: IItemData = { index: i, data: props.data[i], $height: props.itemHeight, $offsetTop: totalHeight };
      scrollParams.originData.push(item);
      totalHeight += props.itemHeight;
    }
    contentHeight.value = totalHeight;
  }

  function initVirtualData(distance: number) {
    const clientHeight = scrollEl.value!.clientHeight;
    scrollParams.distance = distance;
    scrollParams.renderCountPerScreen = Math.ceil(clientHeight / props.itemHeight);
    scrollParams.scrollScale = [distance, scrollParams.renderCountPerScreen * props.itemHeight];
    calcRenderData();
  }

  function clearRenderState() {
    renderData.value = [];
    translate.value = 0;
    if (scrollEl.value) {
      scrollEl.value.scrollTop = 0;
    }
  }

  function computeScrollDistance() {
    const scrollTop = scrollEl.value!.scrollTop;
    const lastOffset = scrollParams.originData[scrollParams.originData.length - 1].$offsetTop;
    return scrollTop > lastOffset ? 0 : scrollTop;
  }

  function updateData() {
    initOriginData();
    if (scrollEl.value && scrollParams.originData.length) {
      initVirtualData(computeScrollDistance());
    } else {
      clearRenderState();
    }
  }

  function updateRenderRange(scrollTop: number) {
    if (scrollTop !== scrollParams.distance && scrollParams.originData.length > 0) {
      scrollParams.distance = scrollTop;
      calcRenderData();
    }
  }

  function onScroll(e: Event) {
    if (tick) {
      return;
    }
    tick = true;
    requestAnimationFrame(() => {
      tick = false;
    });
    updateRenderRange((e.target as HTMLElement).scrollTop);
  }

  function buildRenderLists(startIndex: number, renderCount: number) {
    const origin = scrollParams.originData;
    const totalLen = origin.length;
    const upperStartIndex = Math.max(Math.ceil(startIndex - renderCount), 0);
    let downStartIndex = Math.floor(startIndex + renderCount);
    downStartIndex = downStartIndex > totalLen - 1 ? totalLen : downStartIndex;
    return {
      upperList: origin.slice(upperStartIndex, startIndex),
      midList: origin.slice(startIndex, startIndex + renderCount),
      downList: origin.slice(downStartIndex, downStartIndex + renderCount),
      upperStartIndex,
    };
  }

  function calcRenderData() {
    if (scrollParams.distance > scrollParams.scrollScale[0] && scrollParams.distance < scrollParams.scrollScale[1]) {
      return;
    }
    const startIndex = getStartIndex(scrollParams.originData, scrollParams.distance);
    const renderCount = scrollParams.renderCountPerScreen;
    const lists = buildRenderLists(startIndex, renderCount);
    translate.value = scrollParams.originData[lists.upperStartIndex].$offsetTop;
    scrollParams.scrollScale = [
      scrollParams.originData[Math.floor(lists.upperStartIndex + renderCount / 2)]?.$offsetTop ?? 0,
      scrollParams.originData[Math.ceil(startIndex + renderCount / 2)]?.$offsetTop ?? 0,
    ];
    renderData.value = [...lists.upperList, ...lists.midList, ...lists.downList];
  }

  function getStartIndex(list: IItemData[], distance: number) {
    let start = 0;
    let end = list.length - 1;

    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      const { $height, $offsetTop } = list[mid];
      if (distance >= $offsetTop && distance < $height + $offsetTop) {
        start = mid;
        break;
      } else if (distance >= $height + $offsetTop) {
        start = mid + 1;
      } else {
        end = mid - 1;
      }
    }
    return start;
  }

  watch(sliceData, () => {
    updateData();
  });

  onMounted(() => {
    updateData();
    scrollEl.value?.addEventListener('scroll', onScroll);
  });

  return { scrollEl, contentHeight, translate, renderData };
}
