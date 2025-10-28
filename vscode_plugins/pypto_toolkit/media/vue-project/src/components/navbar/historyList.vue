<template>
  <div class="selected-history">
    <d-dropdown :position="['bottom-start']" :offset="20" @toggle="(val) => (isOpen = val)">
      <div :class="['selected-history-title', isOpen && 'is-open']">
        <span :title="currentData.title">{{ currentData.title }}</span>
        <i class="icon-chevron-down-2"></i>
      </div>
      <template #menu>
        <div class="navbar-history-list">
          <div
            v-for="item in historyList"
            :key="item.title"
            :class="['list-item', item.title === currentData.title && 'active']"
            @click="() => onClick(item)"
          >
            <div :title="item.title">{{ item.title }}</div>
            <div>{{ item.executeTime }}</div>
          </div>
        </div>
      </template>
    </d-dropdown>
    <div class="selected-history-date">{{ currentData.executeTime }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { NavbarProvideKey } from './navbar-types';
import type { NavbarContext, HistoryData } from './navbar-types';
import { openControlFlow } from '../../apis/opener';

const emits = defineEmits(['recordChange']);

const { rootProps, historyList } = inject(NavbarProvideKey) as NavbarContext;
const isOpen = ref(false);

const currentData = computed<Partial<HistoryData>>(() => {
  if (rootProps.currentRecordDirectoryPath) {
    for (let i = 0; i < historyList.value.length; i++) {
      const item = historyList.value[i];
      if (item.directoryPath === rootProps.currentRecordDirectoryPath) {
        emits('recordChange', item);
        return item;
      }
    }
  }
  return {};
});

function onClick(item: HistoryData) {
  openControlFlow({ outputPath: item.directoryPath, controlFlowPath: item.controlFlowFilePath });
}

defineExpose({ getCurrentRecord: () => currentData.value });
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.selected-history {
  .selected-history-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: bold;
    line-height: 22px;
    color: var(--devui-primary-text);

    span {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }

    i {
      font-size: 16px;
      font-weight: bold;
      color: var(--devui-primary-text);
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
  padding: 8px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;
  overflow: auto;

  .list-item {
    height: 50px;
    padding: 4px 8px;
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
