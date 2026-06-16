<template>
  <div class="abnormal-detail-wrap">
    <div class="detail-magic-id">
      <div class="magic-id-text">
        <i class="icon icon-chevron-left-2" @click="() => emits('back')"></i>
        Raw Magic ID: {{ rawMagic }}
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
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AbnormalOverview from './abnormalOverview.vue';
import AbnormalCompare from './abnormalCompare.vue';
import PrecisionTabContent from './common/PrecisionTabContent.vue';
import { useViewServer } from '@/core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import type { AbnormalNodeCompareListItem, AbnormalNodeOverviewInfo } from './precisionReport.types';

const props = defineProps({
  loopInfo: String,
  rawMagic: String,
});
const emits = defineEmits(['back']);
const { t } = useI18n();
const { server } = useViewServer<IComViewServer>();

const tabContentRef = ref();
const compareTableData = ref<AbnormalNodeCompareListItem[]>([]);
const compareEl = ref();
const summaryInfo = ref<AbnormalNodeOverviewInfo>({});
let originTableData: AbnormalNodeCompareListItem[] = [];

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

<style lang="scss" scoped>
.abnormal-detail-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;

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
