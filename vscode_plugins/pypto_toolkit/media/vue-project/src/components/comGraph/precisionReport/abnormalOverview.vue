<template>
  <OverviewCard :data="countInfo" />
  <OverviewCard :data="warnFailInfo" />
  <OverviewCard :data="relativeErrorInfo" />
  <OverviewCard :data="absoluteErrorInfo" />
  <d-data-grid :data="overviewList" :columns="overviewListColumns" size="xs" class="overview-data-list"></d-data-grid>
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

const countInfo = computed(() => {
  const [totalCount, zeroCount] = props.summaryInfo.cntTotalZeroInfnanCnt?.split('/') ?? [];
  return [
    { label: `total_count`, value: totalCount, desc: t('totalDataVolume') },
    { label: `zero_count`, value: zeroCount, desc: t('zeroCount') },
  ];
});
const warnFailInfo = computed(() => {
  const [fail, warn, tolCnt] = props.summaryInfo.cntFailWarnTol?.split('/') ?? [];
  return [
    { label: 'tol_cnt', value: tolCnt, desc: t('tolCount') },
    { label: 'warn', value: warn, desc: t('warnCount') },
    { label: 'fail', value: fail, desc: t('failCount') },
  ];
});
const relativeErrorInfo = computed(() => [
  { label: 'mre', ...convertData(props.summaryInfo.mre), desc: t('meanRelativeError') },
  { label: 'mre_top8', ...convertData(props.summaryInfo.mreTop8), desc: t('meanTop8RelativeError') },
  { label: 'mre_top1premil', ...convertData(props.summaryInfo.mreTop1permil), desc: t('meanTop1PerMilRelativeError') },
]);
const absoluteErrorInfo = computed(() => [
  { label: 'mae', ...convertData(props.summaryInfo.mae), desc: t('meanAbsoluteError') },
  { label: 'mae_top8', ...convertData(props.summaryInfo.maeTop8), desc: t('meanTop8AbsoluteError') },
  { label: 'mae_top1premil', ...convertData(props.summaryInfo.maeTop1permil), desc: t('meanTop1PerMilAbsoluteError') },
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
