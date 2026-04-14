<template>
  <div class="precision-report-wrap">
    <AbnormalList v-show="!showDetail" />
    <AbnormalDetail v-show="showDetail" :magic-id="magicId" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AbnormalList from './abnormalList.vue';
import AbnormalDetail from './abnormalDetail.vue';

const showDetail = ref(true);
const magicId = ref('1234');
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
