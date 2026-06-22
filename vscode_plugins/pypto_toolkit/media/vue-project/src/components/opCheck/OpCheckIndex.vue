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
            ref="diffCompareListRef"
            :key="selectedCompareId"
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
import { getOutputDetail } from '@/apis/workspace';

const { t } = useI18n();

const opeCheckDirPath = ref<Array<{ file_path: string; first_req: number }> | null>(null);

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
const diffCompareListRef = ref<{ clearSelection: () => void; resetFilter: () => void } | null>(null);

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

  const outputPath = query.outputPath as string;

  // 动态获取opeCheckDirPath，避免因opeCheckDirPath变化导致打开多个页面
  if (outputPath) {
    try {
      const detail = await getOutputDetail(outputPath);
      console.log('detail', detail);
      opeCheckDirPath.value = detail.data?.opeCheckDirPath ?? null;
      if (opeCheckDirPath.value && opeCheckDirPath.value.length > 0) {
        loadCompareFileList(opeCheckDirPath.value);
      }
    } catch (error) {
      console.error('[OpCheckIndex] Failed to get output detail:', error);
    }
  } 
});


const loadCompareFileList = (fileDataList: Array<{ file_path: string; first_req: number }>) => {
  compareFileList.value = fileDataList.map((item, index) => {
    const fileName = item.file_path.replace(/\\/g, '/').split('/').pop() || item.file_path;
    const parsedInfo = parseCompareFileName(fileName);

    // 根据 first_req 判断状态: -1 为 pending, 0 为 pass, >0 为 fail
    let status: 'pending' | 'parsed' | 'error' = 'pending';
    let failCount = 0;
    if (item.first_req === -1) {
      status = 'pending';
    } else if (item.first_req === 0) {
      status = 'parsed';
    } else if (item.first_req > 0) {
      status = 'error';
      failCount = item.first_req;
    }

    return {
      id: String(index + 1),
      fileNameA: parsedInfo.fileNameA,
      fileNameB: parsedInfo.fileNameB,
      status,
      time: parsedInfo.timestamp,
      failCount,
      fullFileName: fileName,
      cmpCsvPath: item.file_path,
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
  // 关闭侧栏精度报告并清除选中数据
  showDetail.value = false;
  selectedDetailData.value = null;

  selectedCompareId.value = data.id;
  currentPageOffset.value = 0;
  isLoadingMore.value = false;
  isInitialLoading.value = true;
  opCompareList.value = [];
  filterKeyword.value = undefined;
  filterRes.value = undefined;

  // 重置 DiffCompareList 的筛选状态
  diffCompareListRef.value?.resetFilter();

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
  console.log('1111')
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
    console.log('2222')
  }
};

const onFilterChange = (filterData: { keyword?: string; res?: string }) => {
  // 关闭侧栏精度报告并清除选中数据
  showDetail.value = false;
  selectedDetailData.value = null;

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
    console.log('3333')
  }
};

const onDiffItemClick = ({ data, source }: { data: OpCompareItem | null; source: 'left' | 'right' | null }) => {
  // 如果 data 为 null，说明是取消选中，关闭侧边栏
  if (!data || !source) {
    showDetail.value = false;
    selectedDetailData.value = null;
    return;
  }

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
    source,
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
  if (!data.cmpCsvPath) {
    console.warn('[OpCheckIndex] cmpCsvPath is empty, cannot jump to graph');
    return;
  }

  const { detailData } = data;

  // 根据 source 决定取哪个 Op 的值
  const isLeft = detailData.source === 'left';
  const funcHash = isLeft ? detailData.aOp?.aFuncHash || '' : detailData.bOp?.bFuncHash || '';
  const passName = isLeft ? detailData.aOp?.aPhaseName || '' : detailData.bOp?.bPhaseName || '';
  const funcMagicName = detailData.sharedRes?.pathFuncMagicName || '';

  if (!funcHash || !passName || !funcMagicName) {
    console.warn('[OpCheckIndex] Missing required parameters:', { funcHash, passName, funcMagicName });
    return;
  }

  try {
    await server.setCurAccuFilePathApi({
      filePath: data.cmpCsvPath,
      fileType: isLeft? 'op_A' : 'op_B',
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
  // 关闭侧边栏时取消列表选中状态
  diffCompareListRef.value?.clearSelection();
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