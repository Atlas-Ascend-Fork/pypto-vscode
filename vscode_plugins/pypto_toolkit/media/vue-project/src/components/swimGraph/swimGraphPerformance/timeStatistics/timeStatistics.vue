<template>
    <div class="time-statistics-complete-containner">
        <div>
            <d-select v-model="timeType" :options="timeOptions" size="md" class="time-type-width"
                @value-change="handleTimeChange" @update:modelValue="OnModeChange"></d-select>
        </div>
        <div class="time-statistics-title">{{ $t('executionTimeRange') }}</div>
        <div class="time-statistics-title-sub" v-if="timeType === 'id'">{{ leafIndexName }}</div>
        <time-range-chart v-if="(!showSubGraphTimingChart && timeType === 'id') || timeType === 'label'"
            @update-data="onUpdateData" />
        <div v-if="timeType === 'label'">
            <div class="time-statistics-title">{{ $t('totalTime') }}</div>
            <d-table :data="dataSource" class="time-statistics-table" @cell-click="onCellClick">
                <d-column field="semanticLabel" class="ml0">
                    <template #header>
                        <span class="header-label-color">{{ $t('taskLabel') }}</span>
                    </template>
                </d-column>
                <d-column>
                    <template #header>
                        <div class="header-label-content">
                            <div class="header-label-color mr4">{{ $t('cumulativeTime') }}
                            </div>
                            <d-popover trigger="hover" :position="['top']">
                                <template #content>
                                    <div>
                                        <div class="text-wrap">{{ $t('totalSubtaskTime') }} </div>
                                    </div>
                                </template>
                                <d-icon name="op-help" class="font-size-16"></d-icon>
                            </d-popover>
                        </div>
                    </template>
                    <template #default="scope">
                        <div class="cursor-style">{{ scope.row.cumulativeTime }}</div>
                    </template>
                </d-column>
                <d-column>
                    <template #header>
                        <div class="header-label-content">
                            <div class="header-label-color mr4">{{ $t('cycleDuration') }}
                            </div>
                            <d-popover trigger="hover" :position="['top']">
                                <template #content>
                                    <div>
                                        <div class="text-wrap">{{ $t('subtaskTimeSpan') }} </div>
                                    </div>
                                </template>
                                <d-icon name="op-help" class="font-size-16"></d-icon>
                            </d-popover>
                        </div>
                    </template>
                    <template #default="scope">
                        <div class="cursor-style">{{ scope.row.cycleDuration }}</div>
                    </template>
                </d-column>
            </d-table>
        </div>
        <div v-if="timeType === 'id' && showSubGraphTimingChart" class="time-statistics-graph-content">
            <div class="padding16"><d-icon name="back" @click="drillDownSubGraphTiming" class="cursor-style"></d-icon>
                <span class="time-distribution-text">{{ $t('latencyDistribution') }}</span> <span
                    class="time-distribution-line">|</span><span
                    class="time-distribution-text">{{ $t('subGraphId') }}</span> <span
                    class="time-distribution-id">{{ subGraphId
                    }}</span>
            </div>
            <d-chart :option="option" class="chart-containner"></d-chart>
        </div>
    </div>
