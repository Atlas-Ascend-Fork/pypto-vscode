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
  <div class="data-list">
    <div class="head">
      <div v-for="item in columns" class="head-item" :style="generateStyle(item)">
        {{ item.header }}
      </div>
    </div>
    <div class="body">
      <template v-for="row in data">
        <div :class="['body-tr', row.isOpen && 'is-open']">
          <div v-for="(col, colIndex) in columns" :key="colIndex" :class="['body-td', col.align]" :style="generateStyle(col)">
            <span>{{ row[col.field] ?? '-' }}</span>
            <d-tooltip
              v-if="row.detail && colIndex === columns.length - 1"
              :content="
                row.isOpen
                  ? t('comGraph.collapse') + TypeMap[row.type] + t('comGraph.list')
                  : t('comGraph.expand') + TypeMap[row.type] + t('comGraph.list')
              "
              position="top-end"
            >
              <ExpandIcon @click="() => (row.isOpen = !row.isOpen)" />
            </d-tooltip>
          </div>
        </div>
        <CollapsePanel v-if="!disableCollapsePanel" :is-open="row.isOpen" :data-list="row.detail" :type="row.type" :column-count="columnCount" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { dataListProps } from './types';
import type { ColumnItem } from './types';
import CollapsePanel from './collapsePanel.vue';
import ExpandIcon from './expand-icon.vue';

defineProps(dataListProps);

const { t } = useI18n();
const TypeMap = {
  op: 'Op',
  tensor: 'Tensor',
  subgraph: 'Subgraph',
};

const generateStyle = (col: ColumnItem) => {
  const base: Record<string, any> = {};
  if (col.width) {
    base.width = col.width + 'px';
  } else {
    base.flex = 1;
  }
  if (col.align) {
    base.textAlign = col.align;
  }
  return base;
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.data-list {
  .head {
    display: flex;
    padding: 4px 12px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    background-color: var(--devui-nest-bg);
    box-sizing: border-box;

    .head-item {
      color: var(--devui-secondary-text);
      font-size: 12px;
      line-height: 16px;
    }
  }

  .body {
    .body-tr {
      display: flex;
      padding: 6px 12px;
      border-bottom: 1px solid var(--devui-input-bg);
      box-sizing: border-box;

      .body-td {
        display: flex;
        align-items: center;
        color: var(--devui-primary-text);
        font-size: 14px;
        line-height: 20px;

        &.right {
          justify-content: flex-end;
        }

        :deep() {
          svg {
            margin-left: 4px;

            &:hover {
              cursor: pointer;
              path {
                fill: rgb(57, 121, 249);
              }
            }
          }
        }
      }

      &.is-open {
        background-color: var(--devui-input-active-bg);

        .body-td {
          :deep() {
            svg {
              transform: rotate(180deg);
              path {
                fill: rgb(57, 121, 249);
              }
            }
          }
        }
      }
    }
  }
}
</style>
