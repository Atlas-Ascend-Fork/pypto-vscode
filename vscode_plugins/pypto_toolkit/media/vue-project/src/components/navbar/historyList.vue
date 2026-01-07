<template>
  <div class="selected-history">
    <d-dropdown :position="['bottom-start']" :offset="20" class="history-list-menu-wrap" @toggle="(val) => (isOpen = val)">
      <div :class="['selected-history-title', isOpen && 'is-open']">
        <span :title="currentRecord.title">{{ currentRecord.title }}</span>
        <i class="icon-chevron-down-2"></i>
      </div>
      <template #menu>
        <div class="navbar-history-list pypto-scrollbar">
          <div
            v-for="item in historyList"
            :key="item.title"
            :class="['list-item', item.title === currentRecord.title && 'active']"
            @click="() => onClick(item)"
          >
            <div :title="item.title">{{ item.title }}</div>
            <div>{{ item.executeTime }}</div>
          </div>
          <LoadMoreTrigger v-show="page > 1 || !allLoaded" :all-loaded="allLoaded" @load-more="handleLoadMore" />
        </div>
      </template>
    </d-dropdown>
    <div class="selected-history-date">{{ currentRecord.executeTime }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { HistoryData } from './navbar-types';
import { openControlFlow } from '../../apis/opener';
import LoadMoreTrigger from '../util/LoadMoreTrigger.vue';
import { OutputRecord } from 'ext:/types/workspace';
import { useViewServer } from '@/core/use-view-server';
import { getRunDataList } from '@/apis/workspace';

withDefaults(
  defineProps<{
    currentRecord?: Pick<OutputRecord, 'title' | 'executeTime'>;
  }>(),
  { currentRecord: () => ({ title: '', executeTime: '' }) },
);

const historyList = ref<HistoryData[]>([]);
const page = ref(0);
const pageSize = 50;
const allLoaded = ref(false);

let isPending = false;
function handleLoadMore() {
  if (isPending === true) {
    return;
  }
  page.value += 1;
  getHistoryList();
}
function getHistoryList() {
  isPending = true;
  getRunDataList({ page: page.value, pageSize }, { timeout: 600000 }).then(({ data }) => {
    if (data.length < pageSize) {
      allLoaded.value = true;
    }
    historyList.value.push(...data);
    isPending = false;
  });
}

const isOpen = ref(false);
const { server } = useViewServer();

function onClick(item: HistoryData) {
  openControlFlow({ outputPath: item.directoryPath, controlFlowPath: item.controlFlowFilePath }).then(() => {
    server.closeWebview();
  });
}
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.selected-history {
  min-width: 170px;

  .selected-history-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: bold;
    line-height: 22px;
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

  .selected-history-date {
    font-size: 12px;
    line-height: 18px;
    color: var(--devui-placeholder-text);
  }
}

.navbar-history-list {
  max-width: 300px;
  max-height: 400px;
  overflow: auto;

  .list-item {
    height: 58px;
    padding: 8px;
    border-radius: 4px;
    box-sizing: border-box;
    cursor: pointer;

    &:not(:last-of-type) {
      margin-bottom: 4px;
    }

    &.active {
      background-color: var(--devui-input-active-bg);
    }

    &:not(.active):hover {
      background-color: var(--devui-input-hover-bg);
    }

    div:nth-of-type(1) {
      max-width: 100%;
      font-size: 14px;
      line-height: 22px;
      color: var(--devui-primary-text);
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    div:nth-of-type(2) {
      font-size: 12px;
      line-height: 18px;
      color: var(--devui-secondary-text);
    }
  }
}
</style>

<style lang="scss">
.devui-flexible-overlay:has(.history-list-menu-wrap) {
  border-radius: 8px;
  box-shadow: var(--devui-select-shadow);
}
.history-list-menu-wrap {
  padding: 8px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;
}
</style>