</template>
<script setup>
import { ref, reactive, provide, inject } from 'vue';
import TimeRangeChart from '../timeRangeChart/timeRangeChart.vue';
import { getSubGraphId } from '../../swimGraphProcesses/processInfo';
import { useI18n } from 'vue-i18n';
import { executionTimeData } from '../utils';
const { t: $t } = useI18n();
const timeOptionsList = [{ name: $t('subGraph'), value: 'id' }, { name: $t('label'), value: 'label' }];
const timeOptions = reactive(timeOptionsList);
const timeType = ref('id');
let subGraphId = ref('');
const dataSource = ref([]);
const leafIndexName = ref($t('subgraphBasedLeafIndex'));
const mod = 1000;
const option = reactive({
    xAxis: {
        type: 'category',
        name: '(us)',
        nameGap: 10,
        data: []
    },
    yAxis: {
        type: 'value',
        name: window.ascLang === 'zh' ? `(${$t('subgraphs')})` : $t('subgraphs'),
        nameLocation: 'end'
    },
    tooltip: {
        trigger: 'axis',
        axisPointer: {
            type: 'shadow'
        },
        formatter(params) {
            let result = `<div class="time-statistics-color">${params[0].name - 10} ~ ${params[0].name}us</div>`;
            params.forEach((item) => {
                result += `
      <div class="echarts-tooltip-containner">
        <span style="color:${item.color};" class="font-size-20">●</span>
        <span class="ml4">${$t('taskCount')}</span>
        <span class="time-statistics-color ml10">${item.value}${$t('subgraphs')}</span>
      </div>
    `;
            });
            return result;
        }
    },
    series: [
        {
            data: [],
            type: 'bar',
            barWidth: 12,
            itemStyle: {
                color: 'rgba(0, 117, 102, 1)',
                borderRadius: [4, 4, 0, 0]
            }
        }
    ]
});
let showSubGraphTimingChart = ref(false);
const stats = new Map();
const {
    isSearchActive,
} = inject('swimGraphSearch');
const {
    highlightedPaths,
    detailsPanelExpanded,
    mulDetailsExpanded,
    childContextMap,
    processes,
    isMaxSchedule,
    measureDragStartX,
    measureDragEndY,
    measureDragStartTime,
    measureDragEndTime,
    selectedEvent,
    processExpanded
} = inject('swimGraphState');
const {
    render,
    drawMeasureTime,
    setMeasureDragHeight,
    resetsearchState,
    timeToX,
    xToTime,
    scrollToEvent,
} = inject('swimGraphMethods');
provide('subGraphTimingState', {
    showSubGraphTimingChart,
    timeType,
    processes,
    processExpanded,
    leafIndexName
});

const {
    clickTask
} = inject('swimGraphPmuBarMethod');

provide('swimGraphPmuBarMethod', {
    clickTask
});

const onCellClick = (params) => {
    if (isSearchActive.value) {
        resetsearchState();
    }
    if (params.columnIndex < 1) {
        return;
    }
    highlightedPaths.clear();
    selectedEvent.value = null;
    const processKey = findProcessKey(params.row.semanticLabel);
    if (!processKey) {
        return;
    }
    if (highlightedPaths.size > 0) {
        const process = processes.get(processKey);
        detailsPanelExpanded.value = false;
        mulDetailsExpanded.value = false;
        isMaxSchedule.value = false;
        if (process) {
            childContextMap.threadEvent.changeNodeColor(processKey, true);
            render();
        }
    }
    if (params.columnIndex === 2) {
        handleColumnClick(params.row.semanticLabel);
    }
};
const findProcessKey = (label) => {
  for (const [processKey, process] of processes.entries()) {
    if (!processExpanded.get(processKey)) {
        continue;
    }
    const foundKey = findInProcess(process, label);
    if (foundKey != null) {
        return foundKey; 
    }
  }
  return null; 
};
const findInProcess = (process, label) => {
  let processKeyInfo = null;
  let processKeySet = false;
  for (const [, thread] of process.threads.entries()) {
    if (thread.isCounter) {
        continue;
    }
    for (const event of thread.events) {
      if (event.isFakeCore || event.ph === 'C') {
        continue;
      }
      const match = event.name.match(/\((?<opName>[^)]+)\)/);
      const opName = match?.groups?.opName ?? '';
      if (!opName || opName !== label) {
        continue;
      }
      highlightedPaths.add(event.id);
      if (!processKeySet) {
        processKeyInfo = String(event.pid);
        processKeySet = true;
        scrollToEvent(event);
      }
    }
  }
  return processKeyInfo;
};
const handleColumnClick = (label) => {
    const stat = Array.from(stats.entries()).find(([opName]) => opName === label);
    if (!stat) {
        return;
    }
    isMaxSchedule.value = true;
    const [opName,  { totalDuration, minStart, maxEnd }] = stat;
    measureDragStartX.value =  timeToX(minStart);
    measureDragEndY.value = timeToX(maxEnd);
    measureDragStartTime.value = xToTime(measureDragStartX.value);
    measureDragEndTime.value = xToTime(measureDragEndY.value);
    setMeasureDragHeight();
    drawMeasureTime();
};

const drillDownSubGraphTiming = () => {
    showSubGraphTimingChart.value = !showSubGraphTimingChart.value;
};
const OnModeChange = () => {
    showSubGraphTimingChart.value = false;
};
const onUpdateData = (data) => {
  subGraphId.value = data.id;
    if (executionTimeData.echartsMap.size > 0 && executionTimeData.echartsMap.has(subGraphId.value)) {
        option.xAxis.data = executionTimeData.echartsMap.get(subGraphId.value).xAxisData;
        option.series[0].data = executionTimeData.echartsMap.get(subGraphId.value).seriesData;
        return;
    }
  const {durations: subGraphDuration } = collectSubGraphEvents(subGraphId.value);
  if (subGraphDuration.length === 0) {
    option.xAxis.data = [];
    option.series[0].data = [];
    return;
  }
  subGraphDuration.sort((a, b) => a - b);
  const maxDuration = subGraphDuration[subGraphDuration.length - 1];
  option.xAxis.data = getRanges(maxDuration);
  option.series[0].data = countDurationsInRanges(subGraphDuration);
    executionTimeData.echartsMap.set(subGraphId.value, {
        xAxisData: [...option.xAxis.data],
        seriesData: [...option.series[0].data]
    });
};
const collectSubGraphEvents = (targetId) => {
  const durations = [];
  for (const [processKey, process] of processes.entries()) {
    if (!processExpanded.get(processKey)) {
        continue;
    }
    for (const [, thread] of process.threads.entries()) {
      if (thread.isCounter) {
        continue;
      }
      for (const event of thread.events) {
        if (event.isFakeCore || event.ph === 'C') {
            continue;
        }
        const leafIndex = event.leafIndex || getSubGraphId(event, 'subGraph', '/');
        if (leafIndex !== targetId) {
            continue;
        }
        const taskTime = event.duration
          ? event.duration / mod
          : (event.endTime - event.startTime) / mod;
        durations.push(taskTime);
      }
    }
  }
  return { durations };
};
const countDurationsInRanges = (durations, step = 10) => {
    if (durations.length === 0) {
        return [];
    }
    const maxVal = Math.max(...durations);
    const numBuckets = Math.ceil(maxVal / step); // 桶的数量
    const counts = new Array(numBuckets).fill(0);
    for (const dur of durations) {
        const bucketIndex = Math.floor(dur / step);
        if (bucketIndex < numBuckets) {
            counts[bucketIndex]++;
        }
    }
    return counts.map((count, i) => {
        return count;
    });
};
const getRanges = (max, step = 10) => {
    const n = Math.ceil(max / step);
    return Array.from({ length: n }, (_, i) => `${(i + 1) * step}`);
};
const handleTimeChange = (val) => {
    if (val.value === 'id') {
        return;
    }
    getTableData();
};
const getTableData = () => {
    if (executionTimeData.tableData.length !== 0) {
        dataSource.value = executionTimeData.tableData;
        return;
    }
    for (const [processKey, process] of processes.entries()) {
        if (!processExpanded.get(processKey)) {
            continue;
        }
        for (const [threadKey, thread] of process.threads.entries()) {
            if (thread.isCounter) {
                continue;
            }
            for (const event of thread.events) {
                if (event.isFakeCore || event.ph === 'C') {
                    continue;
                }
                const match = event.name.match(/\((?<opName>[^)]+)\)/);
                const opName = match?.groups?.opName ?? '';
                if (!opName) {
                    continue;
                }
                const startTime = Number(event.startTime);
                const endTime = Number(event.endTime);
                const duration = Number(event.duration);
                const isInvalid =
                    isNaN(startTime) ||
                    isNaN(endTime) ||
                    isNaN(duration) ||
                    startTime > endTime;
                if (isInvalid) {
                    continue;
                }
                if (!stats.has(opName)) {
                    stats.set(opName, {
                        totalDuration: 0,
                        minStart: startTime,
                        maxEnd: endTime
                    });
                }
                const group = stats.get(opName);
                group.totalDuration += duration;
                group.minStart = Math.min(group.minStart, startTime);
                group.maxEnd = Math.max(group.maxEnd, endTime);
            }
        }
    }
    dataSource.value = Array.from(stats.entries()).map(([opName, { totalDuration, minStart, maxEnd }]) => {
        const cycleDuration = maxEnd - minStart;
        return {
            semanticLabel: opName,
            cumulativeTime: `${totalDuration / mod} us`,
            cycleDuration: `${cycleDuration / mod} us`
        };
    });
    dataSource.value.sort((a, b) => a.semanticLabel.localeCompare(b.semanticLabel));
    executionTimeData.tableData = [...dataSource.value];
};
</script>
<style lang="scss">
.time-statistics-table {
    top: 0;

    .devui-table__thead>tr>th:nth-child(1) .header-container {
        margin-left: 0;
    }
}

.text-wrap {
    white-space: normal;
    word-wrap: break-word;
    word-break: break-all;
    overflow-wrap: break-word;
    max-width: 132px;
}
</style>
<style lang="scss">
@import url("../../css/swimGraph/Header/timeStatistics.css");
</style>