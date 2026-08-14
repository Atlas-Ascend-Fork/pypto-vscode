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
  <div class="access-table-view" :class="isDarkTheme ? 'theme-dark' : 'theme-light'">
    <div class="access-table-toolbar">
      <label class="access-search">
        <d-icon name="icon-search" size="15px" />
        <input v-model="search" type="search" :placeholder="$t('tableSearch')" aria-label="Search accesses" />
      </label>
    </div>
    <div class="access-table-scroll">
      <table class="access-table">
        <thead>
          <tr>
            <th>R/W</th>
            <th>FUNC</th>
            <th>OP</th>
            <th>OFFSET</th>
            <th>SHAPE</th>
            <th>RAWSHAPE</th>
            <th>HASOVERLAP</th>
            <th>EXECSTART</th>
            <th>EXECEND</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in pagedRows"
            :key="row.key"
            :class="{ selected: row.key === selectedKey }"
            tabindex="0"
            @click="$emit('select', row.key)"
            @keydown.enter="$emit('select', row.key)"
          >
            <td class="access-type">{{ row.access.isWrite ? 'W' : 'R' }}</td>
            <td>{{ formatCell(row.access.funcId) }}</td>
            <td>{{ formatCell(row.access.opIdx) }}</td>
            <td :title="formatArray(row.access.offset)">{{ formatArray(row.access.offset) }}</td>
            <td :title="formatArray(row.access.shape)">{{ formatArray(row.access.shape) }}</td>
            <td :title="formatArray(row.access.rawShape)">{{ formatArray(row.access.rawShape) }}</td>
            <td>{{ formatBoolean(row.access.hasOverlap) }}</td>
            <td :title="formatCell(row.access.execStart)">{{ formatCell(row.access.execStart) }}</td>
            <td :title="formatCell(row.access.execEnd)">{{ formatCell(row.access.execEnd) }}</td>
          </tr>
          <tr v-if="!pagedRows.length" class="empty-row">
            <td colspan="9">No matching accesses</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="access-pagination">
      <span>{{ rows.length }} accesses</span>
      <label>
        <span class="sr-only">Rows per page</span>
        <select v-model.number="pageSize" aria-label="Rows per page">
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>
      <button type="button" aria-label="Previous page" :disabled="page === 1" @click="page--">‹</button>
      <span class="page-number">{{ page }}</span>
      <span>/ {{ pageCount }}</span>
      <button type="button" aria-label="Next page" :disabled="page === pageCount" @click="page++">›</button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue';

const props = defineProps({
  accesses: { type: Array, default: () => [] },
  selectedKey: { type: String, default: '' },
  tensorId: { type: String, required: true },
  writesOnly: { type: Boolean, default: true },
});

defineEmits(['select']);

const { isDarkTheme } = inject('root', { isDarkTheme: ref(true) });
const search = ref('');
const page = ref(1);
const pageSize = ref(20);

function formatCell(value) {
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

function formatArray(value) {
  return Array.isArray(value) ? `[${value.join(',')}]` : formatCell(value);
}

function formatBoolean(value) {
  return typeof value === 'boolean' ? String(value) : '-';
}

const rows = computed(() => {
  const query = search.value.trim().toLowerCase();
  return props.accesses
    .map((access, index) => ({ access, key: `${props.tensorId}|${index}` }))
    .filter(({ access }) => !props.writesOnly || access?.isWrite)
    .filter(({ access }) => !query || [
      access?.isWrite ? 'w' : 'r', access?.seqNo, access?.funcId, access?.opIdx, formatArray(access?.offset), formatArray(access?.shape),
      formatArray(access?.rawShape), formatBoolean(access?.hasOverlap), access?.execStart, access?.execEnd,
    ].some((value) => String(value).toLowerCase().includes(query)));
});
const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize.value)));
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return rows.value.slice(start, start + pageSize.value);
});

watch([search, pageSize, () => props.tensorId, () => props.writesOnly], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  page.value = Math.min(page.value, count);
});
</script>

<style scoped src="./memoryAccessTable.scss" lang="scss"></style>
