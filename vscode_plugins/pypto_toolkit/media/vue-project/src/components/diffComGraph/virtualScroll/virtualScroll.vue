<template>
  <div ref="scrollEl" class="virtual-scroll">
    <div class="virtual-scroll-space" :style="{ height: `${contentHeight}px` }"></div>
    <div :style="{ transform: `translateY(${translate}px)` }">
      <template v-for="item in renderData">
        <slot :data="item.data" :index="item.index" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVirtualScroll } from './use-virtual-scroll';
import { virtualScrollProps } from './virtual-scroll-type';

const props = defineProps(virtualScrollProps);

const { scrollEl, contentHeight, translate, renderData } = useVirtualScroll(props);
</script>

<style scoped lang="scss">
.virtual-scroll {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;

  &-space {
    position: absolute;
    inset: 0;
    z-index: -1;
  }
}
</style>
