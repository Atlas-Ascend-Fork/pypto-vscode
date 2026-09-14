<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<template>
  <div class="abnormal-overview-wrap">
    <div class="tolerance-benchmark-card">
      <div class="benchmark-header">
        <span class="benchmark-label">{{ t('judgmentBasis') }}</span>
        <span class="benchmark-divider"></span>
        <div class="benchmark-data-item">
          <span class="benchmark-data-label">Rtol</span>
          <d-tooltip overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
            <i class="icon icon-helping"></i>
            <template #content>
              <span>{{ t('rtolThreshold') }}</span>
            </template>
          </d-tooltip>
          <span class="benchmark-data-value">{{ rtolValue }}</span>
        </div>
        <div class="benchmark-data-item">
          <span class="benchmark-data-label">Atol</span>
          <d-tooltip overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
            <i class="icon icon-helping"></i>
            <template #content>
              <span>{{ t('atolThreshold') }}</span>
            </template>
          </d-tooltip>
          <span class="benchmark-data-value">{{ atolValue }}</span>
        </div>
      </div>
      <div class="benchmark-footer">
        <div v-for="item in warnFailInfo" :key="item.label" class="benchmark-item-data">
          <div>
            <span class="label-text">{{ item.label }}</span>
            <d-tooltip v-if="item.desc" overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
              <i class="icon icon-helping"></i>
              <template #content>
                <span>{{ item.desc }}</span>
              </template>
            </d-tooltip>
          </div>
          <span class="value-text" :class="`value-${item.label}`">{{ item.value }}</span>
        </div>
      </div>
    </div>
    <OverviewCard :data="countInfo" variant="footer" />
    <!-- <OverviewCard :data="warnFailInfo" /> -->
    <div class="section-title">{{ t('relativeError') }}</div>
    <OverviewCard :data="relativeErrorInfo" variant="footer" />
    <div class="section-title">{{ t('absoluteError') }}</div>
    <OverviewCard :data="absoluteErrorInfo" variant="footer" />
    <div class="section-title">{{ t('valueDistributionComparison') }}</div>
    <d-data-grid :data="overviewList" :columns="overviewListColumns" size="xs" class="overview-data-list"></d-data-grid>
  </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import OverviewCard from './overviewCard.vue';
import type { AbnormalNodeOverviewListItem, AbnormalNodeOverviewInfo } from './precisionReport.types';

const props = defineProps({
  summaryInfo: { type: Object as PropType<AbnormalNodeOverviewInfo>, default: () => ({}) },
});

const { t } = useI18n();

