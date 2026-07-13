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
  <div class="navbar-container" :class="{ 'swimgraph-navbar-container': currentStep === 'swimGraph' }">
    <div class="history-wrap">
      <div class="history-icon">
        <HistoryNpuIcon v-if="isNpu" />
        <HistoryIcon v-else />
      </div>
      <HistoryList id="boot-steps-navbar-history" ref="historyListEl" :current-record="currentRecord" />
    </div>
    <div v-if="currentStep !== 'swimGraph'" class="dividing-line"></div>
    <div class="navbar-list">
      <d-tooltip
        :content="t('jumpCodeTips')"
        :position="currentStep === 'swimGraph' ? 'right' : 'bottom'"
        overlay-class="navbar-list-tooltip"
      >
        <div class="source-code">
          <CodeIcon />
        </div>
      </d-tooltip>
      <ThreeDot v-if="showControlFlow" dot-color="var(--devui-placeholder-icon)" />
      <d-tooltip v-if="showControlFlow" :content="t('controlFlow')" position="bottom" :disabled="currentStep === 'controlFlow'">
        <div
          id="boot-steps-navbar-com-graph"
          :class="['navbar-control-flow', currentStep === 'controlFlow' && 'active']"
          @click="jumpControlFlow"
        >
          <ControlFlowIcon />
          <span v-if="currentStep === 'controlFlow'">{{ t('controlFlow') }}</span>
        </div>
      </d-tooltip>
      <ThreeDot dot-color="var(--devui-placeholder-icon)" />
      <d-tooltip
        :content="t('comGraphName')"
        position="bottom"
        :disabled="currentStep === 'comGraph'"
      >
        <div id="navbarComGraphTab" :class="['com-graph', currentStep === 'comGraph' && 'active']" @click="onJumpCom">
          <div id="boot-steps-navbar-open-com-graph" class="com-graph-icon-wrap">
            <ComGraphIcon />
          </div>
          <div v-if="getControlFlowError && currentStep === 'comGraph'" class="com-graph-error" :title="comGraphName">Program.json</div>
          <template v-else>
            <PathList v-if="currentStep === 'comGraph'" />
            <div v-if="currentStep === 'comGraph' && pathName !== 'program'" class="pass-leaf-wrap">
              <PassList ref="passEl" />
              <div v-if="leafFunctions?.length" class="dividing-line"></div>
              <LeafFunctionCom v-if="leafFunctions?.length" />
            </div>
          </template>
        </div>
      </d-tooltip>
      <ThreeDot v-if="showSwim" dot-color="var(--devui-placeholder-icon)" />
      <d-tooltip v-if="showSwim" :content="t('swimGraph')" position="bottom">
        <div id="boot-steps-navbar-open-swm-graph" :class="['swim-graph', currentStep === 'swimGraph' && 'active']" @click="jumpSwim">
          <SwimIcon />
          <div v-if="currentStep === 'swimGraph'" class="title_name">{{ $t('swimGraph') }}</div>
        </div>
      </d-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, provide, ref, watch } from 'vue';
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
import type { ControlFlowData } from './navbar-types';
import type { PathInPass, LeafInPass, CallLeafRecord } from '../../../../../src/types/control-flow/path';
import { getOutputDetail } from '../../apis/workspace';
import { getControlFlow, readProgramPath } from '../../apis/control-flow';
import { openControlFlow, openSwimlaneGraph, openComputeGraph } from '../../apis/opener';
import { findFirstPath } from './util';
import { useNavbar } from './hooks/use-navbar';
import { useOutputNav } from '@/hooks/use-output-nav';
import { ComGraphProvideKey } from '../comGraph/type';
import type { ComGraphContext } from '../comGraph/type';
import { useViewServer } from '@/core/use-view-server';
import type { OutputDetail } from 'ext:/types/workspace';
import { getQuery } from '@/core/query';

const { t } = useI18n();
const props = defineProps(navbarProps);
const emits = defineEmits(['leafChange']);
const comGraphCtx = inject(ComGraphProvideKey, undefined) as ComGraphContext | undefined;
const historyListEl = ref();
const passEl = ref();
const controlFlowList = ref<ControlFlowData[]>([]);
const passList = ref<PathInPass[]>([]);
const leafFunctions = ref<LeafInPass[]>([]);
const currentRecord = ref<OutputDetail>();
const lastPass = ref<PathInPass>();
const currentPathCalledLeafRecord = ref<CallLeafRecord[]>([]);
const currentLeafData = ref<LeafInPass>();
const getControlFlowError = ref(false);
const isNpu = computed(() => Boolean(currentRecord.value?.title.startsWith('npu')));
const programePath = ref('')
const pathName = ref('')

