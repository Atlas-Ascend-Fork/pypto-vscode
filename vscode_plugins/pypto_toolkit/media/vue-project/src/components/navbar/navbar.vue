<template>
  <div class="navbar-container">
    <div class="history-wrap">
      <div class="history-icon">
        <i class="icon-assembly-new"></i>
      </div>
      <HistoryList />
    </div>
    <div class="dividing-line"></div>
    <div class="navbar-list">
      <d-tooltip :content="t('jumpCodeTips')" position="bottom" overlay-class="navbar-list-tooltip">
        <div class="source-code">
          <i class="icon-code"></i>
        </div>
      </d-tooltip>
      <ThreeDot dot-color="var(--devui-placeholder-icon)" />
      <div :class="['control-flow', currentStep === 'controlFlow' && 'active']">
        <i class="icon-sharing"></i>
        <span v-if="currentStep === 'controlFlow'">{{ t('controlFlow') }}</span>
      </div>
      <ThreeDot dot-color="var(--devui-placeholder-icon)" />
      <div :class="['com-graph', currentStep === 'comGraph' && 'active']">
        <i class="icon-base-info"></i>
        <PathList v-if="currentStep === 'comGraph'" />
        <div v-if="currentStep === 'comGraph'" class="pass-leaf-wrap">
          <PassList />
          <div class="dividing-line"></div>
          <LeafFunctionCom />
        </div>
      </div>
      <ThreeDot dot-color="var(--devui-placeholder-icon)" />
      <div class="swim-graph">
        <i class="icon-project-nav"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { navbarProps } from './navbar-types';
import PathList from './pathList.vue';
import LeafFunctionCom from './leafFunction.vue';
import PassList from './passList.vue';
import HistoryList from './historyList.vue';
import ThreeDot from './threeDot.vue';
import { NavbarProvideKey } from './navbar-types';
import type { HistoryData, ControlFlowData, NavbarEmits } from './navbar-types';
import type { PathInPass, LeafFunction } from '../../../../../src/types/control-flow/path';
import { getOutputRecords } from '../../apis/workspace';
import { getControlFlow } from '../../apis/control-flow';

const { t } = useI18n();
const props = defineProps(navbarProps);
const emits = defineEmits<NavbarEmits>();
const historyList = ref<HistoryData[]>([]);
const controlFlowList = ref<ControlFlowData[]>([]);
const passList = ref<PathInPass[]>([]);
const leafFunctions = ref<LeafFunction[]>([]);

provide(NavbarProvideKey, { rootProps: props, rootEmits: emits, historyList, controlFlowList, passList, leafFunctions });

getOutputRecords({}).then((res) => {
  historyList.value = res.data;
});

watch(
  () => props.currentRecordDirectoryPath,
  (val) => {
    if (val) {
      getControlFlow(val).then((res) => {
        controlFlowList.value = res.data;
      });
    }
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.navbar-container {
  display: flex;
  align-items: center;
  gap: 16px;
  height: fit-content;
  margin-top: 16px;
  margin-left: 16px;
  box-sizing: border-box;

  .history-wrap {
    display: flex;
    gap: 8px;

    .history-icon {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      color: #ffffff;
      font-size: 32px;
      border-radius: 40px;
      background-color: #5f58c7;
    }
  }

  .dividing-line {
    width: 1px;
    height: 24px;
    background-color: var(--devui-split-line);
  }

  .navbar-list {
    display: flex;
    align-items: center;
    gap: 4px;

    .source-code,
    .control-flow,
    .com-graph,
    .swim-graph {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      border-radius: 24px;
      border: 1px solid var(--devui-placeholder-text);
      box-sizing: border-box;

      i {
        color: var(--devui-placeholder-text);
        font-size: 16px;
        margin-left: 1px;
      }
    }

    .control-flow,
    .com-graph {
      i {
        margin-left: 0;
        font-size: 14px;
      }
    }

    .control-flow.active {
      width: auto;
      padding: 0 8px;
      gap: 4px;
      border-color: 1px solid var(--devui-primary-text);

      i {
        color: var(--devui-primary-text);
      }

      span {
        font-size: 12px;
        color: var(--devui-primary-text);
        line-height: 18px;
      }
    }

    .com-graph.active {
      width: auto;
      height: 40px;
      gap: 8px;
      padding-left: 8px;
      border-radius: 36px;
      border-color: transparent;
      background-color: var(--devui-secondary-button-bg);

      .pass-leaf-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 40px;
        border: 1px solid var(--devui-primary-text);
        box-sizing: border-box;
        padding: 8px;
        border-radius: 40px;
      }
    }
  }
}
</style>

<style lang="scss">
.navbar-list-tooltip.devui-tooltip {
  max-width: 300px;
}
</style>
