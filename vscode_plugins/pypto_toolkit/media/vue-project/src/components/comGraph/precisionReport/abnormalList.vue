<template>
  <div class="precision-report-wrap">
    <div class="statistic-card-wrap">
      <StatisticCard :count="cardData.PASS" type="PASS" :clickable="false" />
      <StatisticCard :count="cardData.FAIL" type="FAIL" :clickable="false" />
      <StatisticCard :count="cardData.EXCEPTION" type="EXCEPTION" :clickable="false" />
    </div>
    <div>{{ t('comGraph.precisionExceptionList') }}</div>
    <AccuracyErrorList :data="errorListData" :page-config="pageConfig" :is-op-check="currentFileType.startsWith('op')" @row-click="rowClick" @input-search="searchByKeyword" @page-index-change="pageIndexChange" />
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

const initData = (data) => {
  if (!data) return
  cardData.value.FAIL = data?.comgraphFailSum?.FAIL || 0
  cardData.value.PASS = data?.comgraphFailSum?.PASS || 0
  cardData.value.EXCEPTION = data?.comgraphFailSum?.EXCEPTION || 0
}

// 点击列表数据行
const rowClick = (rowData) => {
  console.log(rowData);
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
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: keyword
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
    console.log('currentFilePath.value', currentFilePath.value);
    server.getCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value,
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
watch(server.AccurancyReport, (newValue) => {
  console.log('newValue', newValue);
  initData(newValue?.data);
});

// 获取下方列表数据
watch(server.AccurancyList, (val: Record<string, any>) => {
  errorListData.value = val.data?.comgraphFailList?.list || [];
  pageConfig.value.total = val.data?.comgraphFailList?.total || 0;
});

// 获取 cmpErrorList 数据
watch(server.cmpErrorList, (val: Record<string, any>) => {
  console.log('valllllllll', val);
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
    pageConfig.value.total = currentFileType.value.startsWith('op') ? (listSum || failRes) : failRes;
  }

  // 处理列表数据
  const startNo = (pageConfig.value.currentPage - 1) * pageConfig.value.pageSize + 1;
  errorListData.value = diffList.map((item: Record<string, any>, index: number) => ({
    ...item.sharedRes,
    ...(currentFileType.value === 'op_A' ? item?.aOp : item?.bOp),
    no: startNo + index,
  }));
});

onMounted(async () => {
  // 从 query 获取 fileType 参数
  const query = await getQuery();
  console.log('query', query);
  const fileType = query.fileType as string || '';
  const outputDirPath = query.outputDirPath as string || '';

  // 保存当前的 fileType 和路径信息
  currentFileType.value = fileType;
  currentFilePath.value = query.outputPath as string || '';
  currentOutputPath.value = outputDirPath;

  if (fileType.startsWith('op')) {
    // 如果是 opcheck 类型，调用 getCmpErrorListData
    server.getCmpErrorListData({
      cmpCsvPath: currentFilePath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value,
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
