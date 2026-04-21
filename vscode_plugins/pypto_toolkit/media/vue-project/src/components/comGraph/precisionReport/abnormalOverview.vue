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
    { label: `TotalCount`, value: totalCount, desc: t('totalDataVolume') },
    { label: `ZeroCount`, value: zeroCount, desc: t('zeroCount') },
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
  { label: 'mre', value: convertData(props.summaryInfo.mre), desc: t('meanRelativeError') },
  { label: 'mre_top8', value: convertData(props.summaryInfo.mreTop8), desc: t('meanTop8RelativeError') },
  { label: 'mre_top1premil', value: convertData(props.summaryInfo.mreTop1permil), desc: t('meanTop1PerMilRelativeError') },
]);
const absoluteErrorInfo = computed(() => [
  { label: 'mae', value: convertData(props.summaryInfo.mae), desc: t('meanAbsoluteError') },
  { label: 'mae_top8', value: convertData(props.summaryInfo.maeTop8), desc: t('meanTop8AbsoluteError') },
  { label: 'mae_top1premil', value: convertData(props.summaryInfo.maeTop1permil), desc: t('meanTop1PerMilAbsoluteError') },
]);
function convertData(val?: string) {
  if (!val) {
    return val;
  }
  const [intVal, decimalVal] = val.split('.');
  if (val.length <= 11) {
    // 11位内直接展示
    return val;
  } else if (decimalVal.length >= 12) {
    if (decimalVal.toLocaleLowerCase().includes('e')) {
      // 小数位大于12字符且为科学计数
      const [val1, val2] = decimalVal.toLocaleLowerCase().split('e');
      return `${intVal}.${val1.slice(0, 5)}e${val2}`;
    } else {
      // 小数位大于12字符，转科学计数
      return Number(val).toExponential(7);
    }
  } else if (intVal.length >= 9) {
    return Number(val).toExponential(7);
  } else {
    return val;
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
