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
  <d-dropdown
    trigger="manually"
    :visible="isVisible"
    :position="['bottom-start']"
    :offset="-4"
    class="layer-list-menu-wrap"
    @toggle="(val) => (isVisible = val)"
  >
    <span @click="expandList" class="layer-cur" :title="funcMap[curPath[curPath.length - 1]]?.func_magicname">{{ funcMap[curPath[curPath.length - 1]]?.func_magicname }} </span>
    <template #menu>
      <div class="layer-list pypto-scrollbar">
        <div
          v-for="(it, index) in curList"
          :key="index"
          class="layer-item"
          :class="{ active: it == curPath[curPath.length - 1] }"
          @click="onJump(it)"
        >
          {{ funcMap[it]?.func_magicname }}
        </div>
      </div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { PropType, ref } from 'vue';

const props = defineProps({
  funcMap: { type: Object, default: () => ({}) },
  curList: { type: Array as PropType<string[]>, default: () => [] },
  curPath: { type: Array, default: () => [] },
});
const emits = defineEmits(['change']);

const isVisible = ref(false);
function expandList() {
  if (props.curList.length > 1) {
    isVisible.value = !isVisible.value;
  }
}

const onJump = (it) => {
  const newPath = [...props.curPath];
  newPath.pop();
  newPath.push(it);
  emits('change', it, props.funcMap[it].func_magicname, JSON.stringify(newPath));
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.layer-cur {
  white-space: nowrap;
  pointer-events: all;

  &:hover {
    cursor: pointer;
  }
}

.layer-list {
  max-height: 400px;
  overflow: auto;

  .layer-item {
    padding: 8px;
    border-radius: 4px;
    box-sizing: border-box;
    cursor: pointer;

    &:not(.active):hover {
      background-color: var(--devui-input-hover-bg);
    }

    &.active {
      background-color: var(--devui-input-active-bg);
    }
  }
}
</style>

<style lang="scss">
.devui-flexible-overlay:has(.layer-list-menu-wrap) {
  border-radius: 8px;
  box-shadow: var(--devui-select-shadow);
}
.layer-list-menu-wrap {
  padding: 8px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;
}
</style>