provide(NavbarProvideKey, {
  rootProps: props,
  controlFlowList,
  passList,
  leafFunctions,
  currentPathCalledLeafRecord,
  currentLeafData,
  jumpComGraph,
});

const { comGraphName } = useNavbar();

const { controlFlowFile, swimlaneFile } = useOutputNav(currentRecord);
const showControlFlow = computed(() => Boolean(controlFlowFile.value));
const showSwim = computed(() => Boolean(swimlaneFile.value));
let isBootStep = false

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
          if (props.currentStep == 'swimGraph') {
            findLastPass();
          }
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

watch([currentPathCalledLeafRecord, currentLeafData], () => {
  const map: Record<string, number> = {};
  if (currentLeafData.value) {
    const leafName = currentLeafData.value.leafName;
    emits('leafChange', leafName);

    if (currentPathCalledLeafRecord.value.length) {
      for (const item of currentPathCalledLeafRecord.value) {
        const calleeMagicName = item.calleeFunction.magicName;
        const callerMagicName = item.callerFunction.magicName;
        if (calleeMagicName === leafName) {
          if (!map[callerMagicName]) {
            map[callerMagicName] = 1;
          } else {
            map[callerMagicName]++;
          }
        }
      }
    }
  }
  comGraphCtx.leafCalledRecordMap.value = map;
});

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
  jumpComGraph(programePath.value, 'program');
}

const { server } = useViewServer();

function jumpControlFlow() {
  if (props.currentStep === 'controlFlow') {
    return;
  }
  if (controlFlowFile.value) {
    openControlFlow({ outputPath: currentRecord.value?.directoryPath, controlFlowPath: controlFlowFile.value }).then(() => {
      server.closeWebview();
    });
  }
}

function jumpSwim() {
  if (swimlaneFile.value) {
    openSwimlaneGraph({ swimlaneGraphPath: swimlaneFile.value, outputPath: currentRecord.value?.directoryPath });
  }
}

function jumpComGraph(filePath: string, pathName?: string, blank = false) {
  if (historyListEl.value) {
    if (!pathName) {
      pathName = (passEl.value?.getCurrentPass() as PathInPass | undefined)?.pathName ?? '';
    }
    if (currentRecord.value?.directoryPath) {
      openComputeGraph({
        outputPath: currentRecord.value.directoryPath,
        computeGraphPath: filePath,
        pathName,
        computeGraphDirPath: currentRecord.value.computeGraphDirPath,
        flowVerifyPath: currentRecord.value.flowVerifyPath,
      }).then(() => {
        if (!blank && !isBootStep) {
          server.closeWebview();
        }
      });
    }
  }
}
onMounted(async () => {
  const res = await getQuery();
  const uri = res._uri;
  const query = JSON.parse(uri.query);
  isBootStep = Boolean(query.isBootStep)
  programePath.value = await readProgramPath({outputPath: res.outputPath})
  pathName.value = query.pathName;
});
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
  pointer-events: all;
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

    .navbar-control-flow,
    .swim-graph,
    .com-graph {
      &:not(.active) {
        cursor: pointer;
      }
    }

    .navbar-control-flow,
    .swim-graph,
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

    .swim-graph.active {
      width: auto;
      padding: 0 8px;
      gap: 4px;
      border-color: var(--devui-primary-text);

      svg {
        :deep() {
          path {
            fill: var(--devui-primary-text);
          }
        }
      }
    }

    .title_name {
      display: inline-block;
      white-space: nowrap;
      height: 18px;
      color: var(--devui-swim-text-title);
      font-size: 12px;
      font-weight: 400;
      line-height: 18px;
      letter-spacing: 0px;
      text-align: left;
    }
  }
}

.navbar-container.swimgraph-navbar-container {
  flex-direction: column;
  align-items: flex-start;
}
</style>

<style lang="scss">
.navbar-list-tooltip.devui-tooltip {
  max-width: 230px;
}
</style>
