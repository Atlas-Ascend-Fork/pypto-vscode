<template>
    <div class="time-statistics-complete-containner">
        <div>
            <d-select v-model="timeType" :options="timeOptions" size="md" class="time-type-width"
                @value-change="handleTimeChange" @update:modelValue="OnModeChange"></d-select>
        </div>
        <div class="time-statistics-title" :style="{'padding-bottom': timeType === 'label' ? `16px` : '0' }">{{ $t('executionTimeRange') }}</div>
        <div class="time-statistics-title-sub" v-if="timeType === 'id'">{{ leafIndexName }}</div>
        <div id="scroll-container-id" class="scroll-container">
        <time-range-chart v-if="(!showSubGraphTimingChart && timeType === 'id') || timeType === 'label'"
            @update-data="onUpdateData" />
        <div v-if="timeType === 'label'">
            <div class="time-statistics-title">{{ $t('totalTime') }}</div>
            <d-table :data="dataSource" class="time-statistics-table" @cell-click="onCellClick">
                <d-column field="semanticLabel" :style="{width: isWideScreen ? `148px` : '100px' }" show-overflow-tooltip>
                    <template #header>
                        <d-tooltip :content="$t('taskLabel')">
                            <div class="header-label-color" :style="{width: isWideScreen ? `100%` : '60px' }">{{ $t('taskLabel') }}</div>
                        </d-tooltip>
                    </template>
                </d-column>
                <d-column :style="{width: isWideScreen ? `146px` : '100px' }" show-overflow-tooltip>
                    <template #header>
                        <div class="header-label-content">
                            <d-tooltip :content="$t('cumulativeTime')">
                            <div class="header-label-color mr4" :style="{width: isWideScreen ? `100%` : '50px' }">{{ $t('cumulativeTime') }}</div>
                            </d-tooltip>
                            <d-popover trigger="hover" :position="['top-start']">
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
                <d-column :style="{width: isWideScreen ? `146px` : '100px' }" show-overflow-tooltip>
                    <template #header>
                        <div class="header-label-content">
                            <d-tooltip :content="$t('cycleDuration')">
                            <div class="header-label-color mr4" :style="{width: isWideScreen ? `100%` : '50px' }">{{ $t('cycleDuration') }}</div>
                            </d-tooltip>
                            <d-popover trigger="hover" :position="['top-start']">
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
                <template #empty>
                    <div style="text-align: center;">{{  $t('noDataText') }}</div>
                </template>
            </d-table>
        </div>
        </div>
        <div v-if="timeType === 'id' && showSubGraphTimingChart" class="time-statistics-graph-content">
            <div class="padding16">
                <d-icon name="back" @click="drillDownSubGraphTiming" class="cursor-style back-color"></d-icon>
                <span class="time-distribution-text">{{ $t('latencyDistribution') }}</span> 
                <span class="time-distribution-line">|</span>
                <span class="time-distribution-text">{{ $t('subGraphId') }}</span> 
                <span class="time-distribution-id">{{ subGraphId }}</span>
            </div>
            <d-chart :option="option" class="chart-containner" :id="`bar-chart-container-${subGraphId}`"></d-chart>
        </div>
    </div>
