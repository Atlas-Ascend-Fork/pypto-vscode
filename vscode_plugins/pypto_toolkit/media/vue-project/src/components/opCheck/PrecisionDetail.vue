<template>
  <div class="precision-detail-wrap">
    <div class="detail-header">
      <div class="header-text">
        <span class="op-name">{{ detailData?.opName || '-' }}</span>
      </div>
      <i class="icon-close header-close-btn" @click="onClose"></i>
    </div>
    <div class="result-bar">
      <div class="result-left">
        <span class="result-label">{{ t('opCheck.precisionResult') }}</span>
        <d-tooltip overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
          <i class="icon icon-helping"></i>
          <template #content>
            <span>{{ t('opCheck.precisionResultTip') }}</span>
          </template>
        </d-tooltip>
      </div>
      <div class="result-right" @click="onJumpToGraph">
        <i class="icon-sharing"></i>
        {{ t('opCheck.jumpToComGraph') }}
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
        <AbnormalCompare ref="compareEl" :table-data="compareTableData" @sort="onSingleColumnSort" />
      </template>
    </PrecisionTabContent>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import AbnormalOverview from '../comGraph/precisionReport/abnormalOverview.vue';
import AbnormalCompare from '../comGraph/precisionReport/abnormalCompare.vue';
import PrecisionTabContent from '@/components/comGraph/precisionReport/common/PrecisionTabContent.vue';
import { useViewServer } from '@/core/use-view-server';
import type { IOpCheckViewServer } from 'ext:/view/servers/view-server-interface.js';
import type { AbnormalNodeCompareListItem, AbnormalNodeOverviewInfo } from '../comGraph/precisionReport/precisionReport.types.js';

export interface CompareItem {
  field: string;
  baseValue: string;
  compareValue: string;
  isMismatch: boolean;
}

export interface SummaryInfo {
  rtolAtol?: string;
  cntTotalZeroInfnanCnt?: string;
  cntFailWarnTol?: string;
  mre?: string;
  mreTop8?: string;
  mreTop1permil?: string;
  mae?: string;
  maeTop8?: string;
  maeTop1permil?: string;
  aMax?: string;
  aMin?: string;
  aAvg?: string;
  aAavg?: string;
  aInfnan?: string;
  bMax?: string;
  bMin?: string;
  bAvg?: string;
  bAavg?: string;
  bInfnan?: string;
}

export interface PrecisionDetailData {
  id: string;
  opName: string;
  dtype?: string;
  shape?: string;
  summaryInfo?: SummaryInfo;
  baseTitle?: string;
  compareTitle?: string;
  compareList?: CompareItem[];
  source?: 'left' | 'right';
  aOp?: {
    aFuncMagic?: string;
    aFuncHash?: string;
    aPhaseName?: string;
    aOpMagic?: string;
    aFileName?: string;
    aMax?: string;
    aMin?: string;
    aAvg?: string;
    aAavg?: string;
    aInfnan?: string;
  };
  bOp?: {
    bFuncMagic?: string;
    bFuncHash?: string;
    bPhaseName?: string;
    bOpMagic?: string;
    bFileName?: string;
    bMax?: string;
    bMin?: string;
    bAvg?: string;
    bAavg?: string;
    bInfnan?: string;
  };
  sharedRes?: {
    pathFuncMagicName?: string;
    dataType?: string;
    validShape?: string;
    abRtolAtol?: string;
    abTotalZeroInfnanCnt?: string;
    abFailWarnTol?: string;
    abMre?: string;
    abMreTop8?: string;
    abMreTop1permil?: string;
    abMae?: string;
    abMaeTop8?: string;
    abMaeTop1permil?: string;
  };
  fileName?: string;
}
export interface PrecisionExceptItem {
  GROUP: string;
  INDEX: string;
  OFFSET: string;
  OFFSET_RAW: string;
  A_data: string;
  B_data: string;
  AB_ae: string;
  AB_re: string;
  AB_tol: string;
}

const props = defineProps({
  detailData: {
    type: Object as PropType<PrecisionDetailData>,
    default: null,
  },
  cmpCsvPath: {
    type: String,
    default: '',
  },
});

const emits = defineEmits(['jumpToGraph', 'close']);

const { t } = useI18n();
const { server } = useViewServer<IOpCheckViewServer>();
const tabContentRef = ref();
const compareEl = ref();

const summaryInfo = ref<AbnormalNodeOverviewInfo>({});
const compareTableData = ref<AbnormalNodeCompareListItem[]>([]);
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

