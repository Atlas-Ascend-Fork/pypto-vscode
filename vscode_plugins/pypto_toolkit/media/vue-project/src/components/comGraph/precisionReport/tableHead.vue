<template>
  <div class="abnormal-compare-table-head">
    <span class="table-head-title" :title="title">{{ head }}</span>
    <TableSortIcon :direction="direction" @click="() => emits('sort')" />
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import TableSortIcon from '../icons/table-sort-icon.vue';
import type { SortDirection } from '../type';

defineProps({
  head: String,
  title: String,
  direction: String as PropType<SortDirection>,
});
const emits = defineEmits(['sort']);
</script>

<style scoped lang="scss">
.abnormal-compare-table-head {
  display: flex;
  align-items: center;
  gap: 4px;

  .table-head-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :deep() {
    svg {
      min-width: 16px;
    }
  }
}
</style>
