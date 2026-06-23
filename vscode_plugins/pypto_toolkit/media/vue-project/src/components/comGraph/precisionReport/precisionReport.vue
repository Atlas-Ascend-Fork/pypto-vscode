<template>
  <div class="precision-report-wrap">
    <KeepAlive>
      <AbnormalList v-if="!showDetail" @row-click="jumpDetail" @op-magic-click="onOpMagicClick"/>
    </KeepAlive>
    <AbnormalDetail v-if="showDetail" :row-data="rowData" @back="() => (showDetail = false)" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AbnormalList from './abnormalList.vue';
import AbnormalDetail from './abnormalDetail.vue';

const showDetail = ref(false);
const rowData = ref<Record<string, any>>({});


const emits = defineEmits(['opMagicClick'])
const onOpMagicClick = (opmagic: string) => {
  emits('opMagicClick', opmagic);
};

const jumpDetail = (data) => {
  rowData.value = data
  showDetail.value = true
}
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