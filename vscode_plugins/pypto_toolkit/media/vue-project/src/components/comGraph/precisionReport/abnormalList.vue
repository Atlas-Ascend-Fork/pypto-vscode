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
  <div class="precision-report-wrap">
    <div class="statistic-card-wrap">
      <StatisticCard :count="cardData.PASS" type="PASS" :clickable="false" />
      <StatisticCard :count="cardData.FAIL" type="FAIL" :clickable="false" />
      <StatisticCard :count="cardData.EXCEPTION" type="EXCEPTION" :clickable="false" />
    </div>
    <div>{{ t('comGraph.precisionExceptionList') }}</div>
    <AccuracyErrorList :data="errorListData" :page-config="pageConfig" :is-op-check="currentFileType" @row-click="rowClick" @input-search="searchByKeyword" @page-index-change="pageIndexChange" />
  </div>
</template>

<script setup lang="ts">
import { watch, ref, onMounted } from 'vue';
import StatisticCard from './statisticCard.vue';
import { useViewServer } from '@/core/use-view-server';
import { IComViewServer } from 'ext:/view/servers/view-server-interface';
import AccuracyErrorList from './accuracyErrorList.vue';
import { debounce } from 'lodash';
import { useI18n } from 'vue-i18n';
import { getQuery } from '@/core/query';

const { t } = useI18n();

const emits = defineEmits(['rowClick', 'opMagicClick'])
const errorListData = ref([])
const { server } = useViewServer<IComViewServer>();
const searchKeyword = ref('')
const cardData = ref({
  FAIL: 0,
  EXCEPTION: 0,
  PASS: 0,
})
const pageConfig = ref({
  pageSize: 30,
  currentPage: 1,
  total: 0,
})
const currentFileType = ref<string>('');
const currentFilePath = ref<string>('');
const currentOutputPath = ref<string>('');
const currentComgraphPath = ref<string>('');
const rootFuncHash = ref<string>('');
const oriLoopInfo = ref<string>('');

const initData = (data) => {
  if (!data) return
  cardData.value.FAIL = data?.comgraphFailSum?.FAIL || 0
  cardData.value.PASS = data?.comgraphFailSum?.PASS || 0
  cardData.value.EXCEPTION = data?.comgraphFailSum?.EXCEPTION || 0
}

// 点击列表数据行
const rowClick = (rowData) => {
  emits('rowClick', {
    ...rowData,
    currentFileType: currentFileType.value,
    currentFilePath: currentFilePath.value,
  })

  const opmagic = rowData.opmagic ?? rowData.aOpMagic ?? rowData.bOpMagic ?? '';
  emits('opMagicClick', opmagic);
}

// 关键词搜索防抖
const searchByKeyword = debounce((keyword) => {
  searchKeyword.value = keyword
  pageConfig.value.currentPage = 1

  if (currentFileType.value.startsWith('op') && currentFilePath.value) {
    server.getCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      comgraphPath: currentComgraphPath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: keyword,
      rootFuncHash: rootFuncHash.value as string || '',
      oriLoopInfo: oriLoopInfo.value as string || '',
    });
  } else if (currentFileType.value.startsWith('task') && currentFilePath.value) {
    server.getTaskCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: keyword,
      comgraphPath: '',
      rootFuncHash: rootFuncHash.value as string || '',
      oriLoopInfo: oriLoopInfo.value as string || '',
    });
  } else {
    server.searchAccurancySumList({
      data: {
        keyword,
        pageSize: pageConfig.value.pageSize,
        startOffset: pageConfig.value.currentPage - 1,
      }
    });
  }
},300)

const pageIndexChange = (pageIndex) => {
  pageConfig.value.currentPage = pageIndex

  if (currentFileType.value.startsWith('op')) {
    server.getCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      comgraphPath: currentComgraphPath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value,
      rootFuncHash: rootFuncHash.value as string || '',
      oriLoopInfo: oriLoopInfo.value as string || '',
    });
  } else if (currentFileType.value.startsWith('task')) {
    server.getTaskCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value,
      comgraphPath: '',
      rootFuncHash: rootFuncHash.value as string || '',
      oriLoopInfo: oriLoopInfo.value as string || '',
    });
  } else {
    server.searchAccurancySumList({
      data: {
        keyword: searchKeyword.value,
        pageSize: pageConfig.value.pageSize,
        startOffset: pageConfig.value.currentPage - 1,
      }
    });
  }
}

// 获取并初始化上方卡片数据
watch(server.AccurancyReport, (newValue: Record<string, any>) => {
  initData(newValue?.data);
});

// 获取下方列表数据
watch(server.AccurancyList, (val: Record<string, any>) => {
  errorListData.value = val.data?.comgraphFailList?.list || [];
  pageConfig.value.total = val.data?.comgraphFailList?.total || 0;
});

// 获取 cmpErrorList 数据 (op 类型)
watch(server.cmpErrorList, (val: Record<string, any>) => {
  const diffList = val?.diffList || [];
  const failRes = val?.failRes;
  const totalCount = val?.totalRes;
  const excepRes = val?.excepRes;
  const listSum = val?.listSum;

  // 更新卡片数据 (readFlag为false时failRes和totalCount不返回，不更新)
  if (failRes !== undefined && failRes >= 0 && totalCount !== undefined && totalCount >= 0) {
    cardData.value.FAIL = failRes;
    cardData.value.PASS = totalCount - failRes - excepRes;
    // 当 fileType 为 op 类型时，使用 listSum 作为 total
    pageConfig.value.total = currentFileType.value.startsWith('op') ? (listSum || 0) : failRes;
  }

  // 处理列表数据
  const startNo = (pageConfig.value.currentPage - 1) * pageConfig.value.pageSize + 1;
  errorListData.value = diffList.map((item: Record<string, any>, index: number) => ({
    ...item.sharedRes,
    ...(currentFileType.value === 'op_A' ? item?.aOp : item?.bOp),
    no: startNo + index,
  }));
});

// 获取 taskCmpErrorList 数据 (task 类型)
watch(server.taskCmpErrorList, (val: Record<string, any>) => {
  const diffList = val?.diffList || [];
  const failRes = val?.failRes;
  const totalCount = val?.totalRes;
  const excepRes = val?.excepRes;

  // 更新卡片数据
  if (failRes !== undefined && failRes >= 0) {
    cardData.value.FAIL = failRes;
    cardData.value.EXCEPTION = excepRes || 0;
    cardData.value.PASS = (totalCount || 0) - failRes - (excepRes || 0);
    pageConfig.value.total = val?.total || 0;
  }

  // 处理列表数据 - task 类型字段映射
  const startNo = (pageConfig.value.currentPage - 1) * pageConfig.value.pageSize + 1;
  errorListData.value = diffList.map((item: Record<string, any>, index: number) => ({
    ...item.sharedRes,
    ...item.aOp,
    ...item.taskOp,
    no: startNo + index,
    // NO. → sharedRes.no
    taskNo: item?.sharedRes?.no || '',
    // LOOP_INFO → taskOp.taskLoopVarInfos
    taskLoopVarInfos: item?.taskOp?.taskLoopVarInfos || '',
    // rawmagicID → sharedRes.rootCallRawmagic
    rootCallRawmagic: item?.sharedRes?.rootCallRawmagic || '',
    // datatype → taskOp.taskDataType
    taskDataType: item?.taskOp?.taskDataType || '',
    // validshape → taskOp.taskValidshape
    taskValidshape: item?.taskOp?.taskValidShape || '',
    // fileName → sharedRes.fileName (用于详情页获取精度数据)
    fileName: item?.sharedRes?.fileName || '',
  }));
});

onMounted(async () => {
  // 从 query 获取 fileType 参数
  const query = await getQuery();
  const fileType = query.fileType as string || '';
  const outputDirPath = query.outputDirPath as string || '';

  // 保存当前的 fileType 和路径信息
  currentFileType.value = fileType;
  currentFilePath.value = query.outputPath as string || '';
  currentOutputPath.value = outputDirPath;
  currentComgraphPath.value = query._path;
  rootFuncHash.value = query.rootFuncHash as string || '';
  oriLoopInfo.value = query.loopInfo as string || '';

  if (fileType.startsWith('op')) {
    // 如果是 opcheck 类型，调用 getCmpErrorListData
    server.getCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      comgraphPath: currentComgraphPath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value,
      rootFuncHash: rootFuncHash.value as string || '',
      oriLoopInfo: oriLoopInfo.value as string || '',
    });
  } else if (fileType.startsWith('task')) {
    // 如果是 taskcheck 类型，调用 getTaskCmpErrorListData
    server.getTaskCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value,
      comgraphPath: '',
      rootFuncHash: rootFuncHash.value as string || '',
      oriLoopInfo: oriLoopInfo.value as string || '',
    });
  } else {
    // 否则调用原来的方法
    server.getAccurancyReport();
    server.searchAccurancySumList({
      data: {
        keyword: searchKeyword.value,
        pageSize: pageConfig.value.pageSize,
        startOffset: pageConfig.value.currentPage - 1,
      }
    });
  }
})
</script>

<style lang="scss" scoped>
.precision-report-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  padding: 0;

  .statistic-card-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
}
</style>
