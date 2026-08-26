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
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="modelValue" ref="drawerEl" class="com-graph-report">
        <div class="com-graph-report-header">
          <span class="title">{{ t('comGraphReport') }}</span>
          <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
        </div>
        <d-tabs v-model="activeTab" type="pills" :show-content="false" class="com-graph-report-tabs">
          <d-tab :id="TabName.healthReport" :title="t('healthReport')"></d-tab>
          <d-tab :id="TabName.precisionReport">
            <template #title>
              <div v-if="showAccuracyReport" class="precision-tab-title">
                <span>{{ t('precisionReport') }}</span>
                <!-- 暂无文档，有文档再放开 -->
                <d-tooltip v-if="false" overlay-class="com-graph-report-standard-tips">
                  <i class="icon icon-helping"></i>
                  <template #content>
                    <span>{{ t('viewInspectionStandards') }}</span>
                  </template>
                </d-tooltip>
                <!--  -->
              </div>
            </template>
          </d-tab>
        </d-tabs>
        <HealthReport v-show="activeTab === TabName.healthReport" />
        <PrecisionReport v-show="activeTab === TabName.precisionReport" @op-magic-click="(opmagic) => emits('opMagicClick', opmagic)" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, ref, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import { useClickOutside } from './hooks/use-click-outside';
import { useViewServer } from '../../core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { ComGraphReportProvideKey, TabName } from './type';
import { comGraphStore } from '@/service/com-graph-store';
import type { GraphName } from './type';
import HealthReport from './healthReport/healthReport.vue';
import PrecisionReport from './precisionReport/precisionReport.vue';

const { t } = useI18n();
const props = defineProps({
  modelValue: Boolean,
});
const emits = defineEmits(['update:modelValue', 'onLocate', 'open', 'locateSubgraph', 'opMagicClick']);
const { drawerEl } = useClickOutside(props, emits);
const { server } = useViewServer<IComViewServer>();

const showAccuracyReport = ref(false)
const graphName = ref<GraphName>();
const jsonData = ref<Record<string, any>>();
const activeTab = ref<TabName>(TabName.healthReport);

watch(server.HealthyReport, (newValue) => {
  Object.keys(newValue.data).forEach((key) => {
    if (newValue.data[key]) {
      graphName.value = key as GraphName;
      jsonData.value = newValue.data[key];
      emits('open', key);
    }
  });
});

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      server.getHealthyReport();
      const briefShowFlag = Object.keys(comGraphStore.data.wrongRawMagicList?.errorRawMagicList || {}).length > 0 || Object.keys(comGraphStore.data.wrongRawMagicList?.exceptionRawMagicList || {}).length > 0;
      const opShowFlag = comGraphStore.data.failOpMagicList?.length > 0;
      const taskShowFlag = comGraphStore.data.failMagicList?.length > 0;
      if( briefShowFlag || opShowFlag || taskShowFlag) {
        showAccuracyReport.value = true
      }
    }
  },
);


provide(ComGraphReportProvideKey, { graphName, jsonData, rootEmits: emits });
</script>

<style lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.com-graph-report {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1040;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 488px;
  border-radius: 16px;
  background-color: var(--control-flow-bg);
  box-shadow: -1px 0 0 0 var(--devui-split-line);
  box-sizing: border-box;

  .com-graph-report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 24px;
    padding: 16px 16px 0;
    box-sizing: content-box;

    .title {
      font-size: 16px;
      font-weight: bold;
      color: var(--devui-title-text);
      line-height: 24px;
    }

    .icon-close {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      color: var(--devui-icon);
      border-radius: 8px;
      transition:
        background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
        color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
      cursor: pointer;

      &:hover {
        color: var(--devui-title-text);
        background-color: var(--devui-input-hover-bg);
      }
    }
  }

  .com-graph-report-tabs {
    padding: 0 16px;

    .devui-tabs__nav--pills li {
      &:not(:first-child) {
        margin-left: 24px;
      }
      a {
        color: var(--devui-secondary-text);

        .icon-helping {
          margin-left: 4px;
          color: var(--devui-secondary-text) !important;
        }
      }
      &:hover {
        a {
          color: var(--devui-title-text);
        }
      }
      &.active {
        &:after {
          background-color: var(--devui-title-text);
        }
        a {
          color: var(--devui-title-text);
        }
      }
    }
  }
}
.com-graph-report-standard-tips {
  min-height: unset !important;
  padding: 4px 8px !important;
}
</style>
