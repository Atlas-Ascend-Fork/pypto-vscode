<template>
  <div class="abnormal-detail-wrap">
    <div class="detail-magic-id">
      <i class="icon icon-chevron-left-2" @click="() => emits('back')"></i>
      <span>Raw Magic ID: {{ rawMagic }}</span>
    </div>
    <OverviewCard :data="typeShapeThresholdInfo" />
    <OverviewCard :data="tolInfo" />
    <div class="com-graph-abnormal-detail-tabs-wrapper">
      <d-tabs v-model="activeTab" type="pills" :show-content="false" class="com-graph-report-tabs">
        <d-tab id="overview" :title="t('precisionOverview')"></d-tab>
        <d-tab id="detail" :title="detailTabTitle"></d-tab>
      </d-tabs>
      <div v-if="activeTab === 'detail'" class="custom-sort-btn" @click="openSortModal">
        <i :class="isCustomSorting ? 'icon-setting-results' : 'icon-setting-results'"></i>
        <span>{{ isCustomSorting ? t('cancelCustomSort') : t('customSort') }}</span>
      </div>
    </div>
    <template v-if="activeTab === 'overview'">
      <AbnormalOverview :summaryInfo="summaryInfo" />
    </template>
    <template v-if="activeTab === 'detail'">
      <AbnormalCompare ref="compareEl" :tableData="compareTableData" @sort="onSingleColumnSort" />
    </template>
    <CustomSortModal v-model="showSortModal" @confirm="onCustomSortConfirm" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import OverviewCard from './overviewCard.vue';
import AbnormalOverview from './abnormalOverview.vue';
import AbnormalCompare from './abnormalCompare.vue';
import CustomSortModal from './customSortModal.vue';
import { useViewServer } from '@/core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import type { AbnormalNodeCompareListItem, AbnormalNodeOverviewInfo, SelectedSortCol } from './precisionReport.types';

const props = defineProps({
  loopInfo: String,
  rawMagic: String,
});
const emits = defineEmits(['back']);
const { t } = useI18n();
const { server } = useViewServer<IComViewServer>();

const activeTab = ref<'overview' | 'detail'>('overview');
const isCustomSorting = ref(false);
const showSortModal = ref(false);
const compareTableData = ref<AbnormalNodeCompareListItem[]>([]);
const compareEl = ref();
const detailTabTitle = computed(() => `${t('precisionDetail')} (${compareTableData.value.length})`);
const summaryInfo = ref<AbnormalNodeOverviewInfo>({});
const typeShapeThresholdInfo = computed(() => [
  { label: 'Dtype', value: summaryInfo.value.dataType },
  { label: 'Shape', value: summaryInfo.value.validShape },
]);
const tolInfo = computed(() => {
  const [rTol, aTol] = summaryInfo.value.rtolAtol?.split('/') ?? [];
  return [
    { label: 'rtol', value: rTol },
    { label: 'atol', value: aTol },
  ];
});
let originTableData: AbnormalNodeCompareListItem[] = [];

const openSortModal = () => {
  if (isCustomSorting.value) {
    isCustomSorting.value = false;
    compareTableData.value = JSON.parse(JSON.stringify(originTableData));
  } else {
    showSortModal.value = true;
  }
};

const onSingleColumnSort = () => {
  isCustomSorting.value = false;
};

const onCustomSortConfirm = (e: SelectedSortCol[]) => {
  isCustomSorting.value = true;
  compareEl.value.clearAllSort();
  const temp = JSON.parse(JSON.stringify(originTableData));
  temp.sort((a, b) => {
    for (const { field, direction } of e) {
      if (a[field] !== b[field]) {
        return direction === 'asc' ? a[field] - b[field] : b[field] - a[field];
      }
    }
  });
  compareTableData.value = temp;
};

watch(server.AccurancyDetail, (val: Record<string, any>) => {
  summaryInfo.value = val?.data?.failSummary ?? {};
  originTableData = transferCompareTableData(val?.data?.failDetailList);
  compareTableData.value = JSON.parse(JSON.stringify(originTableData));
});

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

onMounted(() => {
  server.getAccurancyDetail({ data: { loopInfo: props.loopInfo, rawMagic: props.rawMagic } });
});
</script>

<style lang="scss">
.abnormal-detail-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  .detail-magic-id {
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      font-size: 16px;
      cursor: pointer;
    }

    span {
      font-size: 16px;
      color: var(--devui-title-text);
      line-height: 16px;
    }
  }

  .com-graph-abnormal-detail-tabs-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .com-graph-report-tabs {
      margin-top: 4px;
      padding: 0;
    }
    .custom-sort-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--devui-secondary-text);
      cursor: pointer;
      span {
        line-height: 20px;
      }

      i {
        margin-top: 2px;
        font-size: 16px;
      }
    }
  }
}
</style>
