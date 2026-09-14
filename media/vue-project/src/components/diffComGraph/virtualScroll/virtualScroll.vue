<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
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
