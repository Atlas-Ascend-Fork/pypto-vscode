<template>
  <div>
    <div class="statistic-card-wrap">
      <StatisticCard :count="cardData.PASS" type="PASS" />
      <StatisticCard :count="cardData.FAIL" type="FAIL" />
    </div>
    <div>精度异常列表</div>
    <AccuracyErrorList :data="errorListData" @inputSearch="search" @row-click="rowClick" />
  </div>
</template>

<script setup lang="ts">
import { watch, ref, onMounted } from 'vue';
import StatisticCard from './statisticCard.vue';
import { useViewServer } from '@/core/use-view-server';
import { IComViewServer } from 'ext:/view/servers/view-server-interface';
import AccuracyErrorList from './accuracyErrorList.vue';

const emits = defineEmits(['rowClick'])
const errorListData = ref([])
const { server } = useViewServer<IComViewServer>();
const cardData = ref({
  FAIL: 0,
  EXCEPTION: 0
})

const initData = (data) => {
  if (!data) return
  cardData.value.FAIL = data?.comgraphFailSum?.FAIL || 0
  cardData.value.PASS = data?.comgraphFailSum?.PASS || 0
  errorListData.value = data?.comgraphFailList || []
}
// 列表根据loopInfo进行关键词搜索
const search = () => {
  server.getAccurancyReport();
}

// 点击列表数据行
const rowClick = (rowData) => {
  emits('rowClick', rowData)
}

// 获取数据并初始化
watch(server.AccurancyReport, (newValue) => {
  initData(newValue?.data);
});

onMounted(() => {
  server.getAccurancyReport();
})
</script>

<style lang="scss" scoped>
.precision-report-wrap {
  flex: 1;
  padding: 0 16px 16px;
  box-sizing: border-box;
  overflow: auto;

  .statistic-card-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
