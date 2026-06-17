<template>
  <div class="precision-report-wrap">
    <div class="statistic-card-wrap">
      <StatisticCard :count="cardData.PASS" type="PASS" :clickable="false" />
      <StatisticCard :count="cardData.FAIL" type="FAIL" :clickable="false" />
    </div>
    <div>{{ t('comGraph.precisionExceptionList') }}</div>
    <AccuracyErrorList :data="errorListData" :page-config="pageConfig" :is-op-check="currentFileType === 'opcheck'" @row-click="rowClick" @input-search="searchByKeyword" @page-index-change="pageIndexChange" />
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

const { t } = useI18n();

const emits = defineEmits(['rowClick'])
const errorListData = ref([])
const { server } = useViewServer<IComViewServer>();
const searchKeyword = ref('')
const cardData = ref({
  FAIL: 0,
  EXCEPTION: 0
})
const pageConfig = ref({
  pageSize: 30,
  currentPage: 1,
  total: 0,
})
const currentFileType = ref<string>('');
const currentFilePath = ref<string>('');

const initData = (data) => {
  if (!data) return
  cardData.value.FAIL = data?.comgraphFailSum?.FAIL || 0
  cardData.value.PASS = data?.comgraphFailSum?.PASS || 0
}

// 点击列表数据行
const rowClick = (rowData) => {
  emits('rowClick', rowData)
}

// 关键词搜索防抖
const searchByKeyword = debounce((keyword) => {
  searchKeyword.value = keyword
  pageConfig.value.currentPage = 1

  if (currentFileType.value === 'opcheck' && currentFilePath.value) {
    server.getCmpDiffListData({
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

  if (currentFileType.value === 'opcheck' && currentFilePath.value) {
    server.getCmpDiffListData({
      cmpCsvPath: currentFilePath.value,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value
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
  initData(newValue?.data);
});

// 获取下方列表数据
watch(server.AccurancyList, (val: Record<string, any>) => {
  errorListData.value = val.data?.comgraphFailList?.list || [];
  pageConfig.value.total = val.data?.comgraphFailList?.total || 0;
});

// 获取文件路径信息
watch(server.AccuFilePath, (val: Record<string, any>) => {
  const fileType = val?.fileType;
  const filePath = val?.filePath;

  // 保存当前的 fileType 和 filePath
  currentFileType.value = fileType || '';
  currentFilePath.value = filePath || '';

  if (fileType.startsWith('op')  && filePath) {
    // 如果是 opcheck 类型，调用 getCmpDiffListData
    server.getCmpDiffListData({
      cmpCsvPath: filePath,
      pageSize: pageConfig.value.pageSize,
      startOffset: pageConfig.value.currentPage - 1,
      keyword: searchKeyword.value
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
});

// 获取 CmpDiffList 数据
watch(server.CmpDiffList, (val: Record<string, any>) => {
  const diffList = val?.diffList || [];
  const total = val?.total || 0;
  const failRes = val?.failRes || 0;

  // 更新卡片数据
  cardData.value.FAIL = failRes;
  cardData.value.PASS = total - failRes;

  // 处理列表数据
  const startNo = (pageConfig.value.currentPage - 1) * pageConfig.value.pageSize + 1;
  errorListData.value = diffList.map((item: Record<string, any>, index: number) => ({
    ...item,
    no: startNo + index,
  }));
  pageConfig.value.total = total;
});

onMounted(async () => {
  // 先获取文件路径信息
  const aa = await server.accuFilePathGet();
  console.log(aa)
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
  }
}
</style>
