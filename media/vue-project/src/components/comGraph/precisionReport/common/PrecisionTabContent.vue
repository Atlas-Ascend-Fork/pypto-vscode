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
  <div class="precision-tab-content">
    <div class="tabs-wrapper">
      <d-tabs v-model="activeTab" type="slider" :show-content="false" class="precision-report-tabs">
        <d-tab id="overview" :title="t('precisionOverview')"></d-tab>
        <d-tab id="detail" :title="detailTabTitle"></d-tab>
      </d-tabs>
      <div v-if="activeTab === 'detail' && showCustomSort" class="custom-sort-btn" @click="handleCustomSort">
        <i :class="isCustomSorting ? 'icon-setting-results' : 'icon-setting-results'"></i>
        <span>{{ isCustomSorting ? t('cancelCustomSort') : t('customSort') }}</span>
      </div>
    </div>

    <div v-if="activeTab === 'overview'" class="tab-content-wrapper">
      <slot name="overview"></slot>
    </div>

    <div v-if="activeTab === 'detail'" class="tab-content-wrapper">
      <slot name="detail"></slot>
    </div>

    <CustomSortModal v-if="showCustomSort" v-model="showSortModal" @confirm="onCustomSortConfirm" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import CustomSortModal from '../customSortModal.vue';
import type { SelectedSortCol, AbnormalNodeCompareListItem } from '../precisionReport.types';

const props = defineProps({
  detailCount: {
    type: Number,
    default: 0,
  },
  showCustomSort: {
    type: Boolean,
    default: false,
  },
  tableData: {
    type: Array as () => AbnormalNodeCompareListItem[],
    default: () => [],
  },
});

const emits = defineEmits<{
  (e: 'customSort', data: AbnormalNodeCompareListItem[]): void;
  (e: 'cancelCustomSort'): void;
  (e: 'singleColumnSort'): void;
  (e: 'update:activeTab', tab: 'overview' | 'detail'): void;
}>();

const { t } = useI18n();
const activeTab = ref<'overview' | 'detail'>('overview');
const isCustomSorting = ref(false);
const showSortModal = ref(false);
let originTableData: AbnormalNodeCompareListItem[] = [];

const detailTabTitle = computed(() => `${t('precisionDetail')} (${props.detailCount})`);

watch(
  () => props.tableData,
  (val) => {
    originTableData = JSON.parse(JSON.stringify(val));
  },
  { immediate: true }
);

watch(activeTab, (val) => {
  emits('update:activeTab', val);
});

const handleCustomSort = () => {
  if (isCustomSorting.value) {
    isCustomSorting.value = false;
    emits('cancelCustomSort');
  } else {
    showSortModal.value = true;
  }
};

const onCustomSortConfirm = (sortCols: SelectedSortCol[]) => {
  isCustomSorting.value = true;
  const temp = JSON.parse(JSON.stringify(originTableData));
  temp.sort((a, b) => {
    for (const { field, direction } of sortCols) {
      if (a[field] !== b[field]) {
        return direction === 'asc' ? (a[field] as number) - (b[field] as number) : (b[field] as number) - (a[field] as number);
      }
    }
    return 0;
  });
  emits('customSort', temp);
};

const onSingleColumnSort = () => {
  isCustomSorting.value = false;
  emits('singleColumnSort');
};

const resetCustomSort = () => {
  isCustomSorting.value = false;
};

defineExpose({
  onSingleColumnSort,
  resetCustomSort,
  activeTab,
});
</script>

<style lang="scss" scoped>
.precision-tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;

  .tabs-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 16px 0;

    .precision-report-tabs {
      padding: 0;

      :deep() {
        .devui-tabs__nav--slider {
          background-color: var(--precision-tab-bg);
          font-size: 13px;
          padding: 2px;

          li {
            margin: 0;

            .devui-tabs__nav-content {
              justify-content: center;
            }

            a {
              color: var(--precision-tab-unselected-text);
              white-space: nowrap;
            }

            &:hover a {
              color: var(--precision-tab-unselected-text);
            }

            &.active a {
              color: var(--precision-tab-selected-text) !important;
            }
          }
        }

        .devui-tabs__nav-slider-animation {
          padding: 4px 16px;
          background-color: var(--precision-tab-active-bg);
        }
      }
    }

    .custom-sort-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--devui-secondary-text);
      cursor: pointer;

      span {
        line-height: 20px;
      }

      i {
        margin-top: 2px;
        font-size: 16px;
      }
    }
  }

  .tab-content-wrapper {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: auto;
    scrollbar-gutter: stable;
  }
}
</style>