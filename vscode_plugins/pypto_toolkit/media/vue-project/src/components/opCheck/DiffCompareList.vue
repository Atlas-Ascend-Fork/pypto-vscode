<template>
  <div class="diff-compare-container">
    <div class="diff-compare-header">
      <div class="header-left">
        <span class="file-name">{{ leftTitle }}</span>
        <i class="icon-arrow-right-l arrow-icon"></i>
        <span class="file-name">{{ rightTitle }}</span>
      </div>
      <div class="header-right">
        <d-search
          v-model="searchKeyword"
          is-keyup-search
          :show-glow-style="false"
          :placeholder="t('opCheck.searchOpName')"
          :disabled="props.initialLoading"
          @search="onSearch"
        />
        <div class="filter-group">
          <d-checkbox v-model="filterAll" :disabled="props.initialLoading" @change="onFilterAllChange">
            {{ t('opCheck.filterAll') }}
          </d-checkbox>
          <d-checkbox v-model="filterFailOnly" :disabled="props.initialLoading" @change="onFilterFailChange">
            {{ t('opCheck.filterFail') }}
          </d-checkbox>
          <d-checkbox v-model="filterPassOnly" :disabled="props.initialLoading" @change="onFilterPassChange">
            {{ t('opCheck.filterPass') }}
          </d-checkbox>
        </div>
      </div>
    </div>
    <div class="file-name-bar">
      <div class="file-name-left">
        <ComGraphIcon />
        <span class="file-name-text">{{ leftTitle }}</span>
      </div>
      <div class="file-name-right">
        <ComGraphIcon />
        <span class="file-name-text">{{ rightTitle }}</span>
      </div>
    </div>
    <div class="diff-compare-body" ref="scrollContainerRef" @scroll="onScroll">
      <!-- 初始加载状态 -->
      <div v-if="props.initialLoading" class="initial-loading">
        <d-loading loadingType="spinner" size="md"></d-loading>
        <span class="loading-text">{{ t('opCheck.loading') }}</span>
      </div>
      <!-- 空数据状态 -->
      <div v-else-if="!props.initialLoading && filteredList.length === 0" class="empty-data">
        <span class="empty-text">{{ t('opCheck.noData') }}</span>
      </div>
      <!-- 数据列表 -->
      <template v-else>
        <div class="diff-list">
          <div v-for="item in filteredList" :key="item.id" :class="['diff-row', expandedItems.includes(item.id) && 'expanded']">
            <div
              :class="[
                'left-column',
                selectedItemId === item.id && selectedSource === 'left' && 'active',
                expandedItems.includes(item.id) && 'expanded',
                !item.aOp && 'empty',
                item.aOp && !item.bOp && 'aop-only',
              ]"
              @click="onItemClick(item, 'left')"
            >
              <div class="item-header">
                <span class="op-name">{{ item.aOp?.aOpcode || '-' }}</span>
                <i
                  :class="['expand-icon', expandedItems.includes(item.id) ? 'icon-chevron-down' : 'icon-chevron-right']"
                  @click.stop="toggleExpand(item.id)"
                ></i>
              </div>
              <div v-if="expandedItems.includes(item.id)" class="item-detail">
                <div class="detail-row" v-for="key in detailFields" :key="key">
                  <span class="detail-label">{{ getLabelName(key) }}:</span>
                  <span class="detail-value" :title="(item.sharedRes as any)?.[key] || '-'">{{ (item.sharedRes as any)?.[key] || '-' }}</span>
                </div>
              </div>
            </div>
            <div
              :class="[
                'right-column',
                selectedItemId === item.id && selectedSource === 'right' && 'active',
                expandedItems.includes(item.id) && 'expanded',
                !item.bOp && 'empty',
                item.bOp && !item.aOp && 'bop-only',
              ]"
              @click="onItemClick(item, 'right')"
            >
              <div class="item-header">
                <span class="op-name">{{ item.bOp?.bOpcode || '-' }}</span>
                <span v-if="item.compareRes === 'Fail'" :class="['fail-tag', isFirstFail(item.id) && 'first-fail']">
                  <img :src="failIconPath" class="fail-icon" />
                  {{ isFirstFail(item.id) ? '1st Fail' : 'Fail' }}
                </span>
                <i
                  :class="['expand-icon', expandedItems.includes(item.id) ? 'icon-chevron-down' : 'icon-chevron-right']"
                  @click.stop="toggleExpand(item.id)"
                ></i>
              </div>
              <div v-if="expandedItems.includes(item.id)" class="item-detail">
                <div class="detail-row" v-for="key in detailFields" :key="key">
                  <span class="detail-label">{{ getLabelName(key) }}:</span>
                  <span class="detail-value" :title="(item.sharedRes as any)?.[key] || '-'">{{ (item.sharedRes as any)?.[key] || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="props.loading" class="loading-indicator">
          <d-loading loadingType="spinner" size="sm"></d-loading>
          <span class="loading-text">{{ t('opCheck.loadingMore') }}</span>
        </div>
        <div v-else-if="!props.hasMore" class="no-more-data">
          {{ t('opCheck.noMoreData') }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphIcon from '@/components/icons/com-graph-icon.vue';
export interface OpData {
  aFormat?: string;
  aFuncMagic?: string;
  aFuncHash?: string;
  aOpcode?: string;
  aOpMagic?: string;
  aPhaseName?: string;
  aRawShape?: string;
  aFileName?: string;
  bFormat?: string;
  bFuncMagic?: string;
  bFuncHash?: string;
  bOpcode?: string;
  bOpMagic?: string;
  bPhaseName?: string;
  bRawShape?: string;
  bFileName?: string;
}

export interface OpCompareItem {
  id: string;
  aOp: OpData | null;
  bOp: OpData | null;
  compareRes: 'Pass' | 'Fail';
  sharedRes?: {
    pathFuncMagicName?: string;
  };
}

const props = defineProps({
  leftTitle: {
    type: String,
    default: 'Base',
  },
  rightTitle: {
    type: String,
    default: 'Compare',
  },
  dataList: {
    type: Array as PropType<OpCompareItem[]>,
    default: () => [],
  },
  syncScroll: {
    type: Boolean,
    default: true,
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
const selectedItemId = ref<string>('');
const selectedSource = ref<'left' | 'right' | ''>('');
const searchKeyword = ref('');
const filterAll = ref(true);
const filterFailOnly = ref(false);
const filterPassOnly = ref(false);
const expandedItems = ref<string[]>([]);

const failIconPath = `${(window as any).staticPath}/static-assets/accurancy-abnormal.svg`;

const filteredList = computed(() => props.dataList);

const firstFailId = computed(() => {
  const firstFail = props.dataList.find((item) => item.compareRes === 'Fail');
  return firstFail?.id || '';
});

const isFirstFail = (id: string) => {
  return id === firstFailId.value;
};

const labelNameMap: Record<string, string> = {
  aFormat: 'Format',
  aFuncMagic: 'FuncMagic',
  aOpcode: 'Opcode',
  aOpMagic: 'OpMagic',
  aPhaseName: 'PhaseName',
  aRawShape: 'RawShape',
  aFileName: 'FileName',
  bFormat: 'Format',
  bFuncMagic: 'FuncMagic',
  bOpcode: 'Opcode',
  bOpMagic: 'OpMagic',
  bPhaseName: 'PhaseName',
  bRawShape: 'RawShape',
  bFileName: 'FileName',
  symbol: 'Symbol',
  loopInfo: 'LOOP_INFO',
  shape: 'Shape',
  validShape: 'ValidShape',
  dataType: 'DataType',
};

const getLabelName = (key: string) => {
  return labelNameMap[key] || key;
};

// 展开详情只显示这些字段
// const detailFields = ['symbol', 'loopInfo', 'shape', 'validShape', 'dataType'];
const detailFields = ['symbol', 'loopInfo', 'validShape', 'dataType'];

const onSearch = (value: string) => {
  searchKeyword.value = value;
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
    keyword: searchKeyword.value.trim() || undefined,
    res,
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

const onItemClick = (item: OpCompareItem, source: 'left' | 'right') => {
  // 如果点击的是已选中的项目，则取消选中
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
  if (!scrollContainerRef.value || props.loading || !props.hasMore ) return;
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
    // 只在数据被替换（非追加）时清除选中状态
    // 如果新列表长度小于等于旧列表，说明是替换而非追加
    if (!oldList || newList.length <= oldList.length) {
      selectedItemId.value = '';
      selectedSource.value = '';
    }
    setTimeout(checkAndLoadMore, 100);
  },
);

// 暴露清除选中状态的方法
const clearSelection = () => {
  selectedItemId.value = '';
  selectedSource.value = '';
};

defineExpose({
  clearSelection,
});
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.diff-compare-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--devui-tab-bg);

  .diff-compare-header {
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

      .arrow-icon {
        margin: 0 8px;
        color: var(--devui-secondary-text);
        font-size: 16px;
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

  .file-name-bar {
    display: flex;
    width: calc(100% - 8px);
    align-items: center;
    border-bottom: 1px solid var(--devui-split-line);
    position: relative;
    height: 36px;
    scrollbar-gutter: stable;

    .file-name-left {
      height: 100%;
      width: 50%;
      display: flex;
      align-items: center;
      padding-left: 12px;
      border-right: 2px solid var(--devui-split-line);
    }

    .file-name-right {
      height: 100%;
      width: 50%;
      display: flex;
      align-items: center;
      padding-left: 12px;
    }

    .file-name-text {
      font-size: 14px;
      font-weight: 700;
      color: var(--devui-title-text);
      margin-left: 8px;
    }
  }

  .diff-compare-body {
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

  .diff-row {
    display: flex;
    transition: background-color $devui-animation-duration-fast $devui-animation-ease-in-out-smooth;
    padding: 0 12px;
    position: relative;
    width: 100%;

    // 中间分割线
    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--devui-split-line);
      transform: translateX(-50%);
      pointer-events: none;
    }

    .left-column.active,
    .right-column.active {
      border: 2px solid var(--devui-brand);
    }

    .left-column {
      width: 50%;
      min-height: 36px;
      margin: 3px 0;
      margin-right: 12px;
      border-radius: 8px;
      border: 2px solid transparent;
      min-width: 0;
      background: var(--control-flow-bg);
      position: relative;
      overflow: scroll;
      &::-webkit-scrollbar {
        height: 4px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        border-radius: 999px;
      }

      &.expanded {
        background: rgba(49, 122, 247, 0.16);
      }

      &.empty {
        background: var(--control-flow-bg);

        &.expanded {
          background: var(--control-flow-bg);
        }
      }

      &.aop-only {
        background: rgba(231, 67, 74, 0.12);

        &.expanded {
          background: rgba(231, 67, 74, 0.12);
        }
      }
    }

    .right-column {
      width: 50%;
      min-height: 36px;
      margin: 3px 0;
      margin-left: 12px;
      border-radius: 8px;
      border: 2px solid transparent;
      min-width: 0;
      background: var(--control-flow-bg);
      overflow: scroll;
      &::-webkit-scrollbar {
        height: 4px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        border-radius: 999px;
      }

      &.expanded {
        background: rgba(49, 122, 247, 0.16);
      }

      &.empty {
        background: var(--control-flow-bg);

        &.expanded {
          background: var(--control-flow-bg);
        }
      }

      &.bop-only {
        background: rgba(218, 219, 129, 0.12);

        &.expanded {
          background: rgba(218, 219, 129, 0.12);
        }
      }
    }

    .item-header {
      display: flex;
      align-items: center;
      height: 36px;
      padding: 0 16px;
      font-size: 13px;
      font-weight: 700;
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

      .op-name {
        font-size: 13px;
        color: var(--devui-primary-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
        margin-left: 8px;
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
        margin-left: auto;
      }
    }

    .left-column.expanded .item-header::before,
    .right-column.expanded .item-header::before {
      display: none;
    }

    .item-detail {
      padding: 8px 16px;
      border-radius: 8px;
      background: var(--control-flow-item-detail-bg);
      margin: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 0 16px;
      overflow: hidden;
      min-width: 350px;
      overflow-x: scroll;

      .detail-row {
        display: flex;
        align-items: center;
        padding: 4px 0;
        width: calc(50% - 8px);
        min-width: 0;
        overflow: hidden;
        box-sizing: border-box;

        &:nth-child(odd) {
          border-right: 2px solid var(--devui-split-line);
        }

        .detail-label {
          width: 100px;
          flex-shrink: 0;
          font-size: 12px;
          color: var(--devui-secondary-text);
        }

        .detail-value {
          flex: 1;
          min-width: 0;
          font-size: 12px;
          color: var(--devui-primary-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }
  }
}
</style>