<template>
    <d-modal v-model="runDataVisible" class="runData-containner" :close-on-click-overlay="false">
        <template #header>
        <d-modal-header class="modal-button">
            <span> {{ $t('selectRelective') }} </span>
            <d-button class="open-File-Button" @click="openOtherFile">{{ $t('selectOtherFile') }}</d-button>
        </d-modal-header>
        </template>
        <template #default>
        <div>
            <d-search icon-position="left" style="width: 100%" v-model="searchQuery" :placeholder="$t('comGraph.search')" @search="onSearch"></d-search>
        </div>
        <div class="alert-rundata">
            <d-alert v-if="showWarning" type="warning" :closeable="true" :dismiss-time=6000>{{ $t('warningText') }} </d-alert>
        </div>
        <d-table :data="baseList" border-type="" style="width: 100%">
            <d-column filed="runData" width="226px">
            <template #header>
                <span class="table-header-left">{{ $t('selectResult') }}</span>
                <div class="left-sort">
                    <div class="sort-icon">
                    <d-icon class="sort" operable @click="sortOption = !sortOption">
                        <template #prefix>
                        <img :src="sortIcon" class="icon-sort" />
                        </template>
                    </d-icon>
                    </div>
                </div>
            </template>
            <template #default="scope">
                <d-radio v-model="baseChoose" :value="scope.row.runData" :disabled="scope.row.disabled" class="mb-2" @change="filterValChange">{{ scope.row.runData }}</d-radio>
            </template>
            </d-column>
            <d-column filed="execTime" :header="$t('sideBar.sortName')">
            <template #default="scope">
                <span class="exec-time"> {{ scope.row.execTime }} </span>
            </template>
            </d-column>            
        </d-table>
        <d-pagination class="runDataPage" size="sm" :total="pagetotal" :pageSize="pageSize" :pageIndex="pageIndex" :cann-view-total="true" :max-items="5" @page-index-change="pageIndexChange" />
        </template>
        <template #footer>
        <d-modal-footer class="runData-modal-button">
            <d-button variant="solid" color='secondary' @click="runDataCancel">{{ $t('no') }}</d-button>
            <d-button variant="solid" color='primary' @click="runDataConfirm" :disabled="!baseChoose">{{ $t('yes') }}</d-button>
        </d-modal-footer>
        </template>
    </d-modal>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, inject, watch } from 'vue';
import { useViewServer } from '../../core/use-view-server';
import { ICommonViewServer } from 'ext:/view/servers/view-server-interface';
import { getRunDataList } from '@/apis/workspace';
import type { HistoryData } from '../../components/navbar/navbar-types';
import { useI18n } from 'vue-i18n';
const { t: $t } = useI18n();
const { server } = useViewServer<ICommonViewServer>();
const baseList = ref([{}]);
const historyList = ref<HistoryData[]>([]);
const swimPath = ref('');
const comPath = ref('');
const pageIndex = ref(1);
const pageSize = 10;
const sortIcon = ref(`${window.staticPath}/static-assets/control_flow_panel_sort.svg`);
const sortOption = ref(false);
const showWarning = ref(false);
const searchQuery = ref('');
const { runDataVisible, missGraphType, pagetotal, baseChoose} = inject('runDataList');
const props = defineProps({
  filePath: {type: Object, default: {}}
});
const pageIndexChange = (val) => {
  pageIndex.value = val;
  getHistoryList(val, searchQuery.value);
};
const getHistoryList = (page, searchKey) => {
  baseList.value = [];
  historyList.value = [];
  getRunDataList({page: page, pageSize, sortOrder: sortOption.value ? 'asc': 'desc', isThreeColumnNotNull: true, titleKeyword: searchKey}, {timeout: 600000 }).then(({data, total}) => {
    historyList.value.push(...data);
    baseList.value.push(...data.map(item =>({
      runData: item.title,
      disabled: false,
      execTime: item.executeTime
    })));
    pagetotal.value = total;
  });
};
watch(sortOption, () => {
  getHistoryList(pageIndex.value, searchQuery.value);
});

