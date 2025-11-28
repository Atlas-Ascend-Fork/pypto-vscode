<template>
  <div class="navbar-container">
    <div class="history-wrap">
      <div class="history-icon">
        <HistoryNpuIcon v-if="isNpu" />
        <HistoryIcon v-else />
      </div>
      <HistoryList ref="historyListEl" :current-record="currentRecord" :page="page" :all-loaded="allLoaded" @load-more="handleLoadMore" />
    </div>
    <div class="dividing-line"></div>
    <div class="navbar-list">
      <d-tooltip :content="t('jumpCodeTips')" position="bottom" overlay-class="navbar-list-tooltip">
        <div class="source-code">
          <CodeIcon />
        </div>
      </d-tooltip>
      <ThreeDot v-if="showControlFlow" dot-color="var(--devui-placeholder-icon)" />
      <d-tooltip v-if="showControlFlow" :content="t('controlFlow')" position="bottom" :disabled="currentStep === 'controlFlow'">
        <div :class="['navbar-control-flow', currentStep === 'controlFlow' && 'active']" @click="jumpControlFlow">
          <ControlFlowIcon />
          <span v-if="currentStep === 'controlFlow'">{{ t('controlFlow') }}</span>
        </div>
      </d-tooltip>
      <ThreeDot v-if="currentStep === 'comGraph' || lastPass" dot-color="var(--devui-placeholder-icon)" />
      <d-tooltip
        v-if="currentStep === 'comGraph' || lastPass"
        :content="t('comGraphName')"
        position="bottom"
        :disabled="currentStep === 'comGraph'"
      >
        <div :class="['com-graph', currentStep === 'comGraph' && 'active']" @click="onJumpCom">
          <div class="com-graph-icon-wrap">
            <ComGraphIcon />
          </div>
          <div v-if="getControlFlowError" class="com-graph-error" :title="comGraphName">{{ comGraphName }}</div>
          <template v-else>
            <PathList v-if="currentStep === 'comGraph'" />
            <div v-if="currentStep === 'comGraph'" class="pass-leaf-wrap">
              <PassList ref="passEl" />
              <div v-if="leafFunctions.length" class="dividing-line"></div>
              <LeafFunctionCom v-if="leafFunctions.length" />
            </div>
          </template>
        </div>
      </d-tooltip>
      <ThreeDot v-if="showSwim" dot-color="var(--devui-placeholder-icon)" />
      <d-tooltip v-if="showSwim" :content="t('swimGraph')" position="bottom">
        <div class="swim-graph" @click="jumpSwim">
          <SwimIcon />
        </div>
      </d-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { navbarProps } from './navbar-types';
import PathList from './pathList.vue';
import LeafFunctionCom from './leafFunction.vue';
import PassList from './passList.vue';
import HistoryList from './historyList.vue';
import ThreeDot from './threeDot.vue';
import HistoryIcon from './icons/history-icon.vue';
import CodeIcon from '@/components/icons/source-code-icon.vue';
import ComGraphIcon from '@/components/icons/com-graph-icon.vue';
import SwimIcon from '@/components/icons/swimlane-icon.vue';
import ControlFlowIcon from './icons/control-flow-icon.vue';
import HistoryNpuIcon from './icons/history-npu-icon.vue';
import { NavbarProvideKey } from './navbar-types';
import type { HistoryData, ControlFlowData } from './navbar-types';
import type { PathInPass, LeafInPass } from '../../../../../src/types/control-flow/path';
import { getOutputRecords, getOutputDetail } from '../../apis/workspace';
import { getControlFlow } from '../../apis/control-flow';
import { openControlFlow, openSwimlaneGraph, openComputeGraph } from '../../apis/opener';
import { findFirstPath } from './util';
import { useNavbar } from './hooks/use-navbar';
import { useOutputNav } from '@/hooks/use-output-nav';

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
const lastPass = ref<PathInPass>();
const getControlFlowError = ref(false);
const isNpu = computed(() => Boolean(currentRecord.value?.title.startsWith('npu')));

provide(NavbarProvideKey, { rootProps: props, historyList, controlFlowList, passList, leafFunctions, jumpComGraph, emitLeafChange });

