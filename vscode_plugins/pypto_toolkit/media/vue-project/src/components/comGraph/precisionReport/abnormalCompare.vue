<template>
  <d-data-grid :data="tableData" :columns="columnData" size="xs" fix-header class="detail-compare-data-list"></d-data-grid>
</template>

<script setup lang="ts">
import { h, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AbnormalNodeCompareListItem } from './precisionReport.types';

const { t } = useI18n();
const tableData = ref<AbnormalNodeCompareListItem[]>(
  Array.from({ length: 20 }).map((_, index) => ({
    index: index + 1,
    offset: 96,
    offsetRaw: '[5,3,1]',
    aValue: 1.2432,
    bValue: 1.2452,
    abRe: 0.51,
    abAe: 0.0099,
    abTol: 0.22,
  })),
);
const columnData = ref([
  { width: 80, field: 'index', header: 'INDEX' },
  { width: 80, field: 'offset', header: 'OFFSET' },
  { width: 108, field: 'offsetRaw', header: 'OFFSET_RAW' },
  { width: 88, field: 'aValue', header: 'A>VALUE' },
  { width: 88, field: 'bValue', header: 'B>VALUE' },
  { width: 98, field: 'abRe', headRender: () => h('span', { title: `AB${t('relativeError')}` }, `AB${t('relativeError')}`) },
  { width: 98, field: 'abAe', headRender: () => h('span', { title: `AB${t('absoluteError')}` }, `AB${t('absoluteError')}`) },
  { width: 118, field: 'abTol', headRender: () => h('span', { title: t('errorJudgmentTolerance') }, t('errorJudgmentTolerance')) },
]);
</script>

<style lang="scss">
.detail-compare-data-list {
  flex: 1;
  height: 0;
  width: 100%;
  .devui-data-grid__head {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    background-color: var(--devui-nest-bg);
  }
  .devui-data-grid__tr {
    background-color: transparent;
    &.hover-tr {
      background-color: var(--devui-input-hover-bg) !important;
    }
  }
  .devui-data-grid__body-wrapper.devui-scroll-overlay {
    overflow: auto;
  }
}
</style>