const rtolValue = computed(() => {
  const rtolAtol = props.summaryInfo.rtolAtol || props.summaryInfo.abRtolAtol || '';
  const [rtol] = rtolAtol?.split('/') ?? [];
  return rtol ?? '';
});
const atolValue = computed(() => {
  const rtolAtol = props.summaryInfo.rtolAtol || props.summaryInfo.abRtolAtol || '';
  const [, atol] = rtolAtol?.split('/') ?? [];
  return atol ?? '';
});
const countInfo = computed(() => {
  const cntTotalZeroInfnanCnt = props.summaryInfo.cntTotalZeroInfnanCnt || props.summaryInfo.abTotalZeroInfnanCnt || '';
  const [totalCount, zeroCount, infnanCount] = cntTotalZeroInfnanCnt?.split('/') ?? [];
  return [
    { label: `total_count`, value: totalCount, desc: t('totalDataVolume') },
    { label: `zero_count`, value: zeroCount, desc: t('zeroCount') },
    { label: `infnan_cnt`, value: infnanCount, desc: t('infnanCount') },
  ];
});
const warnFailInfo = computed(() => {
  const cntFailWarnTol = props.summaryInfo.cntFailWarnTol || props.summaryInfo.abFailWarnTol || '';
  const [fail, warn, tolCnt] = cntFailWarnTol?.split('/') ?? [];
  return [
    { label: 'tol_cnt', value: tolCnt, desc: t('tolCount') },
    { label: 'warn', value: warn, desc: t('warnCount') },
    { label: 'fail', value: fail, desc: t('failCount') },
  ];
});
const relativeErrorInfo = computed(() => [
  { label: 'mre', ...convertData(props.summaryInfo.mre || props.summaryInfo.abMre), desc: t('meanRelativeError') },
  { label: 'mre_top8', ...convertData(props.summaryInfo.mreTop8 || props.summaryInfo.abMreTop8), desc: t('meanTop8RelativeError') },
  { label: 'mre_top1premil', ...convertData(props.summaryInfo.mreTop1permil || props.summaryInfo.abMreTop1permil), desc: t('meanTop1PerMilRelativeError') },
]);
const absoluteErrorInfo = computed(() => [
  { label: 'mae', ...convertData(props.summaryInfo.mae || props.summaryInfo.abMae), desc: t('meanAbsoluteError') },
  { label: 'mae_top8', ...convertData(props.summaryInfo.maeTop8 || props.summaryInfo.abMaeTop8), desc: t('meanTop8AbsoluteError') },
  { label: 'mae_top1premil', ...convertData(props.summaryInfo.maeTop1permil || props.summaryInfo.abMaeTop1permil), desc: t('meanTop1PerMilAbsoluteError') },
]);
const maxLength = 11;
function convertData(val?: string) {
  if (!val) {
    return { value: val, tooltip: undefined };
  }
  if (val.length <= maxLength) {
    // 11位内直接展示
    return { value: val, tooltip: undefined };
  } else {
    const eIndex = val.search(/[Ee]/);
    const res = { value: val, tooltip: val };
    if (eIndex !== -1) {
      const mantissa = val.slice(0, eIndex);
      const exponent = val.slice(eIndex);
      const expLength = exponent.length;
      const mantissaAvail = maxLength - expLength;
      if (mantissaAvail >= 1) {
        res.value = mantissa.slice(0, mantissaAvail) + '...' + exponent;
      } else {
        const mantissaLen = val.startsWith('-') ? 2 : 1;
        res.value = val.slice(0, mantissaLen) + '...' + exponent;
      }
    } else {
      res.value = val.slice(0, maxLength) + '...';
    }
    return res;
  }
}
const overviewList = computed<AbnormalNodeOverviewListItem[]>(() => [
  {
    id: 'A',
    max: props.summaryInfo.aMax,
    min: props.summaryInfo.aMin,
    avg: props.summaryInfo.aAvg,
    aavg: props.summaryInfo.aAavg,
    infnan: props.summaryInfo.aInfnan,
  },
  {
    id: 'B',
    max: props.summaryInfo.bMax,
    min: props.summaryInfo.bMin,
    avg: props.summaryInfo.bAvg,
    aavg: props.summaryInfo.bAavg,
    infnan: props.summaryInfo.bInfnan,
  },
]);
const overviewListColumns = ref([
  { field: 'id', header: '', width: 30 },
  { field: 'max', header: 'Max', showOverflowTooltip: true },
  { field: 'min', header: 'Min', showOverflowTooltip: true },
  { field: 'avg', header: 'Avg', showOverflowTooltip: true },
  { field: 'aavg', header: 'Aavg', showOverflowTooltip: true },
  { field: 'infnan', header: 'Infnan', showOverflowTooltip: true },
]);
</script>

<style lang="scss">
.abnormal-overview-wrap {
  flex-shrink: 0;
}

.tolerance-benchmark-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: 12px;
  box-sizing: border-box;
  margin-bottom: 12px;
  overflow: hidden;

  .benchmark-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background-color: var(--benchmark-header-bg);
    gap: 8px;

    .benchmark-label {
      font-size: 14px;
      line-height: 22px;
      color: var(--devui-secondary-text);
    }

    .benchmark-divider {
      width: 1px;
      height: 14px;
      background-color: var(--devui-split-line-deep);
      margin: 0 8px;
    }

    .benchmark-data-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .benchmark-data-label {
        font-size: 14px;
        line-height: 20px;
        color: var(--devui-title-text);
        opacity: 0.8;
      }

      .benchmark-data-value {
        display: inline-flex;
        align-items: center;
        height: 20px;
        padding: 0 8px;
        border-radius: 4px;
        border: 1px solid var(--devui-secondary-button-border);
        background-color: var(--devui-secondary-button-disabled-bg);
        font-size: 12px;
        line-height: 20px;
        color: var(--devui-title-text);
      }
    }
  }

  .benchmark-footer {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 16px;
    background-color: var(--benchmark-footer-bg);
    box-sizing: border-box;

    .benchmark-item-data {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .label-text {
        font-size: 14px;
        line-height: 22px;
        margin-right: 4px;
        color: var(--devui-title-text);
        opacity: 0.8;
      }

      .value-text {
        font-size: 18px;
        font-weight: bold;
        line-height: 26px;
        color: var(--devui-title-text);

        &.value-warn {
          color: var(--devui-status-error);
        }

        &.value-fail {
          color: var(--devui-duff-change-border-color);
        }
      }
    }
  }
}


  .section-title {
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 700;
    line-height: 20px;
    color: var(--task-detail-section-title-text);
  }


.overview-data-list {
  .devui-data-grid__head {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    background-color: var(--devui-nest-bg);
    .th-sort-icon {
      display: none;
    }
  }
  .devui-data-grid__tr {
    background-color: transparent;
    &.hover-tr {
      background-color: var(--devui-input-hover-bg) !important;
    }
  }
  .devui-data-grid__body-wrapper.devui-scroll-overlay {
    overflow: auto;
  }
}
</style>