const { comGraphName } = useNavbar();

const page = ref(1);
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
  getOutputRecords({ page: page.value, pageSize }, { timeout: 600000 }).then(({ data }) => {
    if (data.length < pageSize) {
      allLoaded.value = true;
    }
    historyList.value.push(...data);
    isPending = false;
  });
}
getHistoryList();

const currentOutputPath = computed(() => currentRecord.value?.directoryPath);
const { controlFlowFile, swimlaneFile } = useOutputNav(currentOutputPath);
const showControlFlow = computed(() => Boolean(controlFlowFile.value));
const showSwim = computed(() => Boolean(swimlaneFile.value));

watch(
  () => props.currentRecordDirectoryPath,
  async (outputDirPath) => {
    if (!outputDirPath) {
      return;
    }
    currentRecord.value = (await getOutputDetail(outputDirPath)).data;
    if (currentRecord.value && props.currentStep !== 'controlFlow') {
      getControlFlow(
        { outputDirPath, controlFlowFilePath: currentRecord.value.controlFlowFilePath },
        { timeout: 600000, useCustomErrorHandler: true },
      )
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
        findLastPass();
      }
    }
  },
  { immediate: true },
);

function emitLeafChange(leafName: string) {
  emits('leafChange', leafName);
}

function findLastPass() {
  if (controlFlowList.value.length) {
    const firstPath = findFirstPath(controlFlowList.value);
    if (firstPath && firstPath.meta?.passes?.length) {
      lastPass.value = firstPath.meta.passes[firstPath.meta.passes.length - 1];
    }
  }
}

function onJumpCom() {
  if (props.currentStep === 'comGraph') {
    return;
  }
  jumpComGraph(lastPass.value.graphFilePath, lastPass.value.pathName);
}

function jumpControlFlow() {
  if (controlFlowFile.value) {
    openControlFlow({ outputPath: currentOutputPath.value, controlFlowPath: controlFlowFile.value });
  }
}

function jumpSwim() {
  if (swimlaneFile.value) {
    openSwimlaneGraph({ swimlaneGraphPath: swimlaneFile.value });
  }
}

function jumpComGraph(filePath: string, pathName?: string) {
  if (historyListEl.value) {
    if (!pathName) {
      pathName = (passEl.value?.getCurrentPass() as PathInPass | undefined)?.pathName ?? '';
    }
    if (currentRecord.value?.directoryPath) {
      openComputeGraph({ outputPath: currentRecord.value.directoryPath, computeGraphPath: filePath, pathName });
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
    .navbar-control-flow,
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
    }

    .com-graph-icon-wrap {
      width: 24px;
      height: 24px;
    }

    .swim-graph {
      cursor: pointer;
    }

    .navbar-control-flow,
    .com-graph {
      &:not(.active) {
        cursor: pointer;
      }
    }

    .navbar-control-flow,
    .com-graph {
      &:hover {
        border-color: var(--devui-primary-text);

        svg {
          :deep() {
            path {
              fill: var(--devui-primary-text);
            }
          }
        }
      }
    }
    .swim-graph {
      &:hover {
        border-color: var(--devui-primary-text);

        svg {
          :deep() {
            path {
              stroke: var(--devui-primary-text);
            }
          }
        }
      }
    }

    .navbar-control-flow.active {
      width: auto;
      padding: 0 8px;
      gap: 4px;
      border-color: var(--devui-primary-text);

      span {
        font-size: 12px;
        color: var(--devui-primary-text);
        line-height: 18px;
      }

      svg {
        :deep() {
          path {
            fill: var(--devui-primary-text);
          }
        }
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

      .com-graph-icon-wrap {
        display: flex;
        justify-content: center;
        align-items: center;
        border: 1px solid var(--devui-primary-text);
        border-radius: 24px;
        box-sizing: border-box;
      }

      svg {
        :deep() {
          path {
            fill: var(--devui-primary-text);
          }
        }
      }
    }

    .com-graph {
      .com-graph-error {
        line-height: 16px;
        font-size: 14px;
        color: var(--devui-title-text);
        margin-right: 12px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