function transferCompareTableData(data: Record<string, any>[]): AbnormalNodeCompareListItem[] {
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

watch(
  () => server.precisionExceptList.value,
  (newValue) => {
    if (newValue && Array.isArray(newValue)) {
      originTableData = transferCompareTableData(newValue);
      compareTableData.value = JSON.parse(JSON.stringify(originTableData));
    } else if (newValue === null) {
      originTableData = [];
      compareTableData.value = [];
    }
  },
  { deep: true, immediate: true },
);

watch(
  () => props.detailData,
  (newDetailData) => {
    if (newDetailData?.sharedRes) {
      const sharedRes = newDetailData.sharedRes;
      summaryInfo.value = {
        dataType: sharedRes.dataType || newDetailData.dtype || '',
        validShape: sharedRes.validShape || newDetailData.shape || '',
        rtolAtol: sharedRes.abRtolAtol || '',
        cntTotalZeroInfnanCnt: sharedRes.abTotalZeroInfnanCnt || '',
        cntFailWarnTol: sharedRes.abFailWarnTol || '',
        mre: sharedRes.abMre || '',
        mreTop8: sharedRes.abMreTop8 || '',
        mreTop1permil: sharedRes.abMreTop1permil || '',
        mae: sharedRes.abMae || '',
        maeTop8: sharedRes.abMaeTop8 || '',
        maeTop1permil: sharedRes.abMaeTop1permil || '',
        aMax: newDetailData.aOp?.aMax || '',
        aMin: newDetailData.aOp?.aMin || '',
        aAvg: newDetailData.aOp?.aAvg || '',
        aAavg: newDetailData.aOp?.aAavg || '',
        aInfnan: newDetailData.aOp?.aInfnan || '',
        bMax: newDetailData.bOp?.bMax || '',
        bMin: newDetailData.bOp?.bMin || '',
        bAvg: newDetailData.bOp?.bAvg || '',
        bAavg: newDetailData.bOp?.bAavg || '',
        bInfnan: newDetailData.bOp?.bInfnan || '',
      };
    } else if (newDetailData?.summaryInfo) {
      summaryInfo.value = {
        dataType: newDetailData.dtype || '',
        validShape: newDetailData.shape || '',
        ...newDetailData.summaryInfo,
      };
    }
  },
  { immediate: true, deep: true },
);

const onJumpToGraph = () => {
  emits('jumpToGraph', { detailData: props.detailData, cmpCsvPath: props.cmpCsvPath });
};

const onClose = () => {
  emits('close');
};

watch(
  () => props.detailData?.fileName,
  (newFileName) => {
    if (props.cmpCsvPath && newFileName) {
      const filePath = props.cmpCsvPath.replace(/\.csv$/i, '');
      const fileName = newFileName.replace(/\.data$/i, '').replace(/-/g, '~');
      server.getPrecisionExceptList({
        filePath,
        fileName,
      });
    }
  },
  { immediate: false },
);

onMounted(() => {
  if (props.cmpCsvPath && props.detailData?.fileName) {
    const filePath = props.cmpCsvPath.replace(/\.csv$/i, '');
    const fileName = props.detailData.fileName.replace(/\.data$/i, '').replace(/-/g, '~');
    server.getPrecisionExceptList({
      filePath,
      fileName,
    });
  }
});
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.precision-detail-wrap {
  height: 100%;
  padding: 16px;
  width: 480px;
  background: var(--control-flow-bg);
  border-left: 1px solid var(--devui-split-line);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-sizing: border-box;

  .detail-header {
    overflow: hidden;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    .header-text {
      display: flex;
      align-items: center;
      font-size: 18px;
      font-weight: 700;
      color: var(--devui-title-text);
    }

    .header-close-btn {
      font-size: 16px;
      cursor: pointer;
      color: var(--devui-secondary-text);
      z-index: 1;

      &:hover {
        color: var(--devui-title-text);
      }
    }
  }

  .result-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--control-flow-bg);
    border-radius: 6px;

    .result-left {
      display: flex;
      align-items: center;
      gap: 6px;

      .result-label {
        font-size: 14px;
        font-weight: 500;
        color: var(--devui-primary-text);
      }

      .result-tip {
        font-size: 14px;
        color: var(--devui-secondary-text);
        cursor: help;
      }
    }

    .result-right {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      color: var(--devui-title-text);

      &:hover {
        color: var(--devui-brand-active);
      }

      i {
        font-size: 16px;
      }
    }
  }
}
</style>