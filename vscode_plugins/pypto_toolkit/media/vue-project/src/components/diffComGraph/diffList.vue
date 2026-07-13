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
  <div class="diff-list-container" :class="{ 'is-collapse': !isExpand }">
    <div class="diff-list-head">
      <span class="diff-title">{{ t('diffList') }}</span>
      <span class="diff-count">({{ list.length }})</span>
    </div>
    <VirtualScroll :data="list" style="height: calc(100% - 40px)">
      <template #default="scope">
        <div :class="['diff-list-item', isLoading && 'diff-list-item-disabled']" @click="() => onItemClick(scope.data)">
          <span class="item-index">{{ scope.index + 1 }}</span>
          <span class="item-title">{{ scope.data.nodeType }} : {{ scope.data.magic }}</span>
          <DiffDeleteIcon v-if="scope.data.changeType === 'delete'" class="item-delete-icon" />
          <i v-else :class="['item-icon', scope.data.changeType, IconMap[scope.data.changeType]]"></i>
        </div>
      </template>
    </VirtualScroll>
    <div class="toggle-icon" @click="onExpandChange">
      <i :class="[isExpand ? 'icon-chevron-left-2' : 'icon-chevron-right-2']"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import VirtualScroll from './virtualScroll/virtualScroll.vue';
import DiffDeleteIcon from './diffDeleteIcon.vue'
import type { DiffListItem } from './type';

const props = defineProps({
  list: {
    type: Array as PropType<DiffListItem[]>,
    default: () => [],
  },
  isLoading: { type: Boolean, default: false },
});
const emits = defineEmits(['click', 'expandChange']);

const { t } = useI18n();
const isExpand = ref(true);
const IconMap = {
  add: 'icon-add',
  change: 'icon-switch',
};
const onItemClick = (data: DiffListItem) => {
  if (props.isLoading) {
    return;
  }
  emits('click', data);
};
const onExpandChange = () => {
  isExpand.value = !isExpand.value;
  emits('expandChange', isExpand.value);
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.diff-list-container {
  position: relative;
  width: 320px;
  height: 100%;
  padding: 16px 0 0 16px;
  background-color: var(--devui-card-bg);
  border-right: 1px solid var(--devui-split-line);
  box-sizing: border-box;
  transition: width $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
    padding $devui-animation-duration-base $devui-animation-ease-in-out-smooth;

  &.is-collapse {
    width: 0;
    padding: 0;

    .diff-list-head {
      opacity: 0;
    }
  }

  .diff-list-head {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    opacity: 1;
    transition: opacity $devui-animation-duration-base $devui-animation-ease-in-out-smooth;

    .diff-title {
      font-size: 16px;
      font-weight: bold;
      line-height: 24px;
      color: var(--devui-primary-text);
      margin-right: 8px;
    }
    .diff-count {
      font-size: 12px;
      line-height: 20px;
      color: var(--devui-secondary-text);
    }
  }

  .diff-list-item {
    display: flex;
    align-items: center;
    height: 30px;
    padding-left: 8px;
    padding-right: 24px;
    box-sizing: border-box;

    &.diff-list-item-disabled {
      cursor: not-allowed;

      .item-index,
      .item-title {
        color: var(--devui-disabled-text);
      }
    }

    &:not(.diff-list-item-disabled):hover {
      border-radius: 4px;
      background-color: var(--devui-input-hover-bg);
      cursor: pointer;
    }

    &:not(:first-child) {
      border-top: 1px solid var(--devui-split-line);
    }

    .item-index,
    .item-title {
      font-size: 14px;
      line-height: 22px;
      color: var(--devui-primary-text);
    }

    .item-index {
      margin-right: 8px;
      font-weight: bolder;
    }

    .item-title {
      flex: 1;
    }

    .item-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      font-size: 12px;
      border-radius: 4px;
      box-sizing: border-box;

      &.add {
        border: 1px solid var(--devui-status-success-text);
        color: var(--devui-status-success-text);
      }

      &.change {
        border: 1px solid var(--devui-status-warning-text);
        color: var(--devui-status-warning-text);
      }
    }

    .item-delete-icon {
      width: 18px;
      height: 18px;
    }
  }

  .toggle-icon {
    position: absolute;
    right: -17px;
    top: calc(50% - 20px);
    z-index: 15;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 40px;
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
    background-color: var(--devui-card-bg);
    cursor: pointer;
  }
}
</style>