const openOtherFile = () => {
  runDataVisible.value = false;
  const {swimPath, comPath} = props.filePath;
  server.selectFile({graphType: missGraphType.value, options: {swimPath, comPath}});
};
const onSearch = (val) => {
  searchQuery.value = val;
  getHistoryList(pageIndex.value, searchQuery.value);
};
const runDataCancel = () => {
  runDataVisible.value = false;
  baseChoose.value = '';
};
const runDataConfirm = async () => {
  runDataVisible.value = false;
  if (swimPath.value && comPath.value) {
    await server.selectRunData({runDataPaths: {swimPath: swimPath.value, comPath: comPath.value, runDataTitle: baseChoose.value}});
  }
};
const filterValChange = () => {
  showWarning.value = false;
  swimPath.value = '';
  comPath.value = '';
  const foundItem = historyList.value.find(item => item.title === baseChoose.value);
  if (foundItem) {
    if (!foundItem.swimlaneGraphFilePath || !foundItem.controlFlowFilePath) {
      showWarning.value = true;
      const baseItem = baseList.value.find(item => item.runData === baseChoose.value);
      baseItem.disabled = true;
      return ;
    }
    swimPath.value = foundItem.swimlaneGraphFilePath;
    comPath.value = foundItem.controlFlowFilePath;
  }
};
onMounted(() => {
    getHistoryList(1, '');
});
</script>
<style lang="scss">
.runData-containner.devui-modal {
  width: 480px;
  max-height: 620px;
  gap: 20px;
  background: var(--devui-tooltip-bg);
}
.devui-modal .btn-close {
  top: 22px !important;
}
.runDataPage.devui-pagination {
  margin-top: 26px;
  display: flex;
  justify-content: flex-end;
  > div {
    display: none !important;
  }
  > span {
    display: none !important;
  }
}
.open-File-Button.devui-button--outline--secondary {
  border-color: transparent !important;
  background-color: transparent !important;
  color: var(--devui-select-active-border-color);
  margin-right: 8px;
}
.devui-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--devui-title-text);
}
.sort-icon {
  display: flex;
  align-items: center;
  margin-left: 5px;
}
.devui-modal__body {
  .devui-search--glow-style:not(.devui-search--disabled):hover, .devui-search--glow-style:not(.devui-search--disabled).devui-search--focus {
    box-shadow: none;
  }
  .devui-search__clear, .devui-search__icon {
    height: 28px;
  }
  .devui-search .devui-input {
    height: 28px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: var(--devui-category-search-bg);
    .devui-input__wrapper,
      input {
        margin-top: 2px;
        background-color: transparent;
        &::placeholder {
          color: var(--devui-placeholder-text);
        }
      }
  }
  .devui-search {
    &:not(.devui-search--focus):hover {
      .devui-input {
        border-color: var(--devui-primary-button-hover-bg) !important;
      }
    }

    &.devui-search--focus {
      .devui-input {
        border-color: var(--devui-primary-button-active-bg);
      }
    }
  }
}
.devui-table {
  top: 16px;
  border-radius: 8px;
  .devui-table__thead {
    height: 32px;
  }
  .devui-table__thead tr {
    color: var(--devui-primary-text);
    font-size: 12px;
    background-color: var(--devui-input-bg);
  }
  .devui-table__tbody tr {
    background-color: var(--devui-table-body-bg);
  }
  .devui-table__tbody tr:not(:last-child) td {
    border: none;
    border-bottom: 1px solid var(--devui-split-line);
  }
  .devui-table--sm tbody>tr>td {
    font-size: var(--devui-font-size, 12px);
    padding: 5px 20px 5px;
  }
  .devui-radio.active .devui-radio__material {
    border-color: var(--devui-primary-button-bg);
    background: var(--devui-category-search-font-color);
  }
  .devui-table__thead>tr>th:nth-child(1) .header-container {
    margin-left: 24px;
  }
  .devui-table__thead .header-container .title {
    color: var(--devui-primary-text);
    font-size: 12px;
  }
}
.devui-pagination .devui-pagination__list li.devui-pagination__item:not(.disabled).active a.devui-pagination__link {
  background-color: var(--devui-page-active-bg) !important;
}
.devui-modal__footer.runData-modal-button {
  padding: 0 32px 20px;
}
.alert-rundata {
  width: 440px;
  position: absolute;
  top: 60px;
  z-index: 10;
}
</style>