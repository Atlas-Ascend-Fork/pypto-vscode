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
  <div class="access-table-view" :class="isDarkTheme ? 'theme-dark' : 'theme-light'">
    <div class="access-table-toolbar">
      <label class="access-search">
        <d-icon name="icon-search" size="15px" />
        <input v-model="search" type="search" :placeholder="$t('searchFuncOrOp')" aria-label="Search accesses" />
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
            <th :aria-sort="sortDirection === 'asc' ? 'ascending' : 'descending'">
              <button
                type="button"
                class="access-sort-button"
                :aria-label="sortDirection === 'asc' ? 'Sort EXECSTART descending' : 'Sort EXECSTART ascending'"
                @click="toggleExecStartSort"
              >
                <span>EXECSTART</span>
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path v-if="sortDirection === 'asc'" d="m2.5 7.5 3.5-3 3.5 3" />
                  <path v-else d="m2.5 4.5 3.5 3 3.5-3" />
                </svg>
              </button>
            </th>
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
            <td colspan="9">{{ $t('noMatchingAccesses') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="access-pagination">
      <span>{{ $t('accessesCount', { count: rows.length }) }}</span>
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
const sortDirection = ref('asc');

function formatCell(value) {
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

function formatArray(value) {
  return Array.isArray(value) ? `[${value.join(',')}]` : formatCell(value);
}

function formatBoolean(value) {
  return typeof value === 'boolean' ? String(value) : '-';
}

function getExecStartValue(access) {
  if (access?.execStart === undefined || access?.execStart === null || access?.execStart === '') {
    return null;
  }
  const value = Number(access.execStart);
  return Number.isFinite(value) ? value : null;
}

function compareByExecStart(left, right) {
  const leftValue = getExecStartValue(left.access);
  const rightValue = getExecStartValue(right.access);
  if (leftValue === null || rightValue === null) {
    if (leftValue === rightValue) {
      return left.index - right.index;
    }
    return leftValue === null ? 1 : -1;
  }
  const direction = sortDirection.value === 'asc' ? 1 : -1;
  return (leftValue - rightValue) * direction || left.index - right.index;
}

function toggleExecStartSort() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
}

const rows = computed(() => {
  const query = search.value.trim().toLowerCase();
  return props.accesses
    .map((access, index) => ({ access, index, key: `${props.tensorId}|${index}` }))
    .filter(({ access }) => !props.writesOnly || access?.isWrite)
    .filter(({ access }) => !query || [ access?.funcId, access?.opIdx,
    ].some((value) => String(value).toLowerCase().includes(query)))
    .sort(compareByExecStart);
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
