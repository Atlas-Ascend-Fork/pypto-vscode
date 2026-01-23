<template>
  <div class="selected-history">
    <d-dropdown :position="['bottom-start']" :offset="20" class="history-list-menu-wrap" @toggle="(val) => (isOpen = val)">
      <div :class="['selected-history-title', isOpen && 'is-open']">
        <span :title="baseChoose || t('pleaseSelectResult')">{{ baseChoose || t('pleaseSelectResult') }}</span>
        <i class="icon-chevron-down-2"></i>
      </div>
      <template #menu>
        <div class="navbar-history-list pypto-scrollbar">
          <div
            v-for="item in historyList"
            :key="item.title"
            :class="['list-item', item.title === baseChoose && 'active']"
            @click="() => onClick(item)"
          >
            <div :title="item.title">{{ item.title }}</div>
            <div>{{ item.executeTime }}</div>
          </div>
          <LoadMoreTrigger v-show="page > 1 || !allLoaded" :all-loaded="allLoaded" @load-more="handleLoadMore" />
        </div>
      </template>
    </d-dropdown>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import type { HistoryData } from '../navbar/navbar-types';
import LoadMoreTrigger from '../util/LoadMoreTrigger.vue';
import { useViewServer } from '@/core/use-view-server';
import { getRunDataList } from '@/apis/workspace';
import { ICommonViewServer } from 'ext:\/view/servers/view-server-interface';

const { t } = useI18n();
const { baseChoose } = inject('runDataList');
const historyList = ref<HistoryData[]>([]);
const page = ref(0);
const pageSize = 50;
const allLoaded = ref(false);
const swimPath = ref('');
const comPath = ref(''); 

const isOpen = ref(false);

const { server } = useViewServer<ICommonViewServer>();

let isPending = false;
function handleLoadMore() {
  if (isPending === true) {
    return;
  }
  page.value += 1;
  getHistoryList();
};

function getHistoryList() {
  isPending = true;
  getRunDataList({ page: page.value, pageSize , isThreeColumnNotNull: true}, { timeout: 600000 }).then(({ data }) => {
    if (data.length < pageSize) {
      allLoaded.value = true;
    }
    historyList.value.push(...data);
    isPending = false;
  });
};

async function onClick(item: HistoryData) {
  swimPath.value = item.swimlaneGraphFilePath.substring(1).replace(/\//g, '\\');
  comPath.value = item.controlFlowFilePath.substring(1).replace(/\//g, '\\');
  if (!swimPath.value || !comPath.value) {
    return;
  }
  baseChoose.value = item.title;
  await server.selectRunData({runDataPaths: {swimPath: swimPath.value, comPath: comPath.value, runDataTitle: item.title}});
};

</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

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