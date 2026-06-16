<template>
  <div class="opcheck-layout-container">
    <CompareList :file-list="compareFileList" :selected-id="selectedCompareId" @select="onCompareSelect" />

    <div class="opcheck-main-content">
      <div v-if="!hasCompareData" class="empty-state">
        <div class="empty-icon">
          <i class="icon-compare"></i>
        </div>
        <div class="empty-text">{{ t('opCheck.emptyTip') }}</div>
      </div>

      <template v-else>
        <div class="diff-view-container" :class="{ 'with-detail': showDetail }">
          <DiffCompareList
            :left-title="leftTitle"
            :right-title="rightTitle"
            :data-list="opCompareList"
            :sync-scroll="syncScrollEnabled"
            :has-more="hasMoreData"
            :loading="isLoadingMore"
            :initial-loading="isInitialLoading"
            @loadMore="onLoadMore"
            @item-click="onDiffItemClick"
            @filter-change="onFilterChange"
          />

          <div v-if="showDetail" class="detail-panel">
            <PrecisionDetail
              :detail-data="selectedDetailData"
              :cmp-csv-path="selectedCmpCsvPath"
              @jumpToGraph="onJumpToGraph"
              @close="onCloseDetail"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type CompareFileItem } from './CompareList.vue';
import { type OpCompareItem } from './DiffCompareList.vue';
import { type PrecisionDetailData, type CompareItem, type SummaryInfo } from './PrecisionDetail.vue';
import CompareList from './CompareList.vue';
import DiffCompareList from './DiffCompareList.vue';
import PrecisionDetail from './PrecisionDetail.vue';
import { getQuery } from '@/core/query';
import { useViewServer } from '@/core/use-view-server.js';
import { OpCheckViewServer } from 'ext:/view/servers/opcheck-server.js';

const { t } = useI18n();

const opeCheckDirPath = ref<string[] | null>(null);

const compareFileList = ref<CompareFileItem[]>([]);

const selectedCompareId = ref<string>('');
const hasCompareData = computed(() => !!selectedCompareId.value);

const leftTitle = ref('Base');
const rightTitle = ref('Compare');
const syncScrollEnabled = ref(true);

const opCompareList = ref<OpCompareItem[]>([]);
const totalCount = ref(0);
const currentPageOffset = ref(0);
const pageSize = 30;
const isLoadingMore = ref(false);
const isInitialLoading = ref(false);

const filterKeyword = ref<string | undefined>(undefined);
const filterRes = ref<string | undefined>(undefined);
const isFilterOperation = ref(false);

const hasMoreData = computed(() => opCompareList.value.length < totalCount.value);

const showDetail = ref(false);
const selectedDetailData = ref<PrecisionDetailData | null>(null);
const selectedCmpCsvPath = ref<string>('');

const { server } = useViewServer<OpCheckViewServer>();

// 监听后端返回的 diff 数据
watch(
  () => server.cmpDiffList.value,
  (newValue) => {
    console.log('[OpCheckIndex] cmpDiffList changed:', newValue);
    isLoadingMore.value = false;
    isInitialLoading.value = false;

    if (newValue && typeof newValue === 'object' && 'diffList' in newValue) {
      const { diffList, total, failRes } = newValue as { diffList: any[]; total?: number; failRes?: number };

      if (currentPageOffset.value === 0) {
        // readFlag=false 时后端返回 total=0 和 failRes=-1，此时不更新这些值
        if (total !== undefined && total > 0) {
          totalCount.value = total;
        }
        if (selectedCompareId.value && failRes !== undefined && failRes >= 0 && !isFilterOperation.value) {
          const selectedItemIndex = compareFileList.value.findIndex((item) => item.id === selectedCompareId.value);
          if (selectedItemIndex !== -1) {
            compareFileList.value[selectedItemIndex].failCount = failRes;
            compareFileList.value[selectedItemIndex].status = failRes === 0 ? 'parsed' : 'error';
          }
        }
        isFilterOperation.value = false;
      }

      if (!diffList || diffList.length === 0) {
        console.log('[OpCheckIndex] diffList is empty, skip');
        return;
      }

      const startId = opCompareList.value.length;
      const adaptedList: OpCompareItem[] = diffList.map((item, index) => ({
        id: String(startId + index + 1),
        aOp: item.aOp || null,
        bOp: item.bOp || null,
        compareRes: item.compareRes === '0' || item.compareRes === 'PASS' ? 'Pass' : 'Fail',
        sharedRes: item.sharedRes || {},
      }));

      console.log('[OpCheckIndex] adaptedList length:', adaptedList.length, 'current opCompareList length:', opCompareList.value.length);

      if (currentPageOffset.value > 0) {
        opCompareList.value = [...opCompareList.value, ...adaptedList];
        console.log('[OpCheckIndex] Appended data, new length:', opCompareList.value.length);
      } else {
        opCompareList.value = adaptedList;
        console.log('[OpCheckIndex] Replaced data, new length:', opCompareList.value.length);
      }
    } else {
      console.log('[OpCheckIndex] newValue is not valid:', newValue);
    }
  },
  { deep: true },
);

onMounted(async () => {
  const query = await getQuery();
  opeCheckDirPath.value = query.opeCheckDirPath as string[] | null;
  if (opeCheckDirPath.value && opeCheckDirPath.value.length > 0) {
    loadCompareFileList(opeCheckDirPath.value);
  }
});

const loadCompareFileList = (filePaths: string[]) => {
  compareFileList.value = filePaths.map((path, index) => {
    const fileName = path.replace(/\\/g, '/').split('/').pop() || path;
    const parsedInfo = parseCompareFileName(fileName);
    return {
      id: String(index + 1),
      fileNameA: parsedInfo.fileNameA,
      fileNameB: parsedInfo.fileNameB,
      status: 'pending',
      time: parsedInfo.timestamp,
      failCount: 0,
      fullFileName: fileName,
      cmpCsvPath: path,
    };
  });
};

const parseCompareFileName = (fileName: string): { fileNameA: string; fileNameB: string; timestamp: string } => {
  const defaultResult = { fileNameA: 'Base', fileNameB: fileName, timestamp: '' };
  const match = fileName.match(/^verify_graph_result_cmp~([^~]+)~([^~]+)~(\d+)\.csv$/);
  if (match) {
    const timestampNum = parseInt(match[3], 10) / 1000;
    const date = new Date(timestampNum);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day}`;
    return {
      fileNameA: match[1],
      fileNameB: match[2],
      timestamp: formattedDate,
    };
  }
  return defaultResult;
};

const onCompareSelect = (data: CompareFileItem) => {
  selectedCompareId.value = data.id;
  currentPageOffset.value = 0;
  isLoadingMore.value = false;
  isInitialLoading.value = true;
  opCompareList.value = [];
  filterKeyword.value = undefined;
  filterRes.value = undefined;

  leftTitle.value = data.fileNameA;
  rightTitle.value = data.fileNameB;

  // 已导入过的文件不需要重复读取
  const needRead = data.status === 'pending';

  server.getCmpDiffListData({
    cmpCsvPath: data.cmpCsvPath,
    pageSize: pageSize,
    startOffset: 0,
    keyword: undefined,
    res: undefined,
    readFlag: needRead,
  });
};

// 数据会通过 watch(server.cmpDiffList) 自动填充，此函数保留用于后续扩展
const loadOpCompareData = (compareItem: CompareFileItem) => {
  // 标题已在上层设置，数据通过 watch 自动填充
  // 此函数保留用于后续可能的数据处理
};

const onLoadMore = () => {
  if (isLoadingMore.value || !hasMoreData.value) {
    return;
  }
  isLoadingMore.value = true;
  const nextPageOffset = currentPageOffset.value + 1;
  currentPageOffset.value = nextPageOffset;

  const selectedItem = compareFileList.value.find((item) => item.id === selectedCompareId.value);
  if (selectedItem) {
    server.getCmpDiffListData({
      cmpCsvPath: selectedItem.cmpCsvPath,
      pageSize: pageSize,
      startOffset: nextPageOffset,
      keyword: filterKeyword.value,
      res: filterRes.value,
      readFlag: false,
    });
  }
};

const onFilterChange = (filterData: { keyword?: string; res?: string }) => {
  filterKeyword.value = filterData.keyword;
  filterRes.value = filterData.res;
  currentPageOffset.value = 0;
  isLoadingMore.value = true;
  opCompareList.value = [];
  isFilterOperation.value = true;

  const selectedItem = compareFileList.value.find((item) => item.id === selectedCompareId.value);
  if (selectedItem) {
    server.getCmpDiffListData({
      cmpCsvPath: selectedItem.cmpCsvPath,
      pageSize: pageSize,
      startOffset: 0,
      keyword: filterData.keyword,
      res: filterData.res,
      readFlag: false,
    });
  }
};

const onDiffItemClick = ({ data, source }: { data: OpCompareItem; source: 'left' | 'right' }) => {
  const selectedItem = compareFileList.value.find((item) => item.id === selectedCompareId.value);
  if (selectedItem) {
    selectedCmpCsvPath.value = selectedItem.cmpCsvPath;
  }

  const compareList: CompareItem[] = [];
  if (data.aOp || data.bOp) {
    const fields = ['Format', 'FuncMagic', 'Opcode', 'OpMagic', 'PhaseName', 'RawShape'];
    fields.forEach((field) => {
      const aKey = `a${field}` as keyof typeof data.aOp;
      const bKey = `b${field}` as keyof typeof data.bOp;
      const baseValue = data.aOp?.[aKey] || '';
      const compareValue = data.bOp?.[bKey] || '';
      compareList.push({
        field,
        baseValue: String(baseValue),
        compareValue: String(compareValue),
        isMismatch: baseValue !== compareValue,
      });
    });
  }

  const sharedRes = data.sharedRes || {};
  const summaryInfo: SummaryInfo = sharedRes;

  // 根据 source 决定显示哪个 Opcode：左侧点击显示 aOp.aOpcode，右侧点击显示 bOp.bOpcode
  const opName = source === 'left' ? data.aOp?.aOpcode || '-' : data.bOp?.bOpcode || '-';

  selectedDetailData.value = {
    id: data.id,
    opName,
    dtype: sharedRes.dataType || '',
    shape: sharedRes.validShape || '',
    summaryInfo,
    baseTitle: leftTitle.value,
    compareTitle: rightTitle.value,
    compareList,
    aOp: data.aOp
      ? {
          aFuncMagic: data.aOp.aFuncMagic,
          aFuncHash: data.aOp.aFuncHash,
          aPhaseName: data.aOp.aPhaseName,
          aOpMagic: data.aOp.aOpMagic,
          aFileName: data.aOp.aFileName,
          aMax: data.aOp.aMax,
          aMin: data.aOp.aMin,
          aAvg: data.aOp.aAvg,
          aAavg: data.aOp.aAavg,
          aInfnan: data.aOp.aInfnan,
        }
      : undefined,
    bOp: data.bOp
      ? {
          bFuncMagic: data.bOp.bFuncMagic,
          bFuncHash: data.bOp.bFuncHash,
          bPhaseName: data.bOp.bPhaseName,
          bOpMagic: data.bOp.bOpMagic,
          bFileName: data.bOp.bFileName,
          bMax: data.bOp.bMax,
          bMin: data.bOp.bMin,
          bAvg: data.bOp.bAvg,
          bAavg: data.bOp.bAavg,
          bInfnan: data.bOp.bInfnan,
        }
      : undefined,
    sharedRes: data.sharedRes,
    fileName: source === 'left' ? data.aOp?.aFileName || '' : data.bOp?.bFileName || '',
  };
  showDetail.value = true;
};

const onJumpToGraph = async (data: { detailData: PrecisionDetailData; cmpCsvPath: string }) => {
  console.log('[OpCheckIndex] jumpToGraph:', data);

  if (!data.cmpCsvPath) {
    console.warn('[OpCheckIndex] cmpCsvPath is empty, cannot jump to graph');
    return;
  }

  const { detailData } = data;

  const funcHash = detailData.aOp?.aFuncHash || detailData.bOp?.bFuncHash || '';
  const passName = detailData.aOp?.aPhaseName || detailData.bOp?.bPhaseName || '';
  const funcMagicName = detailData.sharedRes?.pathFuncMagicName || '';

  if (!funcHash || !passName || !funcMagicName) {
    console.warn('[OpCheckIndex] Missing required parameters:', { funcHash, passName, funcMagicName });
    return;
  }

  try {
    await server.setCurAccuFilePathApi({
      filePath: data.cmpCsvPath,
      fileType: 'op',
    });
    console.log('[OpCheckIndex] setCurAccuFilePathApi success');

    await server.openCmpDiffComGraphApi({
      filePath: data.cmpCsvPath,
      funcHash,
      passName,
      funcMagicName,
    });
    console.log('[OpCheckIndex] openCmpDiffComGraphApi success');
  } catch (error) {
    console.error('[OpCheckIndex] jumpToGraph error:', error);
  }
};

const onCloseDetail = () => {
  showDetail.value = false;
  selectedDetailData.value = null;
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.opcheck-layout-container {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background-color: var(--devui-base-bg);
}

.opcheck-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0; // 确保flex子元素可以正确收缩
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--devui-secondary-text);

  .empty-icon {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;

    i {
      font-size: 48px;
      color: var(--devui-placeholder-text);
    }
  }

  .empty-text {
    font-size: 14px;
    color: var(--devui-secondary-text);
  }
}

.diff-view-container {
  flex: 1;
  display: flex;
  overflow: hidden;

  &.with-detail {
    .diff-compare-container {
      flex: 1;
      min-width: 400px; // 确保对比列表有最小宽度
    }
  }
}

.detail-panel {
  width: 480px;
  min-width: 300px;
  max-width: 50%; // 最大宽度不超过父容器的50%
  flex-shrink: 0;
  overflow: hidden;
}
</style>