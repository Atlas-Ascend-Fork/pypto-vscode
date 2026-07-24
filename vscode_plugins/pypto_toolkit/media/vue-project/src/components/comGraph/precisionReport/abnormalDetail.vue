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
  <div class="abnormal-detail-wrap">
    <div class="detail-magic-id">
      <div class="magic-id-text">
        <i class="icon icon-chevron-left-2" @click="() => emits('back')"></i>
        {{ isOpCheck ? 'Op Magic ID:' : 'Raw Magic ID:' }} {{ props.rowData.aOpMagic || props.rowData.rawMagic || props.rowData.rootCallRawmagic }}
      </div>
      <div class="magic-id-tag dtype">
          Dtype
          <span class="data-box">{{ summaryInfo.dataType }}</span>
      </div>
      <div class="magic-id-tag shape">
          Shape
          <span class="data-box">{{ summaryInfo.validShape }}</span>
      </div>
    </div>
    <PrecisionTabContent
      ref="tabContentRef"
      :detail-count="compareTableData.length"
      :show-custom-sort="true"
      :table-data="compareTableData"
      @custom-sort="onCustomSort"
      @cancel-custom-sort="onCancelCustomSort"
    >
      <template #overview>
        <AbnormalOverview :summaryInfo="summaryInfo" />
      </template>
      <template #detail>
        <AbnormalCompare ref="compareEl" :tableData="compareTableData" @sort="onSingleColumnSort" />
      </template>
    </PrecisionTabContent>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AbnormalOverview from './abnormalOverview.vue';
import AbnormalCompare from './abnormalCompare.vue';
import PrecisionTabContent from './common/PrecisionTabContent.vue';
import { useViewServer } from '@/core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import type { AbnormalNodeCompareListItem, AbnormalNodeOverviewInfo } from './precisionReport.types';

const props = defineProps({
  rowData: { type: Object, default: () => ({}) },
});
const emits = defineEmits(['back']);
const { t } = useI18n();
const { server } = useViewServer<IComViewServer>();

const tabContentRef = ref();
const compareTableData = ref<AbnormalNodeCompareListItem[]>([]);
const compareEl = ref();
const summaryInfo = ref<AbnormalNodeOverviewInfo>({});
let originTableData: AbnormalNodeCompareListItem[] = [];

// 判断是否是 opcheck 类型
const isOpCheck = computed(() => props.rowData?.currentFileType?.startsWith('op'));

const onCustomSort = (sortedData: AbnormalNodeCompareListItem[]) => {
  compareEl.value?.clearAllSort();
  compareTableData.value = sortedData;
};

const onCancelCustomSort = () => {
  compareTableData.value = JSON.parse(JSON.stringify(originTableData));
};

const onSingleColumnSort = () => {
  tabContentRef.value?.resetCustomSort();
};

// opcheck/taskcheck 类型时，summaryInfo 从 rowData 获取
watch(() => props.rowData, (data) => {
  if (Object.keys(data).length === 0) return;

  const currentFileType = data?.currentFileType;

  if (currentFileType?.startsWith('op')) {
    // op 类型：直接使用 rowData
    summaryInfo.value = data as unknown as AbnormalNodeOverviewInfo;
  } else if (currentFileType?.startsWith('task')) {
    // task 类型：从 rowData 映射字段
    // 注意：aMax, aMin 等字段在 aOp 中，bMax, bMin 等被映射为 taskMax, taskMin 在 taskOp 中
    // Dtype 取 aOp 的 datatype，Shape 取 aOp 的 validshape
    summaryInfo.value = {
      dataType: data.aDatatype || '',
      validShape: data.aValidshape || '',
      loopInfo: data.taskLoopVarInfos || '',
      rtolAtol: data.rtolAtol || '0.001, 0.001',
      totalCount: data.totalCount || '0',
      zeroCount: data.zeroCount || '0',
      tolCnt: data.tolCnt || '0',
      warn: data.warn || '0',
      fail: data.fail || '0',
      cntTotalZeroInfnanCnt: data.cntTotalZeroInfnanCnt || '0/0/0',
      cntFailWarnTol: data.cntFailWarnTol || '0/0',
      mre: data.mre || '',
      mreTop8: data.mreTop8 || '',
      mreTop1permil: data.mreTop1permil || '',
      mae: data.mae || '',
      maeTop8: data.maeTop8 || '',
      maeTop1permil: data.maeTop1permil || '',
      // A 数据：直接从 rowData 获取（aOp 展开后）
      aMax: data.aMax || '',
      aMin: data.aMin || '',
      aAvg: data.aAvg || '',
      aAavg: data.aAavg || '',
      aInfnan: data.aInfnan || '',
      // B 数据：从 taskMax, taskMin 等字段获取（taskOp 展开后，bMax → taskMax）
      bMax: data.taskMax || data.bMax || '',
      bMin: data.taskMin || data.bMin || '',
      bAvg: data.taskAvg || data.bAvg || '',
      bAavg: data.taskAavg || data.bAavg || '',
      bInfnan: data.taskInfnan || data.bInfnan || '',
    };
  }
}, { immediate: true });

// 监听 AccurancyDetail (brief 类型)
watch(server.AccurancyDetail, (val: Record<string, any>) => {
  const currentFileType = props.rowData?.currentFileType;
  // brief 类型时，summaryInfo 从 AccurancyDetail 返回值获取
  if (!currentFileType?.startsWith('op') && !currentFileType?.startsWith('task')) {
    summaryInfo.value = val?.data?.failSummary ?? {};
  }
  originTableData = transferCompareTableData(val?.data?.failDetailList);
  compareTableData.value = JSON.parse(JSON.stringify(originTableData));
});

// 监听 precisionExceptList (op/task 类型)
watch(() => server.precisionExceptList?.value, (newValue) => {
  const currentFileType = props.rowData?.currentFileType;
  // op 和 task 类型都处理 precisionExceptList
  if (!currentFileType?.startsWith('op') && !currentFileType?.startsWith('task')) {
    return;
  }
  if (newValue && Array.isArray(newValue)) {
    originTableData = transferPrecisionExceptData(newValue);
    compareTableData.value = JSON.parse(JSON.stringify(originTableData));
  } else if (newValue === null) {
    originTableData = [];
    compareTableData.value = [];
  }
}, { deep: true });

function transferCompareTableData(data: Record<string, any>[]) {
  const res: AbnormalNodeCompareListItem[] = [];
  if (!data) {
    return res;
  }
  for (const item of data) {
    res.push({
      offset: item['OFFSET'],
      offsetRaw: item['OFFSET_RAW'],
      aValue: item['A>data'],
      bValue: item['B>data'],
      abRe: item['AB>re'],
      abAe: item['AB>ae'],
      abTol: item['AB>tol'],
    });
  }
  return res;
}

function transferPrecisionExceptData(data: Record<string, any>[]): AbnormalNodeCompareListItem[] {
  const res: AbnormalNodeCompareListItem[] = [];
  if (!data) {
    return res;
  }
  for (const item of data) {
    res.push({
      offset: item['OFFSET'] ?? item['offset'] ?? '',
      offsetRaw: item['OFFSET_RAW'] ?? item['offsetRaw'] ?? '',
      aValue: item['A>data'] ?? item['A_data'] ?? '',
      bValue: item['B>data'] ?? item['B_data'] ?? '',
      abRe: item['AB>re'] ?? item['AB_re'] ?? '',
      abAe: item['AB>ae'] ?? item['AB_ae'] ?? '',
      abTol: item['AB>tol'] ?? item['AB_tol'] ?? '',
    });
  }
  return res;
}

onMounted(() => {
  const { currentFileType, currentFilePath, loopInfo, aOpMagic, rawMagic, aFileName, bFileName, taskNo, fileName } = props.rowData || {};

  // op 类型调用 getPrecisionExceptList
  if (currentFileType?.startsWith('op') && currentFilePath) {
    const filePath = currentFilePath.replace(/\.csv$/i, '');
    // 都使用 bFileName
    const opFileName = (bFileName || '').replace(/\.data$/i, '').replace(/-/g, '~');

    if (opFileName) {
      server.getPrecisionExceptList?.({
        filePath,
        fileName: opFileName,
      });
    }
  } else if (currentFileType?.startsWith('task') && currentFilePath) {
    // task 类型调用 getPrecisionExceptList
    const filePath = currentFilePath.replace(/\.csv$/i, '');
    const taskFileName = (fileName || '').replace(/\.data$/i, '').replace(/-/g, '~');

    if (taskFileName) {
      server.getPrecisionExceptList?.({
        filePath,
        fileName: taskFileName,
      });
    }
  } else {
    // brief 类型调用 getAccurancyDetail
    server.getAccurancyDetail({ data: { loopInfo, rawMagic: aOpMagic || rawMagic } });
  }
});
</script>

<style lang="scss" scoped>
.abnormal-detail-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-gutter: stable;

  .detail-magic-id {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--devui-secondary-button-border);
    border-radius: 12px;
    background-color: var(--devui-secondary-button-disabled-bg);
    position: relative;
    overflow: hidden;
    color: var(--devui-title-text);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 25%;
      height: 100%;
      background-image: radial-gradient(circle, var(--pto-border-default) 1.5px, transparent 1.5px);
      background-size: 4px 4px;
      -webkit-mask-image: linear-gradient(to left, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
      mask-image: linear-gradient(to left, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
      pointer-events: none;
    }

    .magic-id-text {
      display: flex;
      align-items: center;
      font-size: 18px;
      font-weight: 700;

      i {
        font-size: 16px;
        cursor: pointer;
        margin-right: 8px;
      }
    }

    .magic-id-tag {
      display: inline-flex;
      height: 26px;
      padding: 2px 4px 2px 8px;
      font-size: 14px;
      border-radius: 6px;
      margin: 12px 8px 0 0;

      .data-box {
        color: var(--devui-title-text);
        border-radius: 4px;
        font-size: 13px;
        padding: 0 8px;
        background-color: var(--devui-secondary-button-disabled-bg);
        border: 1px solid var(--devui-secondary-button-border);
        margin-left: 4px;
      }
    }

    .dtype {
      color: rgba(115, 166, 255, 1);
      border: 1px solid rgba(49, 122, 247, 1);
    }

    .shape {
      color: rgba(201, 89, 255, 1);
      border: 1px solid rgba(138, 33, 188, 1);
    }
  }
}
</style>
