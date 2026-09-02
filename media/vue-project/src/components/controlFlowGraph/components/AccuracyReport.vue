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
      <div v-if="modelValue" ref="drawerEl" class="accuracy-report">
        <div class="accuracy-report-header">
          <span class="title">{{ t('accuracyReport') }}</span>
          <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
        </div>
        <div class="accuracy-report-content">
          <div class="title">
            {{ t('controlFlows.dataOverview') }}
          </div>
          <div class="content">
            <div class="content-title">{{ t('controlFlows.accuracyVerificationResults') }}</div>
            <d-row :gutter="8">
              <d-col :span="12">
                <StatisticCard type="PASS" :count="data.successPass.length" :active-type="activeType" @handle-card="handleResult('PASS')" />
              </d-col>
              <d-col :span="12">
                <StatisticCard type="FAIL" :count="data.errorPass.length" :active-type="activeType" @handle-card="handleResult('FAIL')" />
              </d-col>
            </d-row>
            <d-row :gutter="8">
              <d-col :span="12">
                <StatisticCard
                  type="EXCEPTION"
                  :count="data.exceptionPass.length"
                  :active-type="activeType"
                  @handle-card="handleResult('EXCEPTION')"
                />
              </d-col>
              <d-col :span="12">
                <StatisticCard type="SKIP" :count="data.skipPass.length" :active-type="activeType" @handle-card="handleResult('SKIP')" />
              </d-col>
            </d-row>
            <div class="content-title">
              {{ t('controlFlows.accuracyPassDistributionOverview') }}
              <PtoButton v-if="selectedBlock" type="text" @click="handleCancelSelect" style="height: 12px">
                {{ t('controlFlows.cancelSelection') }}
              </PtoButton>
            </div>
            <div></div>
            <div class="overview-blocks" ref="blocksContainerRef">
              <template v-for="item in overviewList" :key="item.pass_name">
                <div
                  :class="[
                    'block',
                    `block-${item.status[0]}`,
                    {
                      selected: selectedBlock?.pass_name === item.pass_name,
                    },
                  ]"
                  @click="handleBlockClick(item)"
                >
                  <span class="block-number">{{ item.index }}</span>
                  <span class="block-name" :title="item.pass_name">{{ item.pass_name }}</span>
                  <span v-if="item?.isFirstExce" class="tag" style="margin-left: auto">First Exc</span>
                  <span v-else-if="item?.status?.includes('FAIL') && item?.status?.includes('EXCEPTION')" class="tag" style="margin-left: auto">Exc</span>
                  <span v-if="item?.isFirstFail" class="tag fail-tag" :style="{ 'margin-left': item?.isFirstExce || (item?.status?.includes('FAIL') && item?.status?.includes('EXCEPTION')) ? '8px' : 'auto' }">First Fail</span>
                  <span v-else-if="item?.status?.includes('FAIL') && item?.status?.includes('EXCEPTION')" class="tag fail-tag" style="margin-left: 8px">Fail</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import { watch, ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import StatisticCard from '../../comGraph/precisionReport/statisticCard.vue';
import PtoButton from '@/components/ui/PtoButton.vue';

const { t } = useI18n();
const props = defineProps({
  modelValue: Boolean,
  data: {
    type: Object,
    default: {
      successPass: [],
      errorPass: [],
      exceptionPass: [],
      skipPass: [],
      pass_cnt: 0,
      fail_cnt: 0,
      exception_cnt: 0,
      skip_cnt: 0,
    },
  },
});
const emits = defineEmits(['update:modelValue', 'block-click']);

const drawerEl = ref<HTMLElement | null>(null);
const blocksContainerRef = ref(null);
const dataList = ref({});
const activeType = ref(null);
const selectedBlock = ref(null);

const overviewList = computed(() => {
  const list = Object.values(dataList.value).sort((a, b) => a.index - b.index);
  if (activeType.value) {
    return list.filter((item) => item?.status.includes(activeType.value));
  } else {
    return list;
  }
});

const init = () => {
  dataList.value = {};
  let firstFailFound = false; // 标记是否已经找到了第一个 FAIL
  let firstExceFound = false; // 标记是否已经找到了第一个 EXCEPTION
  for (const item of props.data?.successPass ?? []) {
    const splitName = item?.split('_');
    dataList.value[splitName] = { pass_name: splitName?.[2] || '', status: ['PASS'], index: Number(splitName?.[1] || '') };
  }
  for (const item of props.data?.skipPass ?? []) {
    const splitName = item?.split('_');
    dataList.value[splitName] = { pass_name: splitName?.[2] || '', status: ['SKIP'], index: Number(splitName?.[1] || '') };
  }
  for (const item of props.data?.exceptionPass ?? []) {
    const splitName = item?.pass_name?.split('_') || '';
    dataList.value[splitName] = {
      pass_name: splitName?.[2] || '',
      status: ['EXCEPTION'],
      index: Number(splitName?.[1] || ''),
      excFuncMagicName: item.func_magicName,
    };
    if (!firstExceFound) {
      dataList.value[splitName].isFirstExce = true;
      firstExceFound = true;
    }
  }
  for (const item of props.data?.errorPass ?? []) {
    const splitName = item?.pass_name?.split('_') || '';
    if (dataList.value[splitName]) {
      dataList.value[splitName].failFuncMagicName = item.func_magicName;
      dataList.value[splitName].status.push('FAIL');
    } else {
      dataList.value[splitName] = {
        pass_name: splitName?.[2] || '',
        status: ['FAIL'],
        index: Number(splitName?.[1] || ''),
        failFuncMagicName: item.func_magicName,
      };
    }
    if (!firstFailFound) {
      dataList.value[splitName].isFirstFail = true;
      firstFailFound = true;
    }
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      init();
    }
  },
);

// 监听activeType变化，重新触发高亮
watch(activeType, () => {
  if (selectedBlock.value) {
    emits('block-click', selectedBlock.value, activeType.value);
  }
});

const handleResult = (type) => {
  activeType.value = activeType.value === type ? null : type;
};

// 点击精度pass分布总览，目前只开放'FAIL'
const handleBlockClick = (item) => {
  if (!item.status.includes('FAIL') && !item.status.includes('EXCEPTION')) return;
  selectedBlock.value = selectedBlock.value?.pass_name === item.pass_name ? null : item;
  emits('block-click', selectedBlock.value, activeType.value);
};

const handleCancelSelect = () => {
  selectedBlock.value = null;
  emits('block-click', null, activeType.value);
};
</script>
<style lang="scss" scoped>
@use 'devui-theme/styles-var/devui-var.scss' as *;

@mixin block-base-style($r, $g, $b) {
  border-left-color: rgba($r, $g, $b, 1);
  background: rgba($r, $g, $b, 0.02);

  .block-number {
    color: rgba($r, $g, $b, 1);
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: rgba($r, $g, $b, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 6px;
    padding: 0 0 4px 0;
  }

  .block-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

@mixin tag-style($r, $g, $b) {
  display: flex;
  background-color: rgba($r, $g, $b, 0.1);
  border-radius: 4px;
  height: 20px;
  justify-content: center;
  align-items: center;
  padding: 0 8px;
  color: rgba($r, $g, $b, 1);
}

@mixin first-error-style($r, $g, $b) {
  background: rgba($r, $g, $b, 0.16);

  .block-number {
    color: var(--devui-text);
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: rgba($r, $g, $b, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 6px;
    padding: 0 0 1px 0;
  }
}

.accuracy-report {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1040;
  width: 490px;
  border-radius: 16px;
  background-color: var(--devui-card-bg);
  box-shadow: -1px 0 0 0 var(--devui-split-line);
  padding: 16px;
  overflow-y: auto;
  scrollbar-gutter: stable;

  .accuracy-report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 24px;
    box-sizing: content-box;

    .title {
      font-size: 16px;
      font-weight: bold;
      color: var(--devui-title-text);
    }

    .icon-close {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      color: var(--devui-icon);
      border-radius: 8px;
      transition: background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
        color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
      cursor: pointer;

      &:hover {
        color: var(--devui-title-text);
        background-color: var(--devui-input-hover-bg);
      }
    }
  }

  .accuracy-report-content {
    .title {
      font-size: 14px;
      font-weight: 700;
      margin-top: 16px;
    }

    .content {
      .content-title {
        margin: 8px 0;
        font-size: 12px;
        display: flex;
      }
    }
  }

  .overview-blocks {
    margin-top: 13px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .block {
      height: 28px;
      width: 100%;
      border-radius: 8px;
      font-size: 13px;
      padding: 4px;
      border: 1px solid transparent;
      display: flex;

      &.block-PASS {
        @include block-base-style(135, 200, 89);
      }

      &.block-FAIL {
        @include block-base-style(246, 158, 57);
        cursor: pointer;

        &:hover,
        &.selected {
          border-color: rgba(246, 158, 57, 1);
        }

        .tag {
          margin-left: 8px;
          @include tag-style(246, 158, 57);
        }
      }

      &.block-SKIP {
        @include block-base-style(153, 153, 153);
      }

      &.block-EXCEPTION {
        @include block-base-style(231, 67, 74);
        cursor: pointer;

        &:hover,
        &.selected {
          border-color: rgba(199, 91, 96, 1);
        }

        .tag {
          margin-left: 8px;
          @include tag-style(231, 67, 74);
        }

        .fail-tag {
          margin-left: 8px;
          @include tag-style(246, 158, 57);
        }
      }
    }
  }
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: transform 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  transform: translate(100%);
}
</style>
