<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
