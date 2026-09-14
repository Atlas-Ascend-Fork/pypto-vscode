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
  <div class="selected-history">
    <div :class="['selected-history-title', isOpen && 'is-open']" @click="openChooseList()">
      <span :title="baseChoose || t('pleaseSelectResult')">{{ baseChoose || t('pleaseSelectResult') }}</span>
      <i class="icon-chevron-down-2"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, inject, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { baseChoose, runDataVisible, isHeaderEnter } = inject('runDataList');

const isOpen = ref(false);

const openChooseList = () => {
  isOpen.value = !isOpen.value;
  runDataVisible.value = true;
  isHeaderEnter.value = true;
};


</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.selected-history {
  min-width: 170px;

  .selected-history-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 400;
    line-height: 20px;
    color: var(--devui-primary-text);
    pointer-events: all;
    transition: color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;

    &:hover {
      color: var(--devui-operation-text-hover);
    }

    span {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }

    i {
      font-size: 16px;
      font-weight: bold;
      color: var(--devui-placeholder-text);
      transition: transform $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
    }

    &.is-open {
      i {
        transform: rotate(180deg);
      }
    }
  }
}
</style>