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
                  <d-tooltip :content="$t('AICore')">
                    <d-icon name="helping" size="16px"></d-icon>
                  </d-tooltip>
                </div>
                <div class="data-value">{{ AICoreUsage }}%</div>
              </div>
              <div class="measure-detail-data-item">
                <div class="data-title-row">
                  <div class='data-title'>{{ $t('CubeUtilization') }}</div>
                  <d-tooltip :content="$t('CubeUtilization')">
                    <d-icon name="helping" size="16px"></d-icon>
                  </d-tooltip>
                </div>
                <div class="data-value">{{ AICUsage }}%</div>
              </div>
              <div class="measure-detail-data-item">
                <div class="data-title-row">
                  <div class='data-title'>{{ $t('VectorUtilization') }}</div>
                  <d-tooltip :content="$t('VectorUtilization')">
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
                    <d-tooltip :content="$t('cubeTime')">
                      <d-icon name="helping" size="16px"></d-icon>
                    </d-tooltip>
                  </div>
                  <div class="cube-time-value">{{ cubeCycle }}</div>
                </div>
                <div class="measure-detail-data-item">
                  <div class="data-title-row">
                    <div class='data-title'>{{ $t('vectorTime') }}</div>
                    <d-tooltip :content="$t('vectorTime')">
                      <d-icon name="helping" size="16px"></d-icon>
                    </d-tooltip>
                  </div>
                  <div class="vector-time-value">{{ vectorCycle }}</div>
                </div>
              </div>
              <div class="measure-detail-data-downarea-time-ratio">
                <div v-if="cubeCycleRate > 0" class="cube-time-bar" :style="{ flex: `${cubeCycleRate}%` }">
                  <div class="cube-time-num">{{ cubeCycleRate }}%</div>
                </div>
                <div v-if="vectorCycleRate > 0" class="vector-time-bar" :style="{ flex: `${vectorCycleRate}%` }">
                  <div class="vector-time-num">{{ vectorCycleRate }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="measure-detail-right-section">
          <div class="measure-detail-search-area">
            <d-input v-model="measureDetailInput" :placeholder="searchPlaceholder" class="measure-detail-search">
              <template #prepend>
                <d-select v-model="measureDetailSelect" :options="options" class="measure-detail-select"></d-select>
              </template>
              <template #append>
                <d-icon name="search" @click="onMeasureSearch()" />
              </template>
            </d-input>
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
import { ref, computed, inject, watch, nextTick, provide, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { clone } from 'lodash-es';
import { formatTimeWithUnit, COLOR_CFG, DEP_MODE } from '../swimGraphUtils';

// 注入父组件提供的状态和方法
const {
  mulDetailsExpanded,
  measureDetailsData,
  rootHashes,
  leafHashMap,
} = inject('swimGraphState');

const {
} = inject('swimGraphMethods');

const searchPlaceholder = ref('Search');

const AICoreUsage = ref('0');
const AICUsage = ref('0');
const AIVUsage = ref('0');
const cubeCycle = ref('0');
const vectorCycle = ref('0');
const cubeCycleRate = ref('0');
const vectorCycleRate = ref('0');
const eventNum = ref('0');

const measureDetailTableData = ref([]);

const measureDetailsPanel = () => {
  mulDetailsExpanded.value = !mulDetailsExpanded.value;
};

const items = [
  'Root Func. Hash',
  'Leaf Func. Hash'
];
const measureDetailInput = ref('');
const measureDetailSelect = ref('Root Func. Hash');
const options = reactive(items);

const onMeasureSearch = () => {
  const searchCriteria = measureDetailInput.value;
  const selectCriteria = measureDetailSelect.value;

  if (measureDetailInput.value === '') {
    initTableDatas();
    return;
  }

  if (selectCriteria === 'Root Func. Hash') {
    measureDetailTableData.value = measureDetailTableData.value.filter(item =>
      item.rootFuncHash === searchCriteria
    );
  } else if (selectCriteria === 'Leaf Func. Hash') {
    measureDetailTableData.value = measureDetailTableData.value.filter(item =>
      item.leafFuncHash === searchCriteria
    );
  }

  if (measureDetailTableData.value.length === 0) {
    measureDetailTableData.value = [{
      rootFuncHash: 'No search data'
    }];
  }
};

const initDatas = () => {
  if (measureDetailsData.value.length === 0) {
    return;
  }
  const [data] = measureDetailsData.value;
  const handleNaN = (value) => {
    return isNaN(value) ? '0' : value;
  };
  AICoreUsage.value = handleNaN(data.AICoreusage);
  AICUsage.value = handleNaN(data.AICusage);
  AIVUsage.value = handleNaN(data.AIVusage);
  cubeCycle.value = handleNaN(data.cubecycle);
  vectorCycle.value = handleNaN(data.vectorcycle);
  eventNum.value = handleNaN(data.eventnum);
  const cubeCycleNum = parseFloat(cubeCycle.value);
  const vectorCycleNum = parseFloat(vectorCycle.value);
  if (cubeCycleNum + vectorCycleNum !== 0) {
    cubeCycleRate.value = parseFloat(((cubeCycleNum / (cubeCycleNum + vectorCycleNum))) * 100 .toFixed(2));
    vectorCycleRate.value = parseFloat((1 - parseFloat(cubeCycleRate.value)).toFixed(2));
  } else {
    cubeCycleRate.value = 0;
    vectorCycleRate.value = 0;
  }
};

const initTableDatas = () => {
  measureDetailTableData.value = [];
  leafHashMap.value.forEach((value, key) => {
    const avgWallDuration = value['Avg Wall duration'];
    const occurrences = value.Occurrences;
    const wallDuration = value['Wall duration'];
    const tableData = {
      rootFuncHash: rootHashes.value[0],
      leafFuncHash: key,
      occurrences,
      wallDuration,
      avgDuration: avgWallDuration
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
  }
});
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

  .measure-detail-search {
    width: 410px;

    .devui-input__wrapper {
      box-shadow: none !important;

      input:focus {
        outline: none;
      }
    }

    .devui-input-slot__append:hover {
      border: 1px solid var(--devui-form-control-line-active);
      cursor: pointer;
    }
  }

  .measure-detail-select {
    width: 110px;

    .devui-select__selection {
      input:focus {
        box-shadow: none !important;
        outline: 1px solid var(--devui-form-control-line-active);
        outline-offset: 0px;
      }
    }
  }

  .measure-detail-select.devui-select:not(.devui-select--disabled):not(.devui-select--underlined) .devui-select__selection.devui-select__selection--glow-style:hover {
    box-shadow: none !important;
  }

  .measure-detail-select.devui-select--open .devui-select__selection.devui-select__selection--glow-style,
  .devui-select--focus .devui-select__selection.devui-select__selection--glow-style {
    box-shadow: none !important;
  }
}
</style>
