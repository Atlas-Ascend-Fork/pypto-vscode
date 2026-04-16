<template>
    <div class="search-filter">
        <!-- <d-search v-model="searchKey" icon-position="left" :placeholder="t('enterKeyword')" :show-glow-style="false"
            class="search-wrap"></d-search> -->
    </div>
    <d-data-grid :data="tableData" :columns="columnData" size="xs" fix-header @row-click="onRowClick"
        class="detail-compare-data-list"></d-data-grid>
    <!-- <d-pagination class="runDataPage" size="sm" :total="pagetotal" :pageSize="pageSize" :pageIndex="pageIndex"
        :can-jump-page="true" :cann-view-total="true" :max-items="5" @page-index-change="pageIndexChange" /> -->
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const tableData = ref([])
const searchKey = ref('')
const pageIndex = ref(1);
const pageSize = 10;
const pagetotal = 30

const columnData = ref([
    { width: 60, field: 'no', header: 'NO.' },
    { width: 100, field: 'loopInfo', header: 'LOOP_INFO',resizable: true,   showOverflowTooltip: true },
    { width: 100, field: 'rawMagic', header: 'rawmagicID' },
    { width: 100, field: 'dataType', header: 'datatype' },
    { width: 100, field: 'validShape', header: 'validshape', align: 'right', minWidth:100},
]);

const props = defineProps({
    data: {
    type: Array<any>,
    default: []
  }
})
const emits = defineEmits(['inputSearch', 'rowClick'])

const pageIndexChange = () => {

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
</script>

<style lang="scss" scoped>
.search-filter {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;

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

    .filter-button.devui-button {
        height: 28px;
        font-size: 13px;
        padding: 0 8px;
        border: none;
        color: var(--devui-secondary-text);
        background-color: var(--devui-input-hover-bg);

        .devui-icon__container {
            color: var(--devui-secondary-text);
        }

        .clear-right-5 {
            margin-right: 4px;
        }

        &:hover {
            color: var(--devui-title-text);

            i {
                color: var(--devui-title-text);
            }
        }
    }

}

.runDataPage {
    position: fixed;
    bottom: 0;
    margin-bottom: 26px;
}

.detail-compare-data-list {
    margin-top: 4px;
    padding: 0;
    flex: 1;
    width: 100%;
    height: 1050px;

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
