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
              :content="row.isOpen ? t('comGraph.collapseChildNode') : t('comGraph.expandChildNode')"
              position="top-end"
            >
              <ExpandIcon @click="() => (row.isOpen = !row.isOpen)" />
            </d-tooltip>
          </div>
        </div>
        <CollapsePanel :is-open="row.isOpen" :data-list="row.detail" :type="row.type" :column-count="columnCount" />
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
