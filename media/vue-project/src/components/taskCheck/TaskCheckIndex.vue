<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<template>
  <div class="taskcheck-layout-container">
    <TaskCheckList :task-list="taskFileList" :selected-id="selectedTaskId" @select="onTaskSelect" />

    <div class="taskcheck-main-content">
      <div v-if="!hasTaskData" class="empty-state">
        <div class="empty-icon">
          <i class="icon-task"></i>
        </div>
        <div class="empty-text">{{ t('taskCheck.emptyTip') }}</div>
      </div>

      <template v-else>
        <div class="task-view-container" :class="{ 'with-detail': showDetail }">
          <!-- 中间区域：未选择 compareList 数据项时显示空页面提示 -->
          <div v-if="!selectedTaskId" class="center-empty-state">
            <div class="center-empty-icon">
              <i class="icon-compare"></i>
            </div>
            <div class="center-empty-text">{{ t('taskCheck.centerEmptyTip') }}</div>
          </div>

          <!-- 中间区域：已选择数据项 -->
          <div v-else class="task-center-content">
            <TaskDiffList
              ref="taskDiffListRef"
              :task-title="taskTitle"
              :left-title="leftTitle"
              :right-title="rightTitle"
              :data-list="taskDiffList"
              :has-more="hasMoreData"
              :loading="isLoadingMore"
              :initial-loading="isInitialLoading"
              @item-click="onDiffItemClick"
              @filter-change="onFilterChange"
              @load-more="onLoadMore"
            />
          </div>

          <div v-if="showDetail">
            <TaskCheckDetail
              :detail-data="selectedDetailData"
              :jump-text="jumpText"
              :cmp-csv-path="selectedTaskCsvPath"
              :swim-graph-path="swimGraphPath"
              :left-title="leftTitle"
              @close="onCloseDetail"
              @jump-to-graph="onJumpToGraph"
              @jump-to-swim-graph="onJumpToSwimGraph"
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
import { type TaskFileItem } from './TaskCheckList.vue';
import { type TaskDiffItem } from './TaskDiffList.vue';
import { type TaskDetailData } from './TaskCheckDetail.vue';
import TaskCheckList from './TaskCheckList.vue';
import TaskDiffList from './TaskDiffList.vue';
import TaskCheckDetail from './TaskCheckDetail.vue';
import { getQuery } from '@/core/query';
import { useViewServer } from '@/core/use-view-server.js';
import { TaskCheckViewServer } from 'ext:/view/servers/taskcheck-server.js';
import { fetchRunDataDetail } from '@/apis/workspace';

const { t } = useI18n();

const taskCheckDirPath = ref<Array<{ file_path: string; first_req: number }> | null>(null);

const taskFileList = ref<TaskFileItem[]>([]);
const taskDiffList = ref<TaskDiffItem[]>([]);

const selectedTaskId = ref<string>('');
const selectedTaskCsvPath = ref<string>('');
const hasTaskData = computed(() => taskFileList.value.length > 0);

const showDetail = ref(false);
const selectedDetailData = ref<TaskDetailData | null>(null);

const taskTitle = ref('Task Check');
const leftTitle = ref('CodegenPreproc');
const rightTitle = ref('task_dump');

const isLoadingMore = ref(false);
const isInitialLoading = ref(false);
const hasMoreData = ref(true);
const currentPage = ref(0);
const pageSize = 50;
const isFilterOperation = ref(false);

const currentFilterConditions = ref<{
  keyword?: string;
  res?: string;
  opMagic?: string;
  rawMagic?: string;
  tensorAddr?: string;
  symbol?: string;
  funcHash?: string;
}>({});

const jumpText = ref('');

const computeGraphDirPath = ref<string>('');
const flowVerifyPath = ref<string>('');
const swimGraphPath = ref<string>('');

const taskDiffListRef = ref<{ resetFilter: () => void; clearSelection: () => void } | null>(null);

const { server } = useViewServer<TaskCheckViewServer>();

// 监听后端返回的 detail 数据
watch(
  () => server.taskDetail?.value,
  (newValue: Record<string, any>) => {
    if (newValue && typeof newValue === 'object') {
      selectedDetailData.value = {
        taskId: newValue.taskId || '',
        taskName: newValue.taskName || '',
        accuracy: newValue.accuracy || 0,
        errors: newValue.errors || [],
        details: newValue.details || [],
      };
      showDetail.value = true;
    }
  },
  { deep: true },
);

// 监听后端返回的 taskCmpDiffList 数据
watch(
  () => server.taskCmpDiffList.value,
  (newValue) => {
    isLoadingMore.value = false;
    isInitialLoading.value = false;

    if (newValue && typeof newValue === 'object' && 'diffList' in newValue) {
      const { diffList, total, failRes } = newValue as { diffList: any[]; total?: number; failRes?: number };

      // 第一页且不是筛选操作时，更新状态
      if (currentPage.value === 0) {
        // readFlag=false 时后端返回 total=0 和 failRes=-1，此时不更新这些值
        if (total !== undefined && total > 0) {
          // 可以在这里更新总数
        }
        
        // 仅当状态为 pending 时更新状态
        if (selectedTaskId.value && failRes !== undefined && failRes >= 0 && !isFilterOperation.value) {
          const selectedItemIndex = taskFileList.value.findIndex((item) => item.id === selectedTaskId.value);
          if (selectedItemIndex !== -1 && taskFileList.value[selectedItemIndex].status === 'pending') {
            taskFileList.value[selectedItemIndex].failCount = failRes;
            taskFileList.value[selectedItemIndex].status = failRes === 0 ? 'pass' : 'fail';
          }
        }
        isFilterOperation.value = false;
      }

      if (!diffList || diffList.length === 0) {
        // 筛选/搜索返回空数据时，清空列表并设置无更多数据
        if (currentPage.value === 0) {
          taskDiffList.value = [];
        }
        hasMoreData.value = false;
        return;
      }

      // 转换后端数据格式为前端需要的格式
      const startId = taskDiffList.value.length;
      const newDiffList = diffList.map((item: any, index: number) => {
        return {
          id: item.sharedRes?.no || String(startId + index + 1),
          taskName: item.sharedRes?.no || `TASK_${startId + index + 1}`,
          compareRes: item.compareRes === 'PASS' ? 'Pass' : 'Fail',
          // 公共数据（标题显示）
          opMagic: item.sharedRes?.rootCallOpmagic || '',
          rawMagic: item.sharedRes?.rootCallRawmagic || '',
          ioFlag: item.sharedRes?.ioFlag || '',
          funcHash: item.aOp?.aFuncHash || '',
          loopInfo: item.sharedRes?.loopInfo || '',
          execTimestamp: item.taskOp?.taskExecTimestamp || '',
          aData: {
            validShape: item.aOp?.aValidshape || '',
            dataType: item.aOp?.aDatatype || '',
            rootFuncHash: item.aOp?.aRootFuncHash || '',
            format: item.aOp?.aFormat || '',
            magic: item.aOp?.aMagic || '',
            opcode: item.aOp?.aOpcode || '',
            opMagic: item.aOp?.aOpMagic || '',
            symbol: item.aOp?.aSymbol || '',
            dynvalidshape: item.aOp?.aDynvalidshape || '',
            opAttrAtomic: item.aOp?.aOpAttrAtomic || '',
            funcHash: item.aOp?.aFuncHash || '',
            pathHash: item.aOp?.aPathHash || '',
            opAttrSymOffset: item.aOp?.aOpAttrSymOfst || '',
            rawMagic: item.aOp?.aRawMagic || '',
          },
          bData: {
            validShape: item.taskOp?.taskValidShape || '',
            rawShape: item.taskOp?.taskRawShape || '',
            tensorAddr: item.taskOp?.taskTensorAddr || '',
            dataType: item.taskOp?.taskDataType || '',
            seqNo: item.taskOp?.taskSeqNo || '',
            blockIdx: item.taskOp?.taskBlockIdx || '',
            opAttrSymOffset: item.taskOp?.taskOpAttrSymOfst || '',
            taskId: item.taskOp?.taskTaskId || '',
            timeStamp: item.taskOp?.taskTimestamp || '',
          },
          // 保留原始数据用于精度报告
          sharedRes: item.sharedRes || {},
          rawAOp: item.aOp || {},
          rawTaskOp: item.taskOp || {},
        };
      });

      // 如果是第一页，直接替换；否则追加
      if (currentPage.value === 0) {
        taskDiffList.value = newDiffList;
      } else {
        taskDiffList.value = [...taskDiffList.value, ...newDiffList];
      }

      // 判断是否还有更多数据
      hasMoreData.value = newDiffList.length >= pageSize;
    }
  },
  { deep: true },
);

onMounted(async () => {
  const query = await getQuery();
  const outputPath = query.outputPath as string;
  computeGraphDirPath.value = query.computeGraphDirPath as string;
  flowVerifyPath.value = query.flowVerifyPath as string;
  swimGraphPath.value = query.swimGraphPath as string;

  // 动态获取taskCheckDirPath，从中筛选出task check文件
  if (outputPath) {
    try {
      const detail = await fetchRunDataDetail(outputPath);

      taskCheckDirPath.value = detail.data?.taskCheckDirPath ?? null;

      if (taskCheckDirPath.value && taskCheckDirPath.value.length > 0) {
        loadTaskFileList(taskCheckDirPath.value);
      } else {
        console.warn('[TaskCheckIndex] taskCheckDirPath is empty or null');
      }
    } catch (error) {
      console.error('[TaskCheckIndex] Failed to get output detail:', error);
    }
  } else {
    console.warn('[TaskCheckIndex] outputPath is empty');
  }
});

const loadMockData = () => {
  // 模拟数据
  const mockFileDataList = [
    {
      file_path: '/path/to/verify_task_result_cmp~CodegenPreproc~178281824.csv',
      first_req: -1,
    },
    {
      file_path: '/path/to/verify_task_result_cmp~TaskScheCheck~178281825.csv',
      first_req: 0,
    },
    {
      file_path: '/path/to/verify_task_result_cmp~VectorEngine~178281826.csv',
      first_req: 3,
    },
    {
      file_path: '/path/to/verify_task_result_cmp~MemoryAlloc~178281827.csv',
      first_req: -1,
    },
  ];

  loadTaskFileList(mockFileDataList);
};

const loadTaskFileList = (fileDataList: Array<{ file_path: string; first_req: number }>) => {

  // 过滤出符合 task check 文件名格式的文件
  const taskCheckFiles = fileDataList.filter((item) => {
    const fileName = item.file_path.replace(/\\/g, '/').split('/').pop() || item.file_path;
    // 文件名格式: verify_task_result_cmp~CodegenPreproc~178281824.csv
    const isMatch = /^verify_task_result_cmp~[^~]+~\d+\.csv$/.test(fileName);
    return isMatch;
  });

  taskFileList.value = taskCheckFiles.map((item, index) => {
    const fileName = item.file_path.replace(/\\/g, '/').split('/').pop() || item.file_path;
    const parsedInfo = parseTaskFileName(fileName);

    // 根据 first_req 判断状态: -1 为 pending, 0 为 pass, >0 为 fail
    let status: 'pending' | 'pass' | 'fail' = 'pending';
    let failCount = 0;
    if (Number(item.first_req) === -1) {
      status = 'pending';
    } else if (Number(item.first_req) === 0) {
      status = 'pass';
    } else if (Number(item.first_req) > 0) {
      status = 'fail';
      failCount = Number(item.first_req);
    }

    return {
      id: String(index + 1),
      taskName: parsedInfo.taskName,
      status,
      time: parsedInfo.timestamp,
      failCount,
      fullFileName: fileName,
      taskCsvPath: item.file_path,
    };
  });
};

const parseTaskFileName = (fileName: string): { taskName: string; timestamp: string } => {
  const defaultResult = { taskName: fileName, timestamp: '' };
  // 文件名格式: verify_task_result_cmp~CodegenPreproc~178281824.csv
  const match = fileName.match(/^verify_task_result_cmp~([^~]+)~(\d+)\.csv$/);
  if (match) {
    const timestampNum = parseInt(match[2], 10) / 1000;
    const date = new Date(timestampNum);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDate = `${year}/${month}/${day}`;
    // 显示格式: CodegenPreproc->task_dump
    return {
      taskName: `${match[1]}->task_dump`,
      timestamp: formattedDate,
    };
  }
  return defaultResult;
};

const onTaskSelect = (data: TaskFileItem) => {
  selectedTaskId.value = data.id;
  selectedTaskCsvPath.value = data.taskCsvPath;
  isInitialLoading.value = true;
  currentPage.value = 0;
  currentFilterConditions.value = {};

  // 切换 compareList 数据项时关闭侧边精度报告
  showDetail.value = false;
  selectedDetailData.value = null;

  // 切换 compareList 数据项时清空搜索和筛选
  taskDiffListRef.value?.resetFilter();

  // 根据状态决定 readFlag：pending 为 true，pass/fail 为 false
  const readFlag = data.status === 'pending';
  // 调用后端接口获取真实数据
  if (data.taskCsvPath) {
    server.getTaskCmpDiffListData({
      cmpCsvPath: data.taskCsvPath,
      pageSize: pageSize,
      startOffset: 0,
      readFlag,
    });
  }

  // 更新标题
  const parsedTitle = parseTaskTitleFromName(data.taskName);
  taskTitle.value = data.taskName;
  leftTitle.value = parsedTitle.left;
  rightTitle.value = parsedTitle.right;
};

const onFilterChange = (filterData: { keyword?: string; res?: string; opMagic?: string; rawMagic?: string; tensorAddr?: string }) => {
  // 搜索过滤改变时关闭侧边精度报告
  showDetail.value = false;
  selectedDetailData.value = null;

  currentFilterConditions.value = { ...filterData };
  currentPage.value = 0;
  isInitialLoading.value = true;
  isFilterOperation.value = true;

  if (selectedTaskCsvPath.value) {
    server.getTaskCmpDiffListData({
      cmpCsvPath: selectedTaskCsvPath.value,
      pageSize: pageSize,
      startOffset: 0,
      readFlag: false, // 筛选时不需要重新读取 CSV
      ...currentFilterConditions.value,
    });
  }
};

const onLoadMore = () => {
  if (!hasMoreData.value || isLoadingMore.value || !selectedTaskCsvPath.value) {
    return;
  }

  isLoadingMore.value = true;
  currentPage.value += 1;

  server.getTaskCmpDiffListData({
    cmpCsvPath: selectedTaskCsvPath.value,
    pageSize: pageSize,
    startOffset: currentPage.value,
    readFlag: false, // 加载更多时不需要重新读取 CSV
    ...currentFilterConditions.value,
  });
};

const parseTaskTitleFromName = (taskName: string): { left: string; right: string } => {
  // 从 "CodegenPreproc->task_dump" 提取左右标题
  const parts = taskName.split('->');
  if (parts.length === 2) {
    return { left: parts[0], right: parts[1] };
  }
  return { left: taskName, right: 'task_dump' };
};

const onDiffItemClick = (data: { data: TaskDiffItem | null; source: 'left' | 'right' | null }) => {
  // 如果 data 为 null，说明是取消选中，关闭侧边栏
  if (!data || !data.data || !data.source) {
    return;
  }

  const { data: item, source } = data;

  // 设置跳转文本
  if (source === 'left') {
    jumpText.value = t('taskCheck.jumpToComGraph');
  } else {
    jumpText.value = t('taskCheck.jumpToSwimlane');
  }

  // 从 sharedRes 中提取精度报告数据
  const sharedRes = item.sharedRes || {};
  const summaryInfo = {
    dataType: sharedRes.dataType || item.aData?.dataType || '',
    validShape: sharedRes.validShape || item.aData?.validShape || '',
    loopInfo: item.loopInfo || '',
    rtolAtol: sharedRes.abRtolAtol || sharedRes.rtolAtol || '0.001, 0.001',
    cntTotalZeroInfnanCnt: sharedRes.abTotalZeroInfnanCnt || sharedRes.cntTotalZeroInfnanCnt || '0/0/0',
    cntFailWarnTol: sharedRes.abFailWarnTol || sharedRes.cntFailWarnTol || '0/0',
    mre: sharedRes.abMre || sharedRes.mre || '0.001',
    mreTop8: sharedRes.abMreTop8 || sharedRes.mreTop8 || '0.002',
    mreTop1permil: sharedRes.abMreTop1permil || sharedRes.mreTop1permil || '0.003',
    mae: sharedRes.abMae || sharedRes.mae || '0.001',
    maeTop8: sharedRes.abMaeTop8 || sharedRes.maeTop8 || '0.002',
    maeTop1permil: sharedRes.abMaeTop1permil || sharedRes.maeTop1permil || '0.003',
    aMax: item.rawAOp?.aMax || sharedRes.aMax || '',
    aMin: item.rawAOp?.aMin || sharedRes.aMin || '',
    aAvg: item.rawAOp?.aAvg || sharedRes.aAvg || '',
    aAavg: item.rawAOp?.aAavg || sharedRes.aAavg || '',
    aInfnan: item.rawAOp?.aInfnan || sharedRes.aInfnan || '',
    bMax: item.rawTaskOp?.taskMax || sharedRes.bMax || '',
    bMin: item.rawTaskOp?.taskMin || sharedRes.bMin || '',
    bAvg: item.rawTaskOp?.taskAvg || sharedRes.bAvg || '',
    bAavg: item.rawTaskOp?.taskAavg || sharedRes.bAavg || '',
    bInfnan: item.rawTaskOp?.taskInfnan || sharedRes.bInfnan || '',
    bTaskId: item.rawTaskOp?.taskTaskId || '',
    bSeqNo: item.rawTaskOp?.taskSeqNo || '',
  };

  // 打开精度报告抽屉
  selectedDetailData.value = {
    taskId: item.id,
    taskName: item.taskName,
    accuracy: item.compareRes === 'Pass' ? 1.0 : 0.5,
    errors: [],
    details: [],
    aData: item.aData,
    bData: item.bData,
    source,
    summaryInfo,
    sharedRes: item.sharedRes,
    loopInfo: item.loopInfo,
    rawAOp: item.rawAOp,
    rawTaskOp: item.rawTaskOp,
  };
  showDetail.value = true;
};

const onCloseDetail = () => {
  showDetail.value = false;
  selectedDetailData.value = null;
  jumpText.value = '';
};

const onJumpToGraph = async (data: { detailData: TaskDetailData; source: 'left' | 'right'; cmpCsvPath: string }) => {
  if (!data.cmpCsvPath) {
    console.warn('[TaskCheckIndex] cmpCsvPath is empty, cannot jump to graph');
    return;
  }

  const { detailData, source } = data;

  // 根据 source 决定取哪个数据的值
  const isLeft = source === 'left';
  const funcHash = detailData.rawAOp?.aFuncHash || '';
  const passName = detailData.rawAOp?.aPhaseName || '';
  const loopInfo = detailData.loopInfo || detailData.summaryInfo?.loopInfo || '';
  const rootFuncHash = detailData.rawAOp?.aRootFuncHash || '';
  const pathFunchash = detailData.rawAOp?.aPathHash || '';
  const fileType = isLeft ? 'task_A' : 'task_B';

  if (!funcHash || !passName) {
    console.warn('[TaskCheckIndex] Missing required parameters:', { funcHash, passName });
    return;
  }

  try {
    await server.openTaskCmpDiffComGraphApi({
      filePath: data.cmpCsvPath,
      funcHash,
      passName,
      loopInfo,
      fileType,
      cmpCsvPath: data.cmpCsvPath,
      computeGraphDirPath: computeGraphDirPath.value,
      flowVerifyPath: flowVerifyPath.value,
      rootFuncHash,
      pathFunchash,
    });
  } catch (error) {
    console.error('[TaskCheckIndex] jumpToGraph error:', error);
  }
};

const onJumpToSwimGraph = async (data: { seqNo?: number; taskId?: string }) => {
  if (!swimGraphPath.value) {
    console.warn('[TaskCheckIndex] swimGraphPath is empty, cannot jump to swim graph');
    return;
  }

  const seqNo = data.seqNo ?? undefined;
  const taskId = parseInt(data.taskId || '0', 10);

  try {
    await server.openSwimGraphApi({
      swimPath: swimGraphPath.value,
      seqNo,
      taskId,
    });
  } catch (error) {
    console.error('[TaskCheckIndex] jumpToSwimGraph error:', error);
  }
};
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.taskcheck-layout-container {
  display: flex;
  height: 100vh;
  width: 100%;
  min-width: 1250px;
  overflow-x: auto;
  overflow-y: hidden;
  background-color: var(--devui-base-bg);
}

.taskcheck-main-content {
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

.task-view-container {
  flex: 1;
  display: flex;
  overflow: hidden;

  .center-empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 400px;

    .center-empty-icon {
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

    .center-empty-text {
      font-size: 14px;
      color: var(--devui-secondary-text);
    }
  }

  .task-center-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 400px;

    .center-placeholder {
      font-size: 14px;
      color: var(--devui-secondary-text);
    }
  }

  &.with-detail {
    .task-center-content {
      flex: 1;
      min-width: 400px;
    }
  }
}
</style>