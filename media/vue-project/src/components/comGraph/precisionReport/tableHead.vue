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
