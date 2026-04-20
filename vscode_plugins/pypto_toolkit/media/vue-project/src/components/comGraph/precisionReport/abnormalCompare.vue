<template>
  <d-data-grid
    ref="gridEl"
    :data="renderTableData"
    :columns="columnData"
    size="xs"
    virtual-scroll
    :column-virtual-scroll="false"
    fix-header
    class="detail-compare-data-list"
  ></d-data-grid>
</template>

<script setup lang="ts">
import { h, PropType, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import TableHead from './tableHead.vue';
import type { SortDirection } from '../type';
import type { AbnormalNodeCompareListItem } from './precisionReport.types';

const props = defineProps({
  tableData: { type: Array as PropType<AbnormalNodeCompareListItem[]>, default: () => [] },
});
const emits = defineEmits(['sort']);

const { t } = useI18n();
const gridEl = ref();
const headSortMap = reactive<Record<string, SortDirection>>({
  offset: 'default',
  abRe: 'default',
  abAe: 'default',
});
const DirectionMap: Record<SortDirection, SortDirection> = {
  asc: 'desc',
  desc: 'default',
  default: 'asc',
};
const renderTableData = ref<AbnormalNodeCompareListItem[]>([]);
const columnData = ref([
  {
    width: 94,
    field: 'offset',
    sortable: true,
    sortMethod: (a, b) => a.offset > b.offset,
    headRender: () => h(TableHead, { head: 'OFFSET', direction: headSortMap.offset, onSort: () => onTableSort('offset') }),
  },
  { width: 108, field: 'offsetRaw', header: 'OFFSET_RAW' },
  { width: 88, field: 'aValue', header: 'A>VALUE', showOverflowTooltip: true },
  { width: 88, field: 'bValue', header: 'B>VALUE', showOverflowTooltip: true },
  {
    width: 118,
    field: 'abRe',
    showOverflowTooltip: true,
    sortable: true,
    sortMethod: (a, b) => a.abRe > b.abRe,
    headRender: () =>
      h(TableHead, {
        title: `AB${t('relativeError')}`,
        head: `AB${t('relativeError')}`,
        direction: headSortMap.abRe,
        onSort: () => onTableSort('abRe'),
      }),
  },
  {
    width: 118,
    field: 'abAe',
    sortable: true,
    showOverflowTooltip: true,
    sortMethod: (a, b) => a.abAe > b.abAe,
    headRender: () =>
      h(TableHead, {
        title: `AB${t('absoluteError')}`,
        head: `AB${t('absoluteError')}`,
        direction: headSortMap.abAe,
        onSort: () => onTableSort('abAe'),
      }),
  },
  {
    width: 118,
    field: 'abTol',
    showOverflowTooltip: true,
    headRender: () => h('span', { title: t('errorJudgmentTolerance') }, t('errorJudgmentTolerance')),
  },
]);

function onTableSort(field: string) {
  headSortMap[field] = DirectionMap[headSortMap[field]];
  gridEl.value.sort(field, headSortMap[field] === 'default' ? '' : headSortMap[field]);
  Object.keys(headSortMap).forEach((item) => {
    if (item !== field) {
      headSortMap[item] = 'default';
    }
  });
  emits('sort');
}

const clearAllSort = () => {
  Object.keys(headSortMap).forEach((item) => {
    if (headSortMap[item] !== 'default') {
      gridEl.value.sort(item, '');
      headSortMap[item] = 'default';
    }
  });
};

watch(
  () => props.tableData,
  (val) => {
    renderTableData.value = JSON.parse(JSON.stringify(val));
  },
  { immediate: true },
);

defineExpose({ clearAllSort });
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
    .th-sort-icon {
      display: none;
    }
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
