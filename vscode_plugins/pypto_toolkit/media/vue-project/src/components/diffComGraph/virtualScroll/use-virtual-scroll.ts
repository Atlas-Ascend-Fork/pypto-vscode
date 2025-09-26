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

  function updateData() {
    let distance = 0;
    initOriginData();
    if (scrollEl.value && scrollParams.originData.length) {
      const scrollTop = scrollEl.value.scrollTop;
      distance = scrollTop > scrollParams.originData[scrollParams.originData.length - 1].$offsetTop ? 0 : scrollTop;
      initVirtualData(distance);
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
    const scrollTop = (e.target as HTMLElement).scrollTop;
    if (scrollTop !== scrollParams.distance) {
      if (scrollParams.originData.length === 0) {
        return;
      }
      scrollParams.distance = scrollTop;
      calcRenderData();
    }
  }

  function calcRenderData() {
    if (scrollParams.distance > scrollParams.scrollScale[0] && scrollParams.distance < scrollParams.scrollScale[1]) {
      return;
    }
    const startIndex = getStartIndex(scrollParams.originData, scrollParams.distance);
    let upperStartIndex = Math.max(Math.ceil(startIndex - scrollParams.renderCountPerScreen), 0);
    translate.value = scrollParams.originData[upperStartIndex].$offsetTop;
    const upperList = scrollParams.originData.slice(upperStartIndex, startIndex);
    const midList = scrollParams.originData.slice(startIndex, startIndex + scrollParams.renderCountPerScreen);
    let downStartIndex = Math.floor(startIndex + scrollParams.renderCountPerScreen);
    downStartIndex = downStartIndex > scrollParams.originData.length - 1 ? scrollParams.originData.length : downStartIndex;
    scrollParams.scrollScale = [
      scrollParams.originData[Math.floor(upperStartIndex + scrollParams.renderCountPerScreen / 2)]?.$offsetTop ?? 0,
      scrollParams.originData[Math.ceil(startIndex + scrollParams.renderCountPerScreen / 2)]?.$offsetTop ?? 0,
    ];
    const downList = scrollParams.originData.slice(downStartIndex, downStartIndex + scrollParams.renderCountPerScreen);
    renderData.value = [...upperList, ...midList, ...downList];
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
