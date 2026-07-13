<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
