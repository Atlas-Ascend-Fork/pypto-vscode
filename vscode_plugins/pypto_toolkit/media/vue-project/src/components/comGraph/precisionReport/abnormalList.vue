<template>
  <div>
    <div class="statistic-card-wrap">
      <StatisticCard :count="2367" />
      <StatisticCard :count="1203" type="Warning" />
    </div>
    <div>精度异常列表</div>
  </div>
</template>

<script setup lang="ts">
import StatisticCard from './statisticCard.vue';
</script>

<style lang="scss">
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
