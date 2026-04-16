<template>
  <OverviewCard :data="countInfo" />
  <OverviewCard :data="warnFailInfo" />
  <OverviewCard :data="relativeErrorInfo" />
  <OverviewCard :data="absoluteErrorInfo" />
  <DataList :data="overviewList" :columns="overviewListColumns" disable-collapse-panel class="overview-data-list" />
</template>

<script setup lang="ts">
import { computed, PropType, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import OverviewCard from './overviewCard.vue';
import DataList from '../healthReport/dataList.vue';
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
  { label: 'mre', value: props.summaryInfo.mre, desc: t('meanRelativeError') },
  { label: 'mre_top8', value: props.summaryInfo.mreTop8, desc: t('meanTop8RelativeError') },
  { label: 'mre_top1premil', value: props.summaryInfo.mreTop1permil, desc: t('meanTop1PerMilRelativeError') },
]);
const absoluteErrorInfo = computed(() => [
  { label: 'mae', value: props.summaryInfo.mae, desc: t('meanAbsoluteError') },
  { label: 'mae_top8', value: props.summaryInfo.maeTop8, desc: t('meanTop8AbsoluteError') },
  { label: 'mae_top1premil', value: props.summaryInfo.maeTop1permil, desc: t('meanTop1PerMilAbsoluteError') },
]);
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
  { field: 'id', header: '' },
  { field: 'max', header: 'Max' },
  { field: 'min', header: 'Min' },
  { field: 'avg', header: 'Avg' },
  { field: 'aavg', header: 'Aavg' },
  { field: 'infnan', header: 'Infnan' },
]);
</script>

<style lang="scss">
.overview-data-list.data-list {
  .head {
    padding-top: 8px;
    padding-bottom: 8px;
    .head-item {
      color: var(--devui-placeholder-text);
    }
  }
}
</style>
