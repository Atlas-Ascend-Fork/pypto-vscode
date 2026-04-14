<template>
  <OverviewCard :data="countInfo" />
  <OverviewCard :data="warnFailInfo" />
  <OverviewCard :data="relativeErrorInfo" />
  <OverviewCard :data="absoluteErrorInfo" />
  <DataList :data="overviewList" :columns="overviewListColumns" disable-collapse-panel class="overview-data-list" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import OverviewCard from './overviewCard.vue';
import DataList from '../healthReport/dataList.vue';
import type { AbnormalNodeOverviewListItem } from './precisionReport.types';

const { t } = useI18n();

const countInfo = ref([
  { label: `TotalCount`, value: '16777', desc: t('totalDataVolume') },
  { label: `ZeroCount`, value: '65006', desc: t('zeroCount') },
]);
const warnFailInfo = ref([
  { label: 'tol_cnt', value: '0', desc: t('tolCount') },
  { label: 'warn', value: '0', desc: t('warnCount') },
  { label: 'fail', value: '0', desc: t('failCount') },
]);
const relativeErrorInfo = ref([
  { label: 'mre', value: '0', desc: t('meanRelativeError') },
  { label: 'mre_top8', value: '0', desc: t('meanTop8RelativeError') },
  { label: 'mre_top1premil', value: '0', desc: t('meanTop1PerMilRelativeError') },
]);
const absoluteErrorInfo = ref([
  { label: 'mae', value: '0', desc: t('meanAbsoluteError') },
  { label: 'mae_top8', value: '0', desc: t('meanTop8AbsoluteError') },
  { label: 'mae_top1premil', value: '0', desc: t('meanTop1PerMilAbsoluteError') },
]);
const overviewList = ref<AbnormalNodeOverviewListItem[]>([
  { id: 'A', max: '0.013306', min: '-0.019287', avg: '-0.003721', aavg: '0.004683', infnan: '65506' },
  { id: 'B', max: '0.013306', min: '-0.019287', avg: '-0.003721', aavg: '0.004683', infnan: '65506' },
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
