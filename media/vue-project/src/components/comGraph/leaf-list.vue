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
@use 'devui-theme/styles-var/devui-var.scss' as *;

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