</template>
<script setup>
import { ref, reactive, provide, inject, watch, onUnmounted } from 'vue';
import * as echarts from 'echarts';
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
const barStep = ref(1);
const barColor = ref('rgba(0, 117, 102, 1)');
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
    processExpanded,
    isWideScreen,
    isDarkTheme
} = inject('swimGraphState');
const {
  modeOption
} = inject('swimGraphCfg');
const chartInstance = ref(null);
const option = reactive({
    xAxis: {
        type: 'value',
        name: '(us)',
        nameGap: 10,
        min: 0,
        max: 0,
        interval: 1,
        axisTick: {
            alignWithLabel: false
        },
        splitLine: {
            show: false
        },
        axisLabel: {
            interval: 'auto',
            hideOverlap: true,
            rotate: 45
        }
    },
    yAxis: {
        type: 'value',
        name: window.ascLang === 'zh' ? `(${$t('subgraphs')})` : $t('subgraphs'),
        nameLocation: 'end',
        splitLine: {
            show: true,
            lineStyle: {       
                type: 'solid',
                color: isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
            }
        }
    },
    grid: {
        top: '10%',
        left: '3%',
        right: '11%',
        bottom: '2%',
        containLabel: true
    },
    tooltip: {
        trigger: 'item',
        confine: true,
        axisPointer: {
            type: 'shadow'
        },
        formatter(params) {
            if (!params || !Array.isArray(params.data) || params.data.length < 3) {
                return '';
            }
            const [left, right, count] = params.data;
            const color = barColor.value;
            let result = `
            <div class="time-statistics-color font-weight-bold">
                ${left} ~ ${right} us
            </div>
            <div class="echarts-tooltip-containner">
                <span style="color:${color}" class="font-size-20">●</span>
                <span class="ml4">${$t('taskCount')}</span>
                <span class="time-statistics-color ml10 font-weight-bold">${count}${$t('subgraphs')}</span>
            </div>
        `;
            return result;
        }
    },
    series: [
        {
            data: [],
            type: 'custom',
            renderItem(params, api) {
                const xStart = api.value(0);
                const xEnd = api.value(1);
                const yValue = api.value(2);
                const startCoord = api.coord([xStart, yValue]);
                const endCoord = api.coord([xEnd, 0]);
                const width = endCoord[0] - startCoord[0];
                const height = endCoord[1] - startCoord[1];
                return {
                    type: 'rect',
                    shape: {
                        x: startCoord[0],
                        y: startCoord[1],
                        width,
                        height,
                        r: [4, 4, 0, 0]
                    },
                    style: api.style({
                        fill: barColor.value,
                        stroke: isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(174,174,174,1)',
                        lineWidth: 1
                    })
                };
            },
            encode: {
                x: [0, 1],
                y: 2,
                tooltip: 2,
                itemName: 0
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
    leafIndexName,
    isWideScreen
});

const {
    clickTask
} = inject('swimGraphPmuBarMethod');

provide('swimGraphPmuBarMethod', {
    clickTask
});
const customBarCount = isWideScreen.value ? ref(20) : ref(10);
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
    barColor.value = data.color; 
    const mapKey = subGraphId.value;
    const cache = executionTimeData.echartsMap;
    if (cache.size > 0 && cache.has(mapKey)) {
        const cachedItem = cache.get(mapKey);
        option.series[0].data = cachedItem.seriesData;
        barStep.value = cachedItem.barStepData;
        option.xAxis.interval = cachedItem.barStepData;
        option.xAxis.max = cachedItem.maxDurationData;
        return;
    }
    const { durations: subGraphDuration } = collectSubGraphEvents(mapKey);
    if (!subGraphDuration || subGraphDuration.length === 0) {
        option.series[0].data = [];
        option.xAxis.max = 4;
        option.xAxis.interval = 1;
        return;
    }
    subGraphDuration.sort((a, b) => a - b);
    const maxDuration = subGraphDuration[subGraphDuration.length - 1];
    const barCount = Math.min(Math.ceil(maxDuration / 10), customBarCount.value);
    const calculatedStep = maxDuration <= 10 ? 1 : Math.ceil(maxDuration / barCount);
    barStep.value = calculatedStep || 1; 
    const histogramData = getHistogramData(subGraphDuration);
    const lastItem = histogramData[histogramData.length - 1];
    const xAxisMax = lastItem ? lastItem[1] : (Math.ceil(maxDuration / calculatedStep) * calculatedStep);
    option.series[0].data = histogramData;
    option.xAxis.interval = barStep.value;
    option.xAxis.max = xAxisMax;
    cache.set(mapKey, {
        seriesData: histogramData,
        barStepData: barStep.value,
        maxDurationData: xAxisMax
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
const getHistogramData = (durations) => {
    if (!durations || durations.length === 0) {
        return [];
    }
    const maxVal = Math.max(...durations);
    const step = barStep.value;
    const numBuckets = Math.ceil(maxVal / step);
    const counts = new Array(numBuckets).fill(0);
    for (const dur of durations) {
        if (dur < 0) {
            continue;
        }
        let bucketIndex = Math.floor(dur / step);
        if (bucketIndex >= numBuckets) {
            bucketIndex = numBuckets - 1;
        }
        if (bucketIndex >= 0 && bucketIndex < numBuckets) {
            counts[bucketIndex]++;
        }
    }
    return counts.map((count, i) => {
        const left = i * step;
        const right = (i + 1) * step;
        return [left, right, count];
    });
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
watch(
    [isDarkTheme, modeOption],
    ([newTheme, newMode], [oldTheme, oldMode]) => {
        if (timeType.value !== 'id' || !showSubGraphTimingChart.value) {
            return;
        }
        clearEchartInstance();
        const mapKey = timeType.value;
        const cache = executionTimeData.timelineGroupsMap;
        if (cache.size > 0 && cache.has(mapKey)) {
            const cachedItem = cache.get(mapKey);
            const result = cachedItem.find(item => item.id === subGraphId.value);
            barColor.value = isDarkTheme.value ? result.event.color.dark.base : result.event.color.light.base;
            option.yAxis.splitLine.lineStyle.color = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            chartInstance.value.setOption(option, true);
        }
    }
);
 
const clearEchartInstance = () => {
    if (chartInstance.value) {
        chartInstance.value.dispose();
    }
    const fullId = `bar-chart-container-${subGraphId.value}`;
    const chartDom = document.getElementById(fullId);
    chartInstance.value = echarts.init(chartDom);
};
onUnmounted(() => {
    if (chartInstance.value) {
        chartInstance.value.dispose();
        chartInstance.value = null;
    }
});
</script>
<style lang="scss">
.time-statistics-table {
    top: 10px;
    .devui-table__thead>tr>th:nth-child(1) .header-container {
        margin-left: 0;
    }
}
.text-wrap {
  white-space: normal;
  max-width: 132px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: normal;        
}
</style>
<style lang="scss">
@import url("../../css/swimGraph/Header/timeStatistics.css");
</style>