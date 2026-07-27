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
  <div class="task-diff-container">
    <div class="task-diff-header">
      <div class="header-left">
        <span class="task-title">{{ taskTitle }}</span>
      </div>
      <div class="header-right">
        <MultiFilterSearch
          ref="multiFilterSearchRef"
          :placeholder="t('taskCheck.searchPlaceholder')"
          :disabled="props.initialLoading"
          @change="onMultiFilterChange"
        />
        <div class="filter-group">
          <d-checkbox v-model="filterAll" :disabled="props.initialLoading" @change="onFilterAllChange">
            {{ t('taskCheck.filterAll') }}
          </d-checkbox>
          <d-checkbox v-model="filterFailOnly" :disabled="props.initialLoading" @change="onFilterFailChange">
            {{ t('taskCheck.filterFail') }}
          </d-checkbox>
          <d-checkbox v-model="filterPassOnly" :disabled="props.initialLoading" @change="onFilterPassChange">
            {{ t('taskCheck.filterPass') }}
          </d-checkbox>
        </div>
      </div>
    </div>
    <div class="task-name-bar">
      <div class="task-name-left">
        <span class="task-name-text" :title="leftTitle">{{ leftTitle }}</span>
      </div>
      <div class="task-name-right">
        <span class="task-name-text" :title="rightTitle">{{ rightTitle }}</span>
      </div>
    </div>
    <div class="task-diff-body" ref="scrollContainerRef" @scroll="onScroll">
      <!-- 初始加载状态 -->
      <div v-if="props.initialLoading" class="initial-loading">
        <d-loading loadingType="spinner" size="md"></d-loading>
        <span class="loading-text">{{ t('taskCheck.loading') }}</span>
      </div>
      <!-- 空数据状态 -->
      <div v-else-if="!props.initialLoading && filteredList.length === 0" class="empty-data">
        <span class="empty-text">{{ t('taskCheck.noData') }}</span>
      </div>
      <!-- 数据列表 -->
      <template v-else>
        <div class="task-list">
          <div v-for="item in filteredList" :key="item.id" :class="['task-row', expandedItems.includes(item.id) && 'expanded']">
            <div :class="['task-box', selectedItemId === item.id && 'has-selection']">
              <div class="box-header" @click="toggleExpand(item.id)">
                <div class="header-left">
                  <span class="task-name">task_{{ item.taskName }}</span>
                  <span v-if="item.opMagic" class="info-text">
                    <span class="info-label">opMagic:</span>
                    <span class="info-value" :title="item.opMagic">{{ item.opMagic }}</span>
                  </span>
                  <span v-if="item.rawMagic" class="info-text">
                    <span class="info-label">RawMagic:</span>
                    <span class="info-value" :title="item.rawMagic">{{ item.rawMagic }}</span>
                  </span>
                  <span v-if="item.ioFlag" class="info-text">
                    <span class="info-label">IO_flag:</span>
                    <span class="info-value" :title="item.ioFlag">{{ item.ioFlag }}</span>
                  </span>
                  <span v-if="item.loopInfo" class="info-text">
                    <span class="info-label">loopInfo:</span>
                    <span class="info-value" :title="item.loopInfo">{{ item.loopInfo }}</span>
                  </span>
                  <span v-if="item.execTimestamp" class="info-text">
                    <span class="info-label">execTimestamp:</span>
                    <span class="info-value" :title="item.execTimestamp">{{ item.execTimestamp }}</span>
                  </span>
                </div>
                <span v-if="item.compareRes === 'Fail'" :class="['fail-tag', isFirstFail(item.id) && 'first-fail']">
                  <img :src="failIconPath" class="fail-icon" />
                  {{ isFirstFail(item.id) ? '1st Fail' : 'Fail' }}
                </span>
                <i :class="['expand-icon', expandedItems.includes(item.id) ? 'icon-chevron-down' : 'icon-chevron-right']"></i>
              </div>
              <div v-if="expandedItems.includes(item.id)" class="box-content">
                <div class="data-columns">
                  <div
                    :class="[
                      'left-column',
                      selectedItemId === item.id && selectedSource === 'left' && 'active',
                    ]"
                    @click="onItemClick(item, 'left')"
                  >
                    <div class="column-content two-columns">
                      <div class="column-left">
                        <div class="data-row" v-for="key in leftDetailFieldsFirst" :key="key">
                          <span class="data-label">{{ getLeftLabelName(key) }}:</span>
                          <span class="data-value" :title="getLeftDetailValue(item, key)">{{ getLeftDetailValue(item, key) }}</span>
                        </div>
                      </div>
                      <div class="column-right">
                        <div class="data-row" v-for="key in leftDetailFieldsSecond" :key="key">
                          <span class="data-label">{{ getLeftLabelName(key) }}:</span>
                          <span class="data-value" :title="getLeftDetailValue(item, key)">{{ getLeftDetailValue(item, key) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    :class="[
                      'right-column',
                      selectedItemId === item.id && selectedSource === 'right' && 'active',
                    ]"
                    @click="onItemClick(item, 'right')"
                  >
                    <div class="column-content two-columns">
                      <div class="column-left">
                        <div class="data-row" v-for="key in rightDetailFieldsFirst" :key="key">
                          <span class="data-label">{{ getRightLabelName(key) }}:</span>
                          <span class="data-value" :title="getRightDetailValue(item, key)">{{ getRightDetailValue(item, key) }}</span>
                        </div>
                      </div>
                      <div class="column-right">
                        <div class="data-row" v-for="key in rightDetailFieldsSecond" :key="key">
                          <span class="data-label">{{ getRightLabelName(key) }}:</span>
                          <span class="data-value" :title="getRightDetailValue(item, key)">{{ getRightDetailValue(item, key) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="props.loading" class="loading-indicator">
          <d-loading loadingType="spinner" size="sm"></d-loading>
          <span class="loading-text">{{ t('taskCheck.loadingMore') }}</span>
        </div>
        <div v-else-if="!props.hasMore" class="no-more-data">
          {{ t('taskCheck.noMoreData') }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import MultiFilterSearch, { type FilterParams } from './MultiFilterSearch.vue';

export interface TaskDiffItem {
  id: string;
  taskName: string;
  compareRes: 'Pass' | 'Fail';
  opMagic?: string;
  rawMagic?: string;
  ioFlag?: string;
  funcHash?: string;
  loopInfo?: string;
  execTimestamp?: string;
  aData: {
    validShape?: string;
    dataType?: string;
    rootFuncHash?: string;
    format?: string;
    magic?: string;
    opcode?: string;
    opMagic?: string;
    symbol?: string;
    dynvalidshape?: string;
    opAttrAtomic?: string;
    funcHash?: string;
    pathHash?: string;
    opAttrSymOffset?: string;
    rawMagic?: string;
  };
  bData: {
    taskId?: string;
    validShape?: string;
    rawShape?: string;
    tensorAddr?: string;
    dataType?: string;
    seqNo?: string;
    blockIdx?: string;
    opAttrSymOffset?: string;
  };
  sharedRes?: Record<string, any>;
  rawAOp?: Record<string, any>;
  rawTaskOp?: Record<string, any>;
}

const props = defineProps({
  taskTitle: {
    type: String,
    default: 'Task Check',
  },
  leftTitle: {
    type: String,
    default: 'CodegenPreproc',
  },
  rightTitle: {
    type: String,
    default: 'task_dump',
  },
  dataList: {
    type: Array as PropType<TaskDiffItem[]>,
    default: () => [],
  },
  hasMore: {
    type: Boolean,
    default: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  initialLoading: {
    type: Boolean,
    default: false,
  },
});

const emits = defineEmits(['loadMore', 'item-click', 'filter-change']);

const { t } = useI18n();
const scrollContainerRef = ref<HTMLElement>();
const multiFilterSearchRef = ref<{ reset: () => void } | null>(null);
const selectedItemId = ref<string>('');
const selectedSource = ref<'left' | 'right' | ''>('');
const filterAll = ref(true);
const filterFailOnly = ref(false);
const filterPassOnly = ref(false);
const expandedItems = ref<string[]>([]);
// 保存当前筛选条件
const currentFilterParams = ref<FilterParams>({});

const failIconPath = `${(window as any).staticPath}/static-assets/accurancy-abnormal.svg`;

const filteredList = computed(() => props.dataList);

const firstFailId = computed(() => {
  const firstFail = props.dataList.find((item) => item.compareRes === 'Fail');
  return firstFail?.id || '';
});

const isFirstFail = (id: string) => {
  return id === firstFailId.value;
};

// 左列字段（a列）- 分成两列
const leftDetailFieldsFirst = ['dataType', 'validShape', 'opAttrSymOffset', 'rootFuncHash', 'format', 'magic', 'opcode'];
const leftDetailFieldsSecond = ['opMagic', 'symbol', 'dynvalidshape', 'opAttrAtomic', 'funcHash', 'pathHash', 'rawMagic'];

const leftLabelNameMap: Record<string, string> = {
  validShape: 'validShape',
  dataType: 'dataType',
  rootFuncHash: 'RootFuncHash',
  format: 'Format',
  magic: 'Magic',
  opcode: 'Opcode',
  opMagic: 'OpMagic',
  symbol: 'Symbol',
  dynvalidshape: 'DynValidShape',
  opAttrAtomic: 'OpAttrAtomic',
  funcHash: 'FuncHash',
  pathHash: 'PathHash',
  opAttrSymOffset: 'OpAttrSymOffset',
  rawMagic: 'RawMagic',
};

const getLeftLabelName = (key: string) => {
  return leftLabelNameMap[key] || key;
};

const getLeftDetailValue = (item: TaskDiffItem, key: string) => {
  return item.aData?.[key as keyof typeof item.aData] || '-';
};

// 右列字段（b列）- 分成两列
const rightDetailFieldsFirst = ['taskId', 'validShape', 'rawShape', 'blockIdx'];
const rightDetailFieldsSecond = ['tensorAddr', 'dataType', 'seqNo', 'opAttrSymOffset'];

const rightLabelNameMap: Record<string, string> = {
  taskId: 'taskId',
  validShape: 'validShape',
  rawShape: 'rawShape',
  tensorAddr: 'tensorAddr',
  dataType: 'dataType',
  seqNo: 'seqNo',
  blockIdx: 'blockIdx',
  opAttrSymOffset: 'OpAttrSymOffset',
};

const getRightLabelName = (key: string) => {
  return rightLabelNameMap[key] || key;
};

const getRightDetailValue = (item: TaskDiffItem, key: string) => {
  return item.bData?.[key as keyof typeof item.bData] || '-';
};

const onMultiFilterChange = (params: FilterParams) => {
  // 保存筛选条件
  currentFilterParams.value = params;
  emitFilterChange();
};

const emitFilterChange = () => {
  let res: string | undefined;
  if (filterFailOnly.value) {
    res = 'FAIL';
  } else if (filterPassOnly.value) {
    res = 'PASS';
  }
  emits('filter-change', {
    keyword: undefined,
    res,
    ...currentFilterParams.value,
  });
};

const onFilterAllChange = () => {
  if (filterAll.value) {
    filterFailOnly.value = false;
    filterPassOnly.value = false;
  } else {
    if (!filterFailOnly.value && !filterPassOnly.value) {
      filterAll.value = true;
    }
  }
  emitFilterChange();
};

const onFilterFailChange = () => {
  if (filterFailOnly.value) {
    filterAll.value = false;
    filterPassOnly.value = false;
  } else {
    if (!filterAll.value && !filterPassOnly.value) {
      filterFailOnly.value = true;
    }
  }
  emitFilterChange();
};

const onFilterPassChange = () => {
  if (filterPassOnly.value) {
    filterAll.value = false;
    filterFailOnly.value = false;
  } else {
    if (!filterAll.value && !filterFailOnly.value) {
      filterPassOnly.value = true;
    }
  }
  emitFilterChange();
};

const toggleExpand = (id: string) => {
  const index = expandedItems.value.indexOf(id);
  if (index > -1) {
    expandedItems.value.splice(index, 1);
  } else {
    expandedItems.value.push(id);
  }
};

const onItemClick = (item: TaskDiffItem, source: 'left' | 'right') => {
  if (selectedItemId.value === item.id && selectedSource.value === source) {
    selectedItemId.value = '';
    selectedSource.value = '';
    emits('item-click', { data: null, source: null });
  } else {
    selectedItemId.value = item.id;
    selectedSource.value = source;
    emits('item-click', { data: item, source });
  }
};

let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastLoadMoreTime = 0;

const checkAndLoadMore = () => {
  if (!scrollContainerRef.value || props.loading || props.initialLoading || !props.hasMore) return;
  const element = scrollContainerRef.value;
  const { scrollHeight, scrollTop, clientHeight } = element;
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;

  const now = Date.now();
  if (now - lastLoadMoreTime < 500) return;

  if (distanceToBottom < 20) {
    lastLoadMoreTime = now;
    emits('loadMore');
  }
};

const onScroll = () => {
  if (scrollDebounceTimer) {
    clearTimeout(scrollDebounceTimer);
  }
  scrollDebounceTimer = setTimeout(checkAndLoadMore, 100);
};

onMounted(() => {
  setTimeout(checkAndLoadMore, 100);
});

onUnmounted(() => {
  if (scrollDebounceTimer) {
    clearTimeout(scrollDebounceTimer);
  }
});

watch(
  () => props.dataList,
  (newList, oldList) => {
    expandedItems.value = [];
    if (!oldList || newList.length <= oldList.length) {
      selectedItemId.value = '';
      selectedSource.value = '';
    }
    setTimeout(checkAndLoadMore, 100);
  },
);

const clearSelection = () => {
  selectedItemId.value = '';
  selectedSource.value = '';
};

const resetFilter = () => {
  multiFilterSearchRef.value?.reset();
  filterAll.value = true;
  filterFailOnly.value = false;
  filterPassOnly.value = false;
  currentFilterParams.value = {};
};

defineExpose({
  clearSelection,
  resetFilter,
});
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.task-diff-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--control-flow-bg);

  .task-diff-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    gap: 8px;
    border-bottom: 1px solid var(--devui-split-line);
    background: var(--control-flow-bg);

    .header-left {
      color: var(--devui-title-text);
      display: flex;
      align-items: center;
      font-size: 14px;
      font-weight: 500;

      .task-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--devui-title-text);
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;

      d-search {
        width: 200px;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 12px;

        d-checkbox {
          font-size: 12px;
          color: var(--devui-primary-text);
        }
      }
    }
  }

  .task-name-bar {
    display: flex;
    width: calc(100% - 8px);
    align-items: center;
    border-bottom: 1px solid var(--devui-split-line);
    position: relative;
    height: 36px;
    scrollbar-gutter: stable;

    .task-name-left {
      height: 100%;
      width: 50%;
      min-width: 0;
      display: flex;
      align-items: center;
      padding-left: 12px;
      border-right: 2px solid var(--devui-split-line);
    }

    .task-name-right {
      height: 100%;
      width: 50%;
      min-width: 0;
      display: flex;
      align-items: center;
      padding-left: 12px;
    }

    .task-name-text {
      font-size: 14px;
      font-weight: 700;
      color: var(--devui-title-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .task-diff-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .initial-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;

    .loading-text {
      font-size: 14px;
      color: var(--devui-secondary-text);
    }
  }

  .empty-data {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;

    .empty-text {
      font-size: 14px;
      color: var(--devui-secondary-text);
    }
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    gap: 8px;

    .loading-text {
      font-size: 13px;
      color: var(--devui-secondary-text);
    }
  }

  .no-more-data {
    text-align: center;
    padding: 16px;
    font-size: 13px;
    color: var(--devui-secondary-text);
  }

  .task-list {
    padding: 12px;
  }

  .task-row {
    margin-bottom: 12px;

    .task-box {
      border-radius: 8px;
      background: var(--task-diff-collapse-bg);
      overflow: hidden;

      &.has-selection {
        background: var(--task-diff-expanded-bg);
      }

      .box-header {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        cursor: pointer;
        position: relative;

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 50%;
          background-image: radial-gradient(circle, var(--devui-split-line) 1.5px, transparent 1.5px);
          background-size: 4px 4px;
          -webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%),
            linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
          mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%),
            linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
          -webkit-mask-composite: source-in;
          mask-composite: intersect;
          pointer-events: none;
        }

        .header-left {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          overflow: hidden;

          .task-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--devui-primary-text);
            flex-shrink: 0;
          }

          .info-text {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            overflow: hidden;
            max-width: 200px;
            color: var(--task-diff-header-label-text);

            .info-label {
              font-size: 13px;
              color: var(--task-diff-header-label-text);
            }

            .info-value {
              font-size: 13px;
              color: var(--task-diff-header-value-text);
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 120px;
            }
          }
        }

        .fail-tag {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          color: rgba(238, 105, 111, 1);
          font-size: 12px;
          font-weight: 400;
          line-height: 1;
          border-radius: 4px;
          background: rgba(238, 105, 111, 0.2);
          margin-left: 12px;
          margin-right: 12px;
          flex-shrink: 0;

          .fail-icon {
            width: 14px;
            height: 14px;
            margin-right: 4px;
            filter: brightness(0) saturate(100%) invert(51%) sepia(93%) saturate(2062%) hue-rotate(331deg) brightness(98%) contrast(95%);
          }

          &.first-fail {
            color: rgba(238, 105, 111, 1);
            background: rgba(238, 105, 111, 0.2);
          }
        }

        .expand-icon {
          font-size: 14px;
          color: var(--devui-secondary-text);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
      }

      .box-content {
        padding: 16px;
        background: var(--devui-secondary-bg);
        overflow-x: auto;

        .data-columns {
          display: flex;
          gap: 16px;
          min-width: 600px;

          .left-column,
          .right-column {
            flex: 1;
            min-width: 280px;
            border-radius: 8px;
            border: 2px solid transparent;
            padding: 12px;
            cursor: pointer;
            background: var(--task-diff-item-bg);

            &.active {
              border: 2px solid var(--devui-brand);
              background: var(--task-diff-item-active-bg);

              .data-label {
                color: var(--task-diff-header-label-text);
              }

              .data-value {
                color: var(--task-diff-header-value-text);
              }
            }

            .column-content {
              .data-row {
                display: flex;
                align-items: center;
                padding: 4px 0;

                .data-label {
                  width: 100px;
                  flex-shrink: 0;
                  font-size: 12px;
                  color: var(--devui-secondary-text);
                }

                .data-value {
                  flex: 1;
                  min-width: 0;
                  font-size: 12px;
                  color: var(--devui-primary-text);
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
              }

              &.two-columns {
                display: flex;
                gap: 16px;

                .column-left,
                .column-right {
                  flex: 1;
                  min-width: 0;
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>