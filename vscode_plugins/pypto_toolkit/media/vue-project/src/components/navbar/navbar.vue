<template>
  <div class="navbar-container">
    <div class="history-wrap">
      <div class="history-icon">
        <HistoryIcon />
      </div>
      <HistoryList ref="historyListEl" @record-change="onRecordChange" />
    </div>
    <div class="dividing-line"></div>
    <div class="navbar-list">
      <d-tooltip :content="t('jumpCodeTips')" position="bottom" overlay-class="navbar-list-tooltip">
        <div class="source-code">
          <i class="icon-code"></i>
        </div>
      </d-tooltip>
      <ThreeDot dot-color="var(--devui-placeholder-icon)" />
      <div :class="['control-flow', currentStep === 'controlFlow' && 'active']" @click="jumpControlFlow">
        <i class="icon-sharing"></i>
        <span v-if="currentStep === 'controlFlow'">{{ t('controlFlow') }}</span>
      </div>
      <ThreeDot dot-color="var(--devui-placeholder-icon)" />
      <div :class="['com-graph', currentStep === 'comGraph' && 'active']" @click="onJumpCom">
        <i class="icon-base-info"></i>
        <PathList v-if="currentStep === 'comGraph'" />
        <div v-if="currentStep === 'comGraph'" class="pass-leaf-wrap">
          <PassList ref="passEl" />
          <div v-if="leafFunctions.length" class="dividing-line"></div>
          <LeafFunctionCom v-if="leafFunctions.length" />
        </div>
      </div>
      <ThreeDot v-if="showSwim" dot-color="var(--devui-placeholder-icon)" />
      <div v-if="showSwim" class="swim-graph" @click="jumpSwim">
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
import HistoryIcon from './icons/history-icon.vue';
import { NavbarProvideKey } from './navbar-types';
import type { HistoryData, ControlFlowData } from './navbar-types';
import type { PathInPass, LeafInPass } from '../../../../../src/types/control-flow/path';
import { getOutputRecords } from '../../apis/workspace';
import { getControlFlow } from '../../apis/control-flow';
import { openControlFlow, openSwimlaneGraph, openComputeGraph } from '../../apis/opener';
import { findFirstPath } from './util';

const { t } = useI18n();
const props = defineProps(navbarProps);
const emits = defineEmits(['leafChange']);
const historyListEl = ref();
const passEl = ref();
const historyList = ref<HistoryData[]>([]);
const controlFlowList = ref<ControlFlowData[]>([]);
const passList = ref<PathInPass[]>([]);
const leafFunctions = ref<LeafInPass[]>([]);
const currentRecord = ref<HistoryData>();
const showSwim = ref(true);
const getControlFlowError = ref(false);

provide(NavbarProvideKey, { rootProps: props, historyList, controlFlowList, passList, leafFunctions, jumpComGraph, emitLeafChange });

getOutputRecords({}, { timeout: 600000 }).then((res) => {
  historyList.value = res.data;
});

watch(
  [() => props.currentRecordDirectoryPath, currentRecord],
  ([outputDirPath, record]) => {
    if (outputDirPath && record && props.currentStep !== 'controlFlow') {
      getControlFlow({ outputDirPath, controlFlowFilePath: record.controlFlowFilePath }, { timeout: 600000, useCustomErrorHandler: true })
        .then((res) => {
          controlFlowList.value = res.data;
        })
        .catch(() => {
          getControlFlowError.value = true;
        });
    }
  },
  { immediate: true },
);

watch(
  () => props.controlFlowData,
  (val) => {
    if (val) {
      if (val.length > 0) {
        controlFlowList.value = val;
      }
    }
  },
  { immediate: true },
);

function emitLeafChange(leafName: string) {
  emits('leafChange', leafName);
}

function onRecordChange(record: HistoryData) {
  currentRecord.value = record;
  showSwim.value = Boolean(record.swimlaneGraphFilePath);
}

function onJumpCom() {
  if (props.currentStep === 'comGraph') {
    return;
  }
  const firstPath = findFirstPath(controlFlowList.value);
  if (firstPath) {
    const lastPass = firstPath.meta.passes[firstPath.meta.passes.length - 1];
    jumpComGraph(lastPass.graphFilePath, lastPass.pathName);
  }
}

function jumpControlFlow() {
  if (historyListEl.value) {
    const record = historyListEl.value.getCurrentRecord() as HistoryData;
    if (record.directoryPath) {
      openControlFlow({ outputPath: record.directoryPath, controlFlowPath: record.controlFlowFilePath });
    }
  }
}

function jumpSwim() {
  if (historyListEl.value) {
    const record = historyListEl.value.getCurrentRecord() as HistoryData;
    if (record.directoryPath) {
      openSwimlaneGraph({ swimlaneGraphPath: record.swimlaneGraphFilePath });
    }
  }
}

function jumpComGraph(filePath: string, pathName?: string) {
  if (historyListEl.value) {
    const record = historyListEl.value.getCurrentRecord() as HistoryData;
    if (!pathName) {
      pathName = (passEl.value?.getCurrentPass() as PathInPass | undefined)?.pathName ?? '';
    }
    if (record.directoryPath) {
      openComputeGraph({ outputPath: record.directoryPath, computeGraphPath: filePath, pathName });
    }
  }
}
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
      pointer-events: all;

      i {
        color: var(--devui-placeholder-text);
        font-size: 16px;
        margin-left: 1px;
      }
    }

    .swim-graph {
      cursor: pointer;
    }

    .control-flow,
    .com-graph {
      &:not(.active) {
        cursor: pointer;
      }

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
  max-width: 230px;
}
</style>
