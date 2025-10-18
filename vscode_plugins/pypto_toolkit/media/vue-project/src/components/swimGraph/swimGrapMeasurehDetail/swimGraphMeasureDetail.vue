<template>
  <div>
    <div class="measure-details" :class="{ expanded: mulDetailsExpanded }">
      <div class="measure-details-content">
        <div class="measure-detail-left-section">
          <div class="measure-detail-data-area">
            <div class="measure-detail-data-uparea">
              <div class="measure-detail-data-item">
                <div class="data-title-row">
                  <div class='data-title'>{{ $t('AICore') }}</div>
                  <d-tooltip :content="$t('AICoreTIP')">
                    <d-icon name="helping" size="16px"></d-icon>
                  </d-tooltip>
                </div>
                <div class="data-value">{{ AICoreUsage }}%</div>
              </div>
              <div class="measure-detail-data-item">
                <div class="data-title-row">
                  <div class='data-title'>{{ $t('CubeUtilization') }}</div>
                  <d-tooltip :content="$t('CubeUtilizationTIP')">
                    <d-icon name="helping" size="16px"></d-icon>
                  </d-tooltip>
                </div>
                <div class="data-value">{{ AICUsage }}%</div>
              </div>
              <div class="measure-detail-data-item">
                <div class="data-title-row">
                  <div class='data-title'>{{ $t('VectorUtilization') }}</div>
                  <d-tooltip :content="$t('VectorUtilizationTIP')">
                    <d-icon name="helping" size="16px"></d-icon>
                  </d-tooltip>
                </div>
                <div class="data-value">{{ AIVUsage }}%</div>
              </div>
            </div>
            <div class="measure-detail-data-downarea">
              <div class="measure-detail-data-downarea-time">
                <div class="measure-detail-data-item">
                  <div class="data-title-row">
                    <div class='data-title'>{{ $t('cubeTime') }}</div>
                    <d-tooltip :content="$t('cubeTimeTIP')">
                      <d-icon name="helping" size="16px"></d-icon>
                    </d-tooltip>
                  </div>
                  <div class="cube-time-value">{{ cubeCycle }}</div>
                </div>
                <div class="measure-detail-data-item">
                  <div class="data-title-row">
                    <div class='data-title'>{{ $t('vectorTime') }}</div>
                    <d-tooltip :content="$t('vectorTimeTIP')">
                      <d-icon name="helping" size="16px"></d-icon>
                    </d-tooltip>
                  </div>
                  <div class="vector-time-value">{{ vectorCycle }}</div>
                </div>
              </div>
              <div class="measure-detail-data-downarea-time-ratio">
                <div v-if="cubeCycleRateValue > 0" class="cube-time-bar" :style="{ flex: `${cubeCycleRateValue}%` }">
                  <div class="cube-time-num">{{ cubeCycleRate }}%</div>
                </div>
                <div v-if="vectorCycleRateValue > 0" class="vector-time-bar" :style="{ flex: `${vectorCycleRateValue}%` }">
                  <div class="vector-time-num">{{ vectorCycleRate }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="measure-detail-right-section">
          <div class="measure-detail-search-area">
            <d-category-search :category="category" :extend-config="{ save: { show: false } }"  @selectedTagsChange="onMeasureSearch" style="width: 58%;" :default-search-field="defaultSearchField" @search="onSearch">
            </d-category-search>
            <div class="event-num">{{ $t('totalEvents', { eventNum }) }}</div>
          </div>
          <div class="measure-detail-data-table">
            <d-table :data="measureDetailTableData" style="width: 100%" class="mulDetailTable">
              <d-column field="rootFuncHash" header="Root Func. Hash"></d-column>
              <d-column field="leafFuncHash" header="Leaf Func. Hash"></d-column>
              <d-column field="occurrences" header="Occurrences"></d-column>
              <d-column field="wallDuration" header="Wall duration(ms)"></d-column>
              <d-column field="avgDuration" header="AvG. Wall duration(ms)"></d-column>
            </d-table>
          </div>
        </div>
        <div class="close-button">
          <d-button icon="icon-close" style="width: 16px; font-size: 16px; border: none; background-color: transparent"
            @click="measureDetailsPanel()"></d-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch} from 'vue';

// 注入父组件提供的状态和方法
const {
  mulDetailsExpanded,
  measureDetailsData,
  rootHashes,
  leafHashes,
  leafHashMap,
} = inject('swimGraphState');

const {
} = inject('swimGraphMethods');


const AICoreUsage = ref('0');
const AICUsage = ref('0');
const AIVUsage = ref('0');
const cubeCycle = ref('0');
const vectorCycle = ref('0');
const cubeCycleRate = ref('0');
const vectorCycleRate = ref('0');
const cubeCycleRateValue = ref('0');
const vectorCycleRateValue = ref('0');
const eventNum = ref('0');

const measureDetailTableData = ref([]);

const measureDetailsPanel = () => {
  mulDetailsExpanded.value = !mulDetailsExpanded.value;
};
let searchKeyInfo = '';
const defaultSearchField = ['Root', 'Leaf'];
let category = [
    {
      label: 'Root Func. Hash',
      field: 'Root',
      type: 'radio',
      group: 'Basic',
      filterKey: 'Option',
      options: []
    },
    {
      label: 'Leaf Func. Hash',
      field: 'Leaf',
      type: 'radio',
      group: 'Basic',
      filterKey: 'Option',
      options: []
    }
  ];
const onSearch = (event) => {
  const { searchKey } = event;
  searchKeyInfo = searchKey;
  if (searchKey === '') {
    onMeasureSearch(event);
  }
};
const onMeasureSearch = (event) => {
  initTableDatas();
  const { selectedTags } = event;
  let defaultFilterData = measureDetailTableData.value;
  if (searchKeyInfo) {
    defaultFilterData = measureDetailTableData.value.filter(item =>
      item.rootFuncHash.includes(searchKeyInfo) || item.leafFuncHash.includes(searchKeyInfo)
    );
  }
  const filteredData = selectedTags.reduce((item, { field, value: { Option } }) => {
    return item.filter(row => {
      if (field === 'Root') {
        return row.rootFuncHash === Option;
      }
      if (field === 'Leaf') {
        return row.leafFuncHash === Option;
      }
      return true;
    });
  }, [...defaultFilterData]);
  measureDetailTableData.value = filteredData;
  if (measureDetailTableData.value.length === 0) {
    measureDetailTableData.value = [];
  }
};

const rateToValue = () => {
  cubeCycleRateValue.value = cubeCycleRate.value === '/' ? 0 :cubeCycleRate.value;
  vectorCycleRateValue.value = vectorCycleRate.value === '/' ? 0 :vectorCycleRate.value;
  if (cubeCycleRateValue.value === 0 && vectorCycleRateValue.value === 0) {
    cubeCycleRateValue.value = 50;
    vectorCycleRateValue.value = 50;
  }
};

const initDatas = () => {
  if (measureDetailsData.value.length === 0) {
    return;
  }
  const [data] = measureDetailsData.value;
  const handleNaN = (value) => {
    return isNaN(value) ? '/' : value;
  };
  AICoreUsage.value = handleNaN(data.AICoreusage);
  AICUsage.value = handleNaN(data.AICusage);
  AIVUsage.value = handleNaN(data.AIVusage);
  eventNum.value = handleNaN(data.eventnum);

  const processCycleValue = (value) => {
    return value === 0 ? '/' : handleNaN(value);
  };

  cubeCycle.value = processCycleValue(data.cubecycle);
  vectorCycle.value = processCycleValue(data.vectorcycle);

  const cubeCycleNum = cubeCycle.value === '/' ? NaN : parseFloat(cubeCycle.value);
  const vectorCycleNum = vectorCycle.value === '/' ? NaN : parseFloat(vectorCycle.value);

  if (isNaN(cubeCycleNum) && isNaN(vectorCycleNum)) {
    cubeCycleRate.value = '/';
    vectorCycleRate.value = '/';
  } else if (isNaN(cubeCycleNum)) {
    cubeCycleRate.value = '/';
    vectorCycleRate.value = 100;
  } else if (isNaN(vectorCycleNum)) {
    cubeCycleRate.value = 100;
    vectorCycleRate.value = '/';
  } else {
    const total = cubeCycleNum + vectorCycleNum;
    cubeCycleRate.value = parseFloat(((cubeCycleNum / total) * 100).toFixed(2));
    vectorCycleRate.value = parseFloat(((vectorCycleNum / total) * 100).toFixed(2));
  }
  rateToValue();
};

const initTableDatas = () => {
  measureDetailTableData.value = [];
  leafHashMap.value.forEach((value, key) => {
    const avgWallDuration = value['Avg Wall duration'];
    const occurrences = value.Occurrences;
    const wallDuration = value['Wall duration'];
    const rootHashValue = value['root hash'];
    const leafHashValue = value['leaf hash'];
    const tableData = {
      rootFuncHash: rootHashValue,
      leafFuncHash: leafHashValue,
      occurrences,
      wallDuration: Number(wallDuration).toFixed(2),
      avgDuration: Number(avgWallDuration).toFixed(2)
    };
    measureDetailTableData.value.push(tableData);
  });
};


defineExpose({
});

watch(mulDetailsExpanded, (newValue) => {
  if (newValue === true) {
    initDatas();
    initTableDatas();
    category.forEach((item, index) => {
      item.options = index === 0 ? transformToOptions(rootHashes.value) : transformToOptions(leafHashes.value);
    });
    category =  JSON.parse(JSON.stringify(category));
  }
});
const transformToOptions = (source) => 
  [...source.values()].map(item => ({ Option: item }));
</script>

<style scoped lang="scss">
@import url("../css/swimGraph/MeasureDetail/measureDetail.css");
</style>

<style scoped lang="scss">
:deep() {
  .mulDetailTable {
    .devui-table__container::-webkit-scrollbar {
      width: 4px;
    }

    .devui-table__empty {
      text-align: center;
    }

    .devui-table__thead tr {
      background: var(--devui-swim-split-line);
    }

    .devui-table__thead .header-container .title {
      color: var(--devui-secondary-text);
    }

    .devui-table__tbody tr {
      background: var(--devui-swim-detail-bg);
    }
  }
  .measure-detail-search-area .dp-category-search-container:focus-within{
    border-color: #5e7cc0;
    border-color: var(--devui-form-control-line-active);
  }
}
</style>
