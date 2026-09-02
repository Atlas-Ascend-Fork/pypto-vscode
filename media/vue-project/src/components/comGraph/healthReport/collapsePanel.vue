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
  <Transition
    name="collapse"
    @beforeEnter="beforeEnter"
    @enter="enter"
    @afterEnter="afterEnter"
    @beforeLeave="beforeLeave"
    @leave="leave"
    @afterLeave="afterLeave"
  >
    <div v-if="isOpen" class="panel-container">
      <div class="collapse-panel-search-container">
        <span>{{ type && TypeMap[type] }}{{ t('comGraph.list') }}:</span>
        <d-search
          is-keyup-search
          size="sm"
          :show-glow-style="false"
          :placeholder="`${t('comGraph.search')}${type && TypeMap[type]}`"
          class="search-box"
          @search="onSearch"
        ></d-search>
      </div>
      <div class="list-box" @click="onClick">
        <div v-for="(row, rowIndex) in renderList" :key="rowIndex" class="list-row">
          <template v-for="col in row">
            <d-tooltip :content="t('comGraph.locateComGraph')" :disabled="col.expandAll || !type" position="top-end">
              <div :class="['list-col', col.expandAll && 'expand-all', type && 'can-locate']" :data-id="col.label" :data-type="type">
                <span>{{ col.label }}</span>
              </div>
            </d-tooltip>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, inject } from 'vue';
import type { PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { HealthReportProvideKey } from './types';
import type { ItemData, HealthReportContext } from './types';
import { useCollapsePanel } from './use-collapse-panel-transition';
import { arrChange } from './utils';

const { t } = useI18n();
const { locateNode } = inject(HealthReportProvideKey) as HealthReportContext;

const props = defineProps({
  isOpen: Boolean,
  dataList: {
    type: Array as PropType<number[]>,
    default: () => [],
  },
  columnCount: {
    type: Number,
    default: 5,
  },
  type: {
    type: String as PropType<'op' | 'tensor' | 'subgraph'>,
  },
});

const { beforeEnter, enter, afterEnter, beforeLeave, leave, afterLeave } = useCollapsePanel();

const renderList = ref<ItemData[][]>([]);
const TypeMap = {
  op: 'Op',
  tensor: 'Tensor',
  subgraph: 'Subgraph',
};

const generateRenderList = (val: number[]) => {
  if (val.length > props.columnCount * 2) {
    renderList.value = arrChange(val.slice(0, props.columnCount * 2 - 1), props.columnCount);
    renderList.value[1].push({ label: t('comGraph.expandAll'), expandAll: true });
  } else {
    renderList.value = arrChange([...val], props.columnCount);
  }
};
watch(
  () => props.dataList,
  (val) => {
    generateRenderList(val);
  },
  { immediate: true },
);

const onSearch = (e: string) => {
  const res: number[] = [];
  for (let i = 0; i < props.dataList.length; i++) {
    const item = props.dataList[i];
    if (String(item).includes(e)) {
      res.push(item);
    }
  }
  generateRenderList(res);
};

const onClick = (e: MouseEvent) => {
  const composedPath = e.composedPath() as HTMLElement[];
  const node = composedPath.find(item => item.classList?.contains('list-col'));
  if (node) {
    if (node.classList.contains('expand-all')) {
      renderList.value = arrChange([...props.dataList], props.columnCount);
    } else {
      const { id, type } = node.dataset;
      if (id && type) {
        locateNode(id, type);
      }
    }
  }
};
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.panel-container {
  width: 100%;
  background-color: $devui-base-bg;

  .collapse-panel-search-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 32px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--devui-split-line);
    background-color: var(--devui-nest-bg);
    box-sizing: border-box;

    & > span {
      color: var(--devui-secondary-text);
    }

    .search-box {
      flex: 1;
      :deep() {
        .devui-input--sm {
          background-color: transparent;
          border: none;

          .devui-input__wrapper {
            background-color: transparent;
          }
        }

        input {
          outline: none !important;
        }
      }
    }
  }

  .list-box {
    .list-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 16px;
      font-size: 14px;
      font-weight: 500;
      border-bottom: 1px solid var(--devui-split-line);
      background-color: var(--devui-nest-bg);

      .list-col {
        min-width: 54px;
        line-height: 20px;

        &.can-locate {
          color: var(--devui-link-text);
          cursor: pointer;
        }

        &.expand-all {
          position: relative;
          cursor: pointer;
          color: var(--devui-placeholder-text);

          span {
            position: absolute;
            top: 0;
            left: 0;
            width: 76px;
            transform: translateY(-50%);
          }
        }
      }
    }
  }
}

.collapse {
  &-enter-from,
  &-leave-to {
    opacity: 0;
  }

  &-enter-to,
  &-leave-from {
    opacity: 1;
  }

  &-enter-active,
  &-leave-active {
    transition: max-height 0.3s cubic-bezier(0.5, 0.05, 0.5, 0.95) opacity 0.3s cubic-bezier(0.5, 0.05, 0.5, 0.95);
  }
}
</style>
