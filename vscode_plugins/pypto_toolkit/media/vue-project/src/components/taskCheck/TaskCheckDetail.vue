<template>
  <div class="task-check-detail-wrap">
    <div class="detail-header">
      <div class="header-text">
        <span class="task-name">{{ accuracyResultTitle }}</span>
      </div>
      <i class="icon-close header-close-btn" @click="onClose"></i>
    </div>
    <div class="result-bar">
      <div class="result-left">
        <span class="result-label">{{ t('taskCheck.accuracyResult') }}</span>
        <d-tooltip overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
          <i class="icon icon-helping"></i>
          <template #content>
            <span>{{ t('taskCheck.accuracyResultTip') }}</span>
          </template>
        </d-tooltip>
      </div>
      <div class="result-right" @click="onJump">
        <i class="icon-sharing"></i>
        {{ jumpText }}
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
import { onMounted, ref, watch, PropType, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AbnormalOverview from '../comGraph/precisionReport/abnormalOverview.vue';
import AbnormalCompare from '../comGraph/precisionReport/abnormalCompare.vue';
import PrecisionTabContent from '@/components/comGraph/precisionReport/common/PrecisionTabContent.vue';
import type { AbnormalNodeCompareListItem, AbnormalNodeOverviewInfo } from '../comGraph/precisionReport/precisionReport.types.js';
import { useViewServer } from '@/core/use-view-server';
import type { ITaskCheckViewServer } from 'ext:/view/servers/view-server-interface.js';

const { server } = useViewServer<ITaskCheckViewServer>();

export interface TaskDetailData {
  taskId: string;
  taskName: string;
  accuracy?: number;
  errors?: string[];
  details?: any[];
  aData?: Record<string, any>;
  bData?: Record<string, any>;
  summaryInfo?: TaskSummaryInfo;
  source?: 'left' | 'right';
  sharedRes?: Record<string, any>;
  loopVarInfos?: string;
  seqNo?: number;
}

export interface TaskSummaryInfo {
  fail?: string;
  warn?: string;
  tolCnt?: string;
  zeroCount?: string;
  totalCount?: string;
  dataType?: string;
  validShape?: string;
  loopInfo?: string;
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
  bTaskId?: string;
  bSeqNo?: string
}

const props = defineProps({
  detailData: {
    type: Object as PropType<TaskDetailData>,
    default: null,
  },
  jumpText: {
    type: String,
    default: '',
  },
  cmpCsvPath: {
    type: String,
    default: '',
  },
  swimGraphPath: {
    type: String,
    default: '',
  },
  leftTitle: {
    type: String,
    default: '',
  },
});

const emits = defineEmits(['close', 'jump-to-graph', 'jump-to-swim-graph']);

const { t } = useI18n();
const tabContentRef = ref();
const compareEl = ref();

// 精度结果标题：task_xx(a)，xx是数据项编号，a是数据列来源
const accuracyResultTitle = computed(() => {
  const taskName = props.detailData?.taskName || '';
  const source = props.detailData?.source;
  // 左侧显示左侧顶部标题，右侧显示 'task_dump'
  const sourceLabel = source === 'left' ? props.leftTitle : 'task_dump';
  return `task_${taskName}(${sourceLabel})`;
});

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

// TODO: 后期对接真实后端接口时，从 server.precisionExceptList 获取数据
// 当前使用模拟数据
const loadMockCompareData = () => {
  // 模拟对比数据
  const mockData = [
    {
      offset: '0x001',
      offsetRaw: '0x001_raw',
      aValue: '1.234',
      bValue: '1.235',
      abRe: '0.001',
      abAe: '0.001',
      abTol: '0.01',
    },
    {
      offset: '0x002',
      offsetRaw: '0x002_raw',
      aValue: '2.456',
      bValue: '2.457',
      abRe: '0.002',
      abAe: '0.001',
      abTol: '0.01',
    },
    {
      offset: '0x003',
      offsetRaw: '0x003_raw',
      aValue: '3.789',
      bValue: '3.790',
      abRe: '0.003',
      abAe: '0.001',
      abTol: '0.01',
    },
  ];

  originTableData = mockData;
  compareTableData.value = JSON.parse(JSON.stringify(originTableData));
};

// 数据转换函数：将后端数据转换为表格数据格式
const transferCompareTableData = (data: any[]): AbnormalNodeCompareListItem[] => {
  return data.map((item) => ({
    offset: item.OFFSET || '',
    offsetRaw: item.OFFSET_RAW || '',
    aValue: item.A_data || '',
    bValue: item.B_data || '',
    abRe: item.AB_re || '',
    abAe: item.AB_ae || '',
    abTol: item.AB_tol || '',
  }));
};

// 监听后端返回的精度异常数据
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
    if (newDetailData) {
      // 使用传入的 summaryInfo 数据
      if (newDetailData.summaryInfo) {
        summaryInfo.value = {
          dataType: newDetailData.summaryInfo.dataType || '',
          validShape: newDetailData.summaryInfo.validShape || '',
          loopInfo: newDetailData.summaryInfo.loopInfo || '',
          rtolAtol: newDetailData.summaryInfo.rtolAtol || '0.001, 0.001',
          totalCount: newDetailData.summaryInfo.totalCount || '0',
          zeroCount: newDetailData.summaryInfo.zeroCount || '0',
          tolCnt: newDetailData.summaryInfo.tolCnt || '0',
          warn: newDetailData.summaryInfo.warn || '0',
          fail: newDetailData.summaryInfo.fail || '0',
          cntTotalZeroInfnanCnt: newDetailData.summaryInfo.cntTotalZeroInfnanCnt || '0/0/0',
          cntFailWarnTol: newDetailData.summaryInfo.cntFailWarnTol || '0/0',
          mre: newDetailData.summaryInfo.mre || '0.001',
          mreTop8: newDetailData.summaryInfo.mreTop8 || '0.002',
          mreTop1permil: newDetailData.summaryInfo.mreTop1permil || '0.003',
          mae: newDetailData.summaryInfo.mae || '0.001',
          maeTop8: newDetailData.summaryInfo.maeTop8 || '0.002',
          maeTop1permil: newDetailData.summaryInfo.maeTop1permil || '0.003',
          aMax: newDetailData.summaryInfo.aMax || '',
          aMin: newDetailData.summaryInfo.aMin || '',
          aAvg: newDetailData.summaryInfo.aAvg || '',
          aAavg: newDetailData.summaryInfo.aAavg || '',
          aInfnan: newDetailData.summaryInfo.aInfnan || '',
          bMax: newDetailData.summaryInfo.bMax || '',
          bMin: newDetailData.summaryInfo.bMin || '',
          bAvg: newDetailData.summaryInfo.bAvg || '',
          bAavg: newDetailData.summaryInfo.bAavg || '',
          bInfnan: newDetailData.summaryInfo.bInfnan || '',
          bTaskId: newDetailData.summaryInfo?.bTaskId || '',
          bSeqNo: newDetailData.summaryInfo?.bSeqNo || '',
        };
      }
    }
  },
  { immediate: true, deep: true },
);

// 监听 fileName 变化，加载精度异常数据
watch(
  () => props.detailData?.sharedRes?.fileName,
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

const onClose = () => {
  emits('close');
};

const onJump = () => {
  // 根据 source 决定跳转到计算图还是泳道图
  if (props.detailData?.source === 'left') {
    emits('jump-to-graph', { detailData: props.detailData, source: props.detailData?.source, cmpCsvPath: props.cmpCsvPath });
  } else {
    emits('jump-to-swim-graph', { seqNo: summaryInfo.value.bSeqNo, taskId: summaryInfo.value.bTaskId });
  }
};

onMounted(() => {
  // 组件挂载时加载精度异常数据
  if (props.cmpCsvPath && props.detailData?.sharedRes?.fileName) {
    const filePath = props.cmpCsvPath.replace(/\.csv$/i, '');
    const fileName = props.detailData.sharedRes.fileName.replace(/\.data$/i, '').replace(/-/g, '~');
    server.getPrecisionExceptList({
      filePath,
      fileName,
    });
  }
});
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.task-check-detail-wrap {
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