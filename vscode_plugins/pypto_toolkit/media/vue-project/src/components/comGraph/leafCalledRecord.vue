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
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="modelValue" ref="drawerEl" class="leaf-called-record-container">
        <div class="leaf-called-record-header">
          <span class="title" :title="leafName">{{ leafName }}</span>
          <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
        </div>
        <d-search
          icon-position="left"
          is-keyup-search
          class="leaf-called-record-search"
          :show-glow-style="false"
          :placeholder="t('comGraph.search')"
          @search="onSearch"
        ></d-search>
        <d-table v-if="tableData.length" :data="tableData" class="leaf-called-record-table" :header-bg="true" fix-header>
          <d-column field="name" width="286px" show-overflow-tooltip>
            <template #header>
              <div class="leaf-called-record-table-header call-function-name-header">
                <span class="header-title"> {{ t('comGraph.calledFunctionName') }}</span>
                <TableSortIcon :direction="fnNameSortDirection" @click="sortByFnName" />
              </div>
            </template>
            <template #default="scope">
              <div class="leaf-called-record-table-td call-function-name-td">
                <span class="td-cell-content">{{ scope.row.name }}</span>
              </div>
            </template>
          </d-column>
          <d-column field="value" width="154px">
            <template #header>
              <div class="leaf-called-record-table-header">
                <span class="header-title"> {{ t('comGraph.callNumber') }}</span>
                <TableSortIcon :direction="callNumberDirection" @click="sortByCallNum" />
              </div>
            </template>
            <template #default="scope">
              <div class="leaf-called-record-table-td">
                <span class="td-cell-content">{{ scope.row.value }}</span>
                <d-progress
                  class="leaf-called-record-progress"
                  :percentage="scope.row.percent"
                  barBgColor="#317AF7"
                  height="6px"
                ></d-progress>
              </div>
            </template>
          </d-column>
        </d-table>
        <div v-else class="leaf-called-record-empty">{{ t('controlFlows.noMatchingData') }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { PropType, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import TableSortIcon from './icons/table-sort-icon.vue';
import { useClickOutside } from './hooks/use-click-outside';
import type { SortDirection, LeafCalledRowData, SortMethod } from './type';

const props = defineProps({
  modelValue: Boolean,
  calledMap: { type: Object as PropType<Record<string, number>>, default: () => ({}) },
  leafName: { type: String, default: '' },
});
const emits = defineEmits(['update:modelValue']);

const { drawerEl } = useClickOutside(props, emits);
const { t } = useI18n();
const fnNameSortDirection = ref<SortDirection>('default');
const callNumberDirection = ref<SortDirection>('default');
const tableData = ref<LeafCalledRowData[]>([]);
const DirectionMap: Record<SortDirection, SortDirection> = {
  asc: 'desc',
  desc: 'default',
  default: 'asc',
};
const OrderByMap = {
  asc: (sortMethod: SortMethod) => (a: LeafCalledRowData, b: LeafCalledRowData) => sortMethod(a, b) ? 1 : -1,
  desc: (sortMethod: SortMethod) => (a: LeafCalledRowData, b: LeafCalledRowData) => sortMethod(a, b) ? -1 : 1,
};
const originTableData: LeafCalledRowData[] = [];

watch(
  () => props.calledMap,
  () => {
    if (Object.keys(props.calledMap)) {
      const max = Math.max(...Object.values(props.calledMap));
      for (const [name, value] of Object.entries(props.calledMap)) {
        originTableData.push({ name, value, percent: (value / max) * 100 });
      }
      tableData.value = originTableData;
    }
  },
);

function onSearch(key: string) {
  let filteredData: LeafCalledRowData[] = [];
  if (key) {
    filteredData = originTableData.filter((item) => item.name.toLocaleLowerCase().includes(key.toLocaleLowerCase()));
  } else {
    filteredData = originTableData;
  }
  execSort(filteredData);
}

function sortByFnName() {
  callNumberDirection.value = 'default';
  fnNameSortDirection.value = DirectionMap[fnNameSortDirection.value];
  execSort(tableData.value);
}
function sortByCallNum() {
  fnNameSortDirection.value = 'default';
  callNumberDirection.value = DirectionMap[callNumberDirection.value];
  execSort(tableData.value);
}

function execSort(data: LeafCalledRowData[]) {
  if (fnNameSortDirection.value !== 'default') {
    tableData.value = [...data].sort(OrderByMap[fnNameSortDirection.value]((a, b) => a.name > b.name));
  } else if (callNumberDirection.value !== 'default') {
    tableData.value = [...data].sort(OrderByMap[callNumberDirection.value]((a, b) => a.value > b.value));
  } else {
    tableData.value = data;
  }
}
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.leaf-called-record-container {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1040;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 480px;
  padding: 20px;
  border-radius: 16px;
  background-color: var(--devui-card-bg);
  box-shadow: -1px 0 0 0 var(--devui-split-line);
  box-sizing: border-box;

  .leaf-called-record-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 26px;

    .title {
      font-size: 18px;
      font-weight: bold;
      color: var(--devui-title-text);
      line-height: 26px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .icon-close {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      color: var(--devui-icon);
      border-radius: 8px;
      transition: background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
        color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
      cursor: pointer;

      &:hover {
        color: var(--devui-title-text);
        background-color: var(--devui-input-hover-bg);
      }
    }
  }

  .leaf-called-record-search {
    width: 200px;

    &.devui-search--focus {
      :deep() {
        .devui-input {
          border-color: var(--devui-primary-button-active-bg);
        }
      }
    }

    &:not(.devui-search--focus):hover {
      :deep() {
        .devui-input {
          border-color: var(--devui-primary-button-hover-bg) !important;
        }
      }
    }

    :deep() {
      .devui-search__icon {
        height: 28px;
        svg path {
          fill: var(--devui-placeholder-text);
        }
      }
      .devui-input {
        height: 28px;
        border-color: transparent;
        background-color: var(--devui-input-bg);

        .devui-input__wrapper,
        input {
          background-color: transparent;

          &::placeholder {
            color: var(--devui-placeholder-text);
          }
        }
      }
    }
  }

  .leaf-called-record-table {
    border-radius: 12px 12px 0 0;

    :deep() {
      .devui-table__thead tr th {
        border-bottom: none;
      }

      .devui-table__tbody tr {
        background-color: transparent;

        td {
          padding-top: 5px;
          padding-bottom: 6px;
          padding-right: 8px;
          border-bottom-color: var(--devui-secondary-button-border);
        }
      }
    }

    .leaf-called-record-table-header {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      height: 32px;

      &.call-function-name-header {
        justify-content: flex-end;
      }

      .header-title {
        font-size: 12px;
        line-height: 18px;
        color: var(--devui-secondary-text);
      }
    }

    .leaf-called-record-table-td {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;

      &.call-function-name-td {
        justify-content: flex-end;
      }

      .td-cell-content {
        font-size: 13px;
        line-height: 20px;
        color: var(--devui-primary-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .leaf-called-record-progress {
        flex: 1;
        margin-right: 8px;
      }
    }
  }

  .leaf-called-record-empty {
    padding-top: 16px;
    text-align: center;
    color: var(--devui-primary-text);
    font-size: 14px;
  }
}
</style>
