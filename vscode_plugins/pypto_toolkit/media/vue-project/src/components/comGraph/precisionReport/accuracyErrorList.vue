<template>
    <div class="search-filter">
        <d-search v-model="searchKey" icon-position="left" :placeholder="t('comGraph.enterKeywordSearchForLoopInfo')" :show-glow-style="false"
            class="search-wrap"></d-search>
    </div>
    <d-data-grid :data="tableData" :columns="columnData" size="xs" fix-header @row-click="onRowClick"
        class="detail-compare-data-list"></d-data-grid>
    <d-pagination class="runDataPage" size="sm" :pageSize="pageConfig.pageSize" :pageIndex="pageConfig.currentPage"
        :total="pageConfig.total" :can-jump-page="true" :cann-view-total="true" :max-items="5"
        @page-index-change="pageIndexChange" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const tableData = ref([])
const searchKey = ref('')

const columnData = ref([
    { width: 60, field: 'no', header: 'NO.' },
    { width: 100, field: 'loopInfo', header: 'LOOP_INFO', showOverflowTooltip: true },
    { width: 100, field: 'rawMagic', header: 'rawmagicID' },
    { width: 90, field: 'dataType', header: 'datatype' },
    { width: 100, field: 'validShape', header: 'validshape', align: 'right', minWidth:100},
]);

const props = defineProps({
    data: {
        type: Array<any>,
        default: []
    },
    pageConfig: {
        type: Object,
        default: {
            pageSize: 30,
            currentPage: 1,
            total: 0
        }
    },
    isOpCheck: {
        type: Boolean,
        default: false
    }
})
const emits = defineEmits(['inputSearch', 'rowClick', 'pageIndexChange'])

const pageIndexChange = (pageIndex) => {
    emits('pageIndexChange', pageIndex)
}

const onRowClick = (rowData) => {
    emits('rowClick', rowData.row)
}

watch(
    () => props.data,
    (val) => {
        tableData.value = JSON.parse(JSON.stringify(val))
    }
)
watch(
    () => searchKey.value,
    (val) => {
        emits('inputSearch', val)
    }
)
watch(
    () => props.isOpCheck,
    (isOpCheck) => {
        columnData.value[2].header = isOpCheck ? 'OpMagic' : 'rawmagicID';
    },
    { immediate: true }
)
</script>

<style lang="scss" scoped>
.search-filter {
    align-items: center;

    .search-wrap.devui-search {
        flex: 1;

        .devui-search__icon {
            width: 24px;
            height: 28px;
            margin-left: 4px;

            svg path {
                fill: var(--devui-placeholder-text);
            }
        }

        .devui-input {
            height: 28px;
            border: none;
            padding-left: 28px;
            background-color: var(--devui-input-bg);

            .devui-input__wrapper {
                background-color: transparent;

                input::placeholder {
                    color: var(--devui-placeholder-text);
                }
            }
        }
    }
}

.runDataPage {
    display: flex;
    justify-content: flex-end;
    bottom: 0;
    margin-bottom: 15px;
}

.detail-compare-data-list {
    margin-top: 4px;
    padding: 0;
    flex: 1;

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

    :deep(.devui-data-grid__td--xs) {
        cursor: pointer;
    }
}
</style>
