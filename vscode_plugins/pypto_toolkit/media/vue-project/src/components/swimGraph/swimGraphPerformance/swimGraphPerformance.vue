<template>
  <div v-if="true" 
    :style="{width: performanceWidth + 'px', height: '100%'}" 
    class="pmu-report">
    <div class="close-container">
      <d-icon name="close" operable @click="closeStatistics"></d-icon>
    </div>
    <div class="report-title">{{ reportTitle }}</div>
    <d-tabs class="report-tabs" type="pills" v-model="reportTabId">
      <d-tab class="first-child" id="tab1" :title=PerformanceSummary>
      <div class="summary-container" :style="{width: performanceWidth + 'px'}">
        <div class="scheduling-gap-container-perform"
        v-if="maxGap.length > 0"
        :style="{width: subContainerWidth + 'px'}">
          <div class="left-scheduling-gap-container">
            <div class="time-task-item-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="task-title">{{maxSchedulingGap}}({{ formatGapUnit(maxGap[0]?.gap) }})</div>
              <div class="task-data" v-if="maxGap.length > 0">{{ formatGapValueWithUnit(maxGap[0].gap) }}</div>
            </div>
          </div>
          <div class="split-line" :style="{ height: `${54 + 52 * (maxGap.length -1 )}px` }"/>
          <div class="right-scheduling-gap-container" :style="{width: rightSchedulingGapContainerWidth + 'px'}">
            <div class="scheduling-gap-title">
              <div class="scheduling-gap-title-item">{{schedulingTask}}</div>
              <div class="scheduling-gap-title-item">{{schedulingSubTask}}</div>
            </div>
            <div class="max-scheduling-gap">
              <div v-for="(item, index) in maxGap" :key="index" class="max-scheduling-gap-item">
                <d-tooltip :content="item.parent.name">
                  <div class="max-scheduling-gap-item-task" :class="{ 'disabled': isPathLockStatus }" @click="showMaxSchedule(item)"
                  :style="{
                    '--base-bg-color': baseColor(item.parent),
                    '--hover-bg-color': lightColor(item.parent)
                  }">
                    <div class="max-scheduling-gap-item-task-text">{{item.parent.name}}</div>
                  </div>
                </d-tooltip>
                <div class="max-scheduling-gap-item-middle-container">
                  <div class="max-scheduling-gap-item-time">{{SchedulingGap}}{{parseFloat((item.gap / tsScale).toFixed(3))}} μs</div>
                  <div class="max-scheduling-gap-item-line"
                      :style="{
                      '--left-color': baseColor(item.parent),
                      '--right-color': baseColor(item.child),
                      width: gapLineWidth + 'px'
                    }"></div>
                </div>
                <d-tooltip :content="item.child.name">
                  <div class="max-scheduling-gap-item-task" :class="{ 'disabled': isPathLockStatus }" @click="showMaxSchedule(item, true)"
                    :style="{
                    '--base-bg-color': baseColor(item.child),
                    '--hover-bg-color': lightColor(item.child)
                  }">
                  <div class="max-scheduling-gap-item-task-text">{{item.child.name}}</div>
                  </div>
                </d-tooltip>
              </div>
            </div>
          </div>
        </div>

        <div class="time-consuming-container-perform"
        :style="{width: subContainerWidth + 'px'}" v-if="maxTimeTask.length > 0 && !isMsProf">

          <div class="task-statistic-item">
            <div class="left-scheduling-gap-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="time-task-item-container" :style="{width: innerContainerWidth + 'px'}">
                <div class="task-title">{{TaskMaxDuration}}({{ formatTimeUnit(maxTimeTaskVal) }})</div>
                <div class="task-data">{{ formatTimeValue(maxTimeTaskVal) }}</div>
              </div>
            </div>
            <div class="time-consuming-split-line"/>
            <div class="right-scheduling-gap-container" :style="{width: rightSchedulingGapContainerWidth + 'px'}">
              <div class="scheduling-gap-title">
                <div class="scheduling-gap-title-item">{{schedulingTask}}</div>
              </div>
              <div class="time-consuming-tasks-container">
                <d-tooltip v-for="(item, index) in maxTimeTask" :key="index" :content="item.name">
                  <div 
                    class="time-consuming-task"
                    :style="{
                    '--base-bg-color': baseColor(item),
                     '--hover-bg-color': lightColor(item),
                     width: timeConsumingTaskWidth +'px'
                    }"
                    :class="{ 'disabled': isPathLockStatus }"
                    @click="clickTask(item)">{{item.name}}</div>
                </d-tooltip>
              </div>
            </div>
          </div>

          <div class="task-statistic-item">
            <div class="left-scheduling-gap-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="time-task-item-container" :style="{width: innerContainerWidth + 'px'}">
                <div class="task-title">{{TaskMinDuration}}({{ formatTimeUnit(minTimeTaskVal) }})</div>
                <div class="task-data">{{ formatTimeValue(minTimeTaskVal) }}</div>
              </div>
            </div>
            <div class="time-consuming-split-line"/>
            <div class="right-scheduling-gap-container" :style="{width: rightSchedulingGapContainerWidth + 'px'}">
              <div class="scheduling-gap-title">
                <div class="scheduling-gap-title-item">{{schedulingTask}}</div>
              </div>
              <div class="time-consuming-tasks-container">
                <d-tooltip v-for="(item, index) in minTimeTask" :key="index" :content="item.name">
                  <div 
                    class="time-consuming-task"
                    :style="{
                    '--base-bg-color': baseColor(item),
                     '--hover-bg-color': lightColor(item),
                     width: timeConsumingTaskWidth +'px'
                    }"
                    :class="{ 'disabled': isPathLockStatus }"
                    @click="clickTask(item)">{{item.name}}</div>
                </d-tooltip>
              </div>
            </div>
          </div>

        </div>

        <div class="task-container" :style="{width: subContainerWidth + 'px'}">
          <div class="top-row-group" :style="{width: subContainerWidth + 'px', gap: aiCoreContainerColumnGap + 'px'}">
          <div class="task-item-container aicore-e2e-time" :style="{width: innerContainerWidth + 'px'}">
            <div class="task-title-container">
              <d-tooltip :content="taskOnBoardTimeTitle + ' (' + formatTimeUnit(taskOnBoardTime) + ')'">
                <div class="task-title">{{ taskOnBoardTimeTitle }} ({{ formatTimeUnit(taskOnBoardTime) }})</div>
              </d-tooltip>
                <d-tooltip :content="taskOnBoardTimeTip">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
            <div class="task-data">{{ formatTimeValue(taskOnBoardTime) }}</div>
          </div>
          <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
            <div class="task-title-container">
              <div class="task-title">{{ totalTimeTitle }} ({{ formatTimeUnit(taskTime) }})</div>
                <d-tooltip :content="totalTimeTip">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
            <div class="task-data">{{ formatTimeValue(taskTime) }}</div>
          </div>
          </div>
          <div class="task-item-container mt10" :style="{width: innerContainerWidth + 'px'}">
            <div class="task-title">{{ icacheHitRateTitle }}</div>
            <div class="task-data">{{ icacheHitRate }}</div>
          </div>
        </div>
        <div class="aicore-container" :style="{width: subContainerWidth + 'px'}" v-if="!isAicpu">
          <div class="aicore-container-column" :style="{gap: aiCoreContainerColumnGap + 'px'}">
            <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="task-title-container">
                <div class="task-title">AICore Time({{ formatTimeUnit(aicoreTime) }})</div>
                <d-tooltip :content="$t('AICoreTimeTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="task-data">{{ formatTimeValue(aicoreTime) }}</div>
            </div>
            <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="task-title-container">
                <div class="task-title">{{ aicoreRateTitle }}</div>
                <d-tooltip :content="$t('AICoreRateTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="task-data">{{ aicoreRate }}</div>
            </div>
          </div>
          <div class="aicore-container-column" :style="{height: 46 + 'px', marginTop: 8 + 'px', gap: aiCoreContainerColumnGap + 'px'}">
            <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="task-title-container">
                <div class="task-title">Cube Cycles</div>
                <d-tooltip :content="$t('cubeTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="cube-rate-cycle">{{ cubeRateCycle }}</div>
            </div>
            <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="task-title-container">
                <div class="task-title">Vector Cycles</div>
                <d-tooltip :content="$t('vecTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="vec-rate-cycle">{{ vectorRateCycle }}</div>
            </div>
          </div>
          <div class="cube-data-chart" :style="{width: cubeDataChartWidth + 'px'}">
            <div class="cube-time-bar" :style="{ width: cubeTimeWidth + 'px' }">
              <div class="cube-time-num">{{ cubeTimePercentage }}</div>
            </div>
            <div class="vector-time-bar" :style="{ width: vectorTimeWidth + 'px' }">
              <div class="vector-time-num">{{ vectorTimePercentage }}</div>
            </div>
          </div>
        </div>
        <swim-graph-bar-chart ref="swimGraphBarChartComponent" v-if="pmuExist && iniComplete" />
      </div>
      </d-tab>
      <d-tab id="tab2" v-if="!isAicpu && !isPerfSwim" :title="$t('executionTime')">
        <div class="time-statistics-tab-content">
          <time-statistics/>
        </div>
      </d-tab>
      <d-tab id="tab3" v-if="pmuValid" title="PMU">
        <pmu-insight-tab
          :performance-width="performanceWidth"
          :sub-container-width="subContainerWidth"
        />
      </d-tab>
    </d-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, provide, inject, onMounted, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BigNumber from 'bignumber.js';
import { buildEventMap } from '../swimGraphProcesses/render/utils';
import { getBaseColor, getLightColor } from '../swimGraphProcesses/processInfo';
import SwimGraphBarChart from '../swimGraphBarChart/swimGraphBarChart.vue';
import TimeStatistics from './timeStatistics/timeStatistics.vue';
import PmuInsightTab from './pmuInsightTab.vue';
import { executionTimeData, formatTimeUnit, formatTimeValue, US_TO_MS_THRESHOLD, US_TO_S_THRESHOLD, UNIT_US, UNIT_MS, UNIT_S } from './utils';
import { swimDataManager } from '../swimData';
const swimGraphBarChartComponent = ref(null);

const { t: $t } = useI18n();
const reportTabId = ref('tab1');

const pmuRowCoordList = ref([]);
const pmuColCoordList = ref([]);
const pmuRowCoordLoc = ref([]);
const pmuBarColorList = ref([]);
const pmuChartDataLeft = ref([]);
const pmuChartDataRight = ref([]);
const pmuBackLineLoc = ref([]);

const pmuExist = ref(true);
const reportTitle = ref($t('ReportTitle'));
const icacheHitRateTitle = ref($t('ICacheHitRate'));
const aicoreRateTitle = ref($t('aiCoreUtilization'));
const occupyRateTitle = ref($t('occupyRateTitle'));
const taskOnBoardTimeTitle = ref($t('taskOnBoardTimeTitle'));
const taskOnBoardTimeTip = ref($t('taskOnBoardTimeTip'));
const totalTimeTitle = ref($t('totalTime'));
const totalTimeTip = ref($t('totalTimeTip'));
const taskTime = ref(0);
const taskOnBoardTime = ref(0);
const aicoreTime = ref(0);
const aicoreRate = ref(0);
const icacheHitRate = ref('/');

const cubeTimeWidth = ref(203);
const vectorTimeWidth = ref(203);
const cubeTimePercentage = ref(50);
const vectorTimePercentage = ref(50);

const vectorRateWidth = ref(0);
const cubeRateWidth = ref(0);
const scalarRateWidth = ref(0);
const mte1RateWidth = ref(0);
const mte2RateWidth = ref(0);
const mte3RateWidth = ref(0);

const vectorRateCycle = ref('/');
const cubeRateCycle = ref('/');
const scalarRateCycle = ref('/');
const mte1RateCycle = ref('/');
const mte2RateCycle = ref('/');
const mte3RateCycle = ref('/');

const vectorRatePercentage = ref(0);
const cubeRatePercentage = ref(0);
const scalarRatePercentage = ref(0);
const mte1RatePercentage = ref(0);
const mte2RatePercentage = ref(0);
const mte3RatePercentage = ref(0);
const iniComplete = ref(false);


const maxGap = ref([]);
const maxGapVal = ref(0);
const maxTimeTask = ref([]);
const maxTimeTaskVal = ref(0);
const minTimeTask = ref([]);
const minTimeTaskVal = ref(0);

const {
  pmuTotal,
  pmuValid
} = inject('swimGraphPmuTotal');

const {
  tsScale,
  viewState,
  isPerfSwim,
  sliderMax,
  sliderMaxCount,
  timeLineX,
  processExpanded,
  processes,
  detailsPanelExpanded,
  selectedEvent,
  highlightedPaths,
  swimlaneContainer,
  isMeasureModel,
  measureDragStartX,
  measureDragEndX,
  isDarkTheme,
  mulDetailsExpanded,
  isLockStatus,
  isCfgEditing,
  isShortcutKeyShow,
  searchedEvent,
  isThreeColumn,
  fileName,
  isAicpu,
  isSwimGraphActive,
  isSwimFullscreen,
  isPathLockStatus,
  timelineComponent,
  layout,
  lane2line,
  performanceVisible,
  performanceWidth,
  isWideScreen,
  isMaxSchedule,
  isE2ESwim,
  childContextMap,
  kernelColorRending,
  isMixMode,
  canvasclickedEvent,
  isFromPerformanceClick,
  isMsProf
} = inject('swimGraphState');

const {
  showDependencies,
  selectEvent,
  toggleProcess,
  showMaxScheduleEvent,
  resetMaxScheduleState,
  scrollToEvent,
  canvasStatusReset,
  autoExpandkernelProcess
} = inject('swimGraphMethods');

provide('swimGraphPmuBarChartInfo', {pmuRowCoordList, pmuColCoordList, pmuRowCoordLoc, pmuBarColorList, pmuChartDataLeft, pmuChartDataRight, reportTitle, pmuBackLineLoc, isDarkTheme});

const schedulingTask = ref($t('schedulingTask'));
const schedulingSubTask = ref($t('schedulingSubTask'));
const maxSchedulingGap = ref($t('maxSchedulingGap'));
const SchedulingGap = ref($t('SchedulingGap'));
const TaskMinDuration = ref($t('TaskMinDuration'));
const TaskMaxDuration = ref($t('TaskMaxDuration'));
const PerformanceSummary = ref($t('PerformanceSummary'));

const clickTask = async (clickEvent) => {
  isFromPerformanceClick.value = true;
  let event = JSON.parse(JSON.stringify(clickEvent));
  if (isMaxSchedule.value) {
    resetMaxScheduleState();
  }
  const key = event.pid.toString();
  if (isE2ESwim.value) {
    await autoExpandkernelProcess();
  } else if (isPerfSwim.value && !processExpanded.get(key)) {
    toggleProcess(key);
    childContextMap.threadEvent.eraseEventLine('over');
    await nextTick();
  } else if (!processExpanded.get(key)){
    toggleProcess(key);
    childContextMap.threadEvent.eraseEventLine('over');
    await nextTick();
  }
  showDependencies(event, 'both');
  const wasPanelClosed = !detailsPanelExpanded.value;
  selectEvent(event, key);
  if (wasPanelClosed) {
    await new Promise(resolve => {
      const detailPanel = document.querySelector('.details-panel');
      if (detailPanel) {
        detailPanel.addEventListener('transitionend', resolve, { once: true });
        setTimeout(resolve, 350);
      } else {
        resolve();
      }
    });
  }
  scrollToEvent(event);
};

const showMaxSchedule = async (item, isChild = false) => {
  const key = item.child.pid.toString();
  if (!processExpanded.get(key)){
    toggleProcess(key);
    childContextMap.threadEvent.eraseEventLine('over');
    await nextTick();
  }
  canvasclickedEvent.value = isChild ? item.child : item.parent;
  const subParentEvents = swimDataManager.getSubEvents(item.parent.id);
  const subChildEvents = swimDataManager.getSubEvents(item.child.id);
  const useSubEvent = isChild && isMixMode?.value && swimDataManager.hasMixConfig();
  const parentEvent = useSubEvent && subParentEvents.length > 0
    ? subParentEvents[subParentEvents.length - 1]
    : item.parent;
  const childEvent = useSubEvent && subChildEvents.length > 0
    ? subChildEvents[0]
    : item.child;
  await showMaxScheduleEvent(parentEvent, childEvent);
  scrollToEvent(isChild ? childEvent : parentEvent);
};

const subContainerWidth = ref(480);
const subContainerGap = ref(16);
const innerContainerWidth = ref(109);
const timeConsumingTaskWidth = ref(276);
const cubeDataChartWidth = ref(450);
const aiCoreContainerColumnGap = ref(16);
const rightSchedulingGapContainerWidth =ref(308);
const gapLineWidth = ref(173.5);

SchedulingGap.value = isWideScreen.value? $t('SchedulingGap') : '';
subContainerWidth.value = isWideScreen.value? 440 : 330;
subContainerGap.value = isWideScreen.value? 16 : 8;
innerContainerWidth.value = isWideScreen.value? 109 : 101;
timeConsumingTaskWidth.value = isWideScreen.value? 276 : 123;
cubeDataChartWidth.value = isWideScreen.value? 450 : 270;
cubeTimeWidth.value = isWideScreen.value? 243 : 133;
vectorTimeWidth.value = isWideScreen.value? 243 : 133;
aiCoreContainerColumnGap.value = isWideScreen.value? 120 : 16;
rightSchedulingGapContainerWidth.value = isWideScreen.value? 268: 130;
gapLineWidth.value = isWideScreen.value? 213.5 : 66.5;

const baseColor = (event) => {
  return getBaseColor(event, { processes, kernelColorRending, isDarkTheme });
};

const lightColor = (event) => {
  return getLightColor(event, { processes, kernelColorRending, isDarkTheme });
};

const closeStatistics = () => {
  performanceVisible.value = false;
  performanceWidth.value = 0;
};

const formatGapValue = (gap) => {
  return Number.isInteger(gap) ? gap : parseFloat(gap.toFixed(3));
};

const formatGapUnit = (gap) => {
  if (!gap) return UNIT_US;
  const valueInUs = gap / tsScale.value;
  if (valueInUs >= US_TO_S_THRESHOLD) return UNIT_S;
  if (valueInUs >= US_TO_MS_THRESHOLD) return UNIT_MS;
  return UNIT_US;
};

const formatGapValueWithUnit = (gap) => {
  if (!gap) return 0;
  const valueInUs = parseFloat((gap / tsScale.value).toFixed(3));
  if (valueInUs >= US_TO_S_THRESHOLD) {
    return parseFloat((valueInUs / US_TO_S_THRESHOLD).toFixed(3));
  }
  if (valueInUs >= US_TO_MS_THRESHOLD) {
    return parseFloat((valueInUs / US_TO_MS_THRESHOLD).toFixed(3));
  }
  return valueInUs;
};

const getEventDuration = (event) => {
  return event.duration || (event.endTime - event.startTime);
};

const updateExtremeValues = (
  event,
  taskDur,
  stats
) => {
  if (taskDur > stats.maxTime) {
    stats.maxTime = taskDur;
    stats.maxTimeEvents = [event];
  } else if (taskDur === stats.maxTime) {
    stats.maxTimeEvents.push(event);
  }

  if (taskDur < stats.minTime) {
    stats.minTime = taskDur;
    stats.minTimeEvents = [event];
  } else if (taskDur === stats.minTime) {
    stats.minTimeEvents.push(event);
  }
};

const calculateGapStatistics = (
  event,
  stats
) => {
  for (const childId of event.dependencies.successors) {
    const child = swimDataManager.getEventById(childId);
    if (!child) {
      continue;
    }

    const gap = child.startTime - event.endTime;
    
    if (gap > stats.maxGap) {
      stats.maxGap = gap;
      stats.maxGapEvents = [{
        parent: event,
        child,
        gap: formatGapValue(gap)
      }];
    } else if (gap === stats.maxGap) {
      stats.maxGapEvents.push({
        parent: event,
        child,
        gap: formatGapValue(gap)
      });
    }
  }
};

const calculateStatistics = () => {
  const stats = {
    maxTime: -Infinity,
    minTime: Infinity,
    maxGap: -Infinity,
    maxTimeEvents: [],
    minTimeEvents: [],
    maxGapEvents: []
  };

  const mod = tsScale.value;

  for (const [processKey, processInfo] of Array.from(swimDataManager.processInfo.entries())) {
    if (isE2ESwim.value && processInfo.type !== 'kernel') {
      continue;
    }

    for (const threadInfo of Array.from(processInfo.threads.values())) {
      if (threadInfo.isCounter || threadInfo.threadName.includes('Fake Core')) {
        continue;
      }

      for (const eventId of threadInfo.eventIds) {
        const event = swimDataManager.getEventById(eventId);
        if (!event) {
          continue;
        }

        const taskDur = getEventDuration(event);
        updateExtremeValues(event, taskDur, stats);
        calculateGapStatistics(event, stats);
      }
    }
  }

  const maxTimeTaskValue = stats.maxTime / mod;
  const minTimeTaskValue = stats.minTime / mod;

  maxGap.value = stats.maxGapEvents;
  maxTimeTask.value = stats.maxTimeEvents;
  maxTimeTaskVal.value = Number.isInteger(maxTimeTaskValue) ? maxTimeTaskValue : parseFloat(maxTimeTaskValue.toFixed(3));
  minTimeTask.value = stats.minTimeEvents;
  minTimeTaskVal.value = Number.isInteger(minTimeTaskValue) ? minTimeTaskValue : parseFloat(minTimeTaskValue.toFixed(3));
};


const calculateAicoreInfo = () => {
  let aicTaskTimeSum = 0;
  let totalCnt = 0;
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const [processKey, processInfo] of Array.from(swimDataManager.processInfo.entries())) {
    const isValidType = ['kernel', '', undefined].includes(processInfo.type);
    const isNotExcludedPerfSwim = processInfo.type === 'PerfSwim' && processInfo.name === 'AICore View';
    if (!isValidType && !isNotExcludedPerfSwim) {
      continue;
    }

    for (const threadInfo of Array.from(processInfo.threads.values())) {
      if (threadInfo.isCounter || threadInfo.threadName.includes('Fake Core')) {
        continue;
      }

      const threadName = threadInfo.threadName.toLowerCase();
      const parentThreadName = threadInfo.parentThreadName;
      const isMsProfAicOrAiv = parentThreadName && (parentThreadName.includes('-aic') || parentThreadName.includes('-aiv'));
      if (!threadName.startsWith('aic') && !threadName.startsWith('aiv') && !isMsProfAicOrAiv) {
        continue;
      }

      totalCnt += 1;

      for (const eventId of threadInfo.eventIds) {
        const event = swimDataManager.getEventById(eventId);
        if (!event) {
          continue;
        }

        aicTaskTimeSum += event.duration || 0;
        minTs = Math.min(event.startTime, minTs);
        maxTs = Math.max(event.endTime, maxTs);
      }
    }
  }

  aicoreTime.value = parseFloat((aicTaskTimeSum / tsScale.value).toFixed(2));
  const aicoreRateBigNumber = ((new BigNumber(aicTaskTimeSum)).dividedBy(new BigNumber(totalCnt * taskOnBoardTime.value))).div(new BigNumber(tsScale.value));
  aicoreRate.value = isMsProf.value ? '/' : parseFloat((aicoreRateBigNumber * 100).toFixed(2)) + '%';
};

const isPmuDataVaild = () => {
  return pmuTotal.value !== undefined && Object.keys(pmuTotal.value).length > 0 && pmuTotal.value['total cycle'] !== 0;
};

const initializePmuDefaults = () => {
    cubeRateCycle.value = '/';
    vectorRateCycle.value = '/';
    scalarRateCycle.value = '/';
    mte1RateCycle.value = '/';
    mte2RateCycle.value = '/';
    mte3RateCycle.value = '/';
    cubeTimePercentage.value = '/';
    vectorTimePercentage.value = '/';
    pmuExist.value = false;
};

const calculateCacheHitRate = () => {
  const icacheReq = pmuTotal.value.icache_req || 0;
  const icacheMiss = pmuTotal.value.icache_miss || 0;
  const icacheHitRateValue = icacheReq > 0 ? (icacheReq - icacheMiss) / icacheReq : 0;
  icacheHitRate.value = String(Math.round(icacheHitRateValue * 100)) + '%';
};

const calculateTimeMetrics = () => {
  const cubeTime = Number(pmuTotal.value.cube_busy_cycles || pmuTotal.value.cube_instr_busy || 0);
  const vectorTime = Number(pmuTotal.value.vec_busy_cycles || pmuTotal.value.pmu_idc_aic_vec_busy_o || 0);
  const barWidth = 406;
  cubeTimePercentage.value = Math.floor(cubeTime / (cubeTime + vectorTime) * 100) + '%';
  vectorTimePercentage.value = String(100 - Math.floor(cubeTime / (cubeTime + vectorTime) * 100)) + '%';
  cubeTimeWidth.value = barWidth * cubeTime / (cubeTime + vectorTime);
  vectorTimeWidth.value = barWidth * vectorTime / (cubeTime + vectorTime);
};

const calculateRateCycles = () => {
  vectorRateCycle.value = pmuTotal.value.vec_busy_cycles || pmuTotal.value.pmu_idc_aic_vec_busy_o || '/';
  cubeRateCycle.value = pmuTotal.value.cube_busy_cycles || pmuTotal.value.cube_instr_busy || '/';
  scalarRateCycle.value = pmuTotal.value.scalar_busy_cycles || pmuTotal.value.scalar_instr_busy || '/';
  mte1RateCycle.value = pmuTotal.value.mte1_busy_cycles || pmuTotal.value.mte1_instr_busy || '/';
  mte2RateCycle.value = pmuTotal.value.mte2_busy_cycles || pmuTotal.value.mte2_instr_busy || '/';
  mte3RateCycle.value = pmuTotal.value.mte3_busy_cycles || pmuTotal.value.mte3_instr_busy || '/';
};

const calculateRatePercentages = () => {
  vectorRatePercentage.value = Math.round(pmuTotal.value.vec_ratio * 100);
  cubeRatePercentage.value = Math.round(pmuTotal.value.cube_ratio * 100);
  scalarRatePercentage.value = Math.round(pmuTotal.value.scalar_ratio * 100);
  mte1RatePercentage.value = Math.round(pmuTotal.value.mte1_ratio * 100);
  mte2RatePercentage.value = Math.round(pmuTotal.value.mte2_ratio * 100);
  mte3RatePercentage.value = Math.round(pmuTotal.value.mte3_ratio * 100);
};

const calculateRateWidth = () => {
  const barWidth = 406;
  vectorRateWidth.value = pmuTotal.value.vec_ratio * barWidth;
  cubeRateWidth.value = pmuTotal.value.cube_ratio * barWidth;
  scalarRateWidth.value = pmuTotal.value.scalar_ratio * barWidth;
  mte1RateWidth.value = pmuTotal.value.mte1_ratio * barWidth;
  mte2RateWidth.value = pmuTotal.value.mte2_ratio * barWidth;
  mte3RateWidth.value = pmuTotal.value.mte3_ratio * barWidth;
};

const setPmuConfigurations = () => {
  pmuRowCoordLoc.value = ['0%', '18%', '36%', '54%', '72%', '88%'];
  pmuBackLineLoc.value = ['20%', '40%', '60%', '80%'];
  pmuRowCoordList.value = ['0%', '20%', '40%', '60%', '80%', '100%'];
  pmuColCoordList.value = ['Vector Cycles', 'Cube Cycles', 'Scalar Cycles', 'MTE1 Cycles', 
                            'MTE2 Cycles', 'MTE3 Cycles', 'FixP Cycles'];
  pmuBarColorList.value = ['rgba(246, 158, 57, 1)', 'rgba(135, 200, 89, 1)', 'rgba(54, 193, 141, 1)', 
                            'rgba(85, 204, 217, 1)', 'rgba(102, 140, 247, 1)', 'rgba(46, 134, 222, 1)', 'rgba(142, 129, 244, 1)'];
};

const setPmuChartData = () => {
  pmuChartDataLeft.value = [vectorRateCycle.value, cubeRateCycle.value, scalarRateCycle.value,
                            mte1RateCycle.value, mte2RateCycle.value, mte3RateCycle.value, pmuTotal.value.pmu_fix_instr_busy || '/'];
  const totalCycle = Number(pmuTotal.value['total cycle'] || 1);
  const fixInstrBusy = Number(pmuTotal.value.pmu_fix_instr_busy || 0);
  pmuChartDataRight.value = [vectorRatePercentage.value, cubeRatePercentage.value, scalarRatePercentage.value,
                              mte1RatePercentage.value, mte2RatePercentage.value, mte3RatePercentage.value, Math.round(fixInstrBusy / totalCycle * 100)];
};

const calculatePmuMetrics = () => {
  calculateCacheHitRate();
  calculateTimeMetrics();
  calculateRateCycles();
  calculateRatePercentages();
  calculateRateWidth();
  setPmuConfigurations();
  setPmuChartData();
  iniComplete.value = true;
};

const initializePerformance = () => {
  calculateStatistics();
  
  isCfgEditing.value = false;
  isShortcutKeyShow.value = false;

  const mod = tsScale.value;

  if (Number.isInteger(viewState.timeRange)) {
    taskTime.value = parseFloat((viewState.timeRange / mod).toFixed(3));
  } else {
    taskTime.value = (viewState.timeRange / mod).toFixed(2);
  }
  taskOnBoardTime.value = parseFloat(getTaskOnBoardTime().toFixed(3));
  if (isAicpu.value) {
    aicoreTime.value = '/';
    aicoreRate.value = '/';
  } else {
    calculateAicoreInfo();
  }
  
  if (!isPmuDataVaild()) {
    initializePmuDefaults();
    return;
  }

  calculatePmuMetrics();
};

const getTaskOnBoardTime = () => {
  let minStart = Infinity;
  let maxEnd = 0;
  const mod = tsScale.value;
  for (const [, process] of processes.entries()) {
    const isValidType = ['kernel', '', undefined].includes(process.type);
    const isNotExcludedPerfSwim = process.type === 'PerfSwim' && process.processName === 'AICore View';
    if (isValidType || isNotExcludedPerfSwim) {
      for (const [, thread] of process.threads.entries()) {
        if (thread.isCounter || thread.threadName.includes('Fake Core') || (isMsProf.value && thread?.parentThreadName === undefined)) {
          continue;
        }
        const { events } = thread;
        if (!events || events.length === 0) {
          continue;
        }
        const [firstEvent] = events;
        const lastEvent = events[events.length - 1];
        if (firstEvent.startTime < minStart) {
          minStart = firstEvent.startTime;
        }
        if (lastEvent.endTime > maxEnd) {
          maxEnd = lastEvent.endTime;
        }
      }
    }
  }
  return (maxEnd - minStart) / mod;
};
const handleClickOutside = (e) => {
  if (isPathLockStatus.value) {
    return;
  }
  const composedPath = e.composedPath();
  const index = composedPath.findIndex(
    (item) =>
      item.classList?.contains('time-consuming-task') ||
      item.classList?.contains('max-scheduling-gap-item-task')||
      item.classList?.contains('pmu-insight-clickable') ||
      item.classList?.contains('pmu-group-button') ||
      item.classList?.contains('pmu-full-data-button') ||
      item.classList?.contains('pmu-b-copy-button') ||
      item.classList?.contains('time-range-marker') || 
      item.classList?.contains('time-statistics-table') ||
      item.classList?.contains('event-container') ||
      ['tab1', 'tab2', 'tab3'].includes(item.id)
  );
  if (index !== -1) {
    return;
  }
  canvasStatusReset();
};
onMounted(() => {
  initializePerformance();
  document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  clearExecutionTimeData();
});
const clearExecutionTimeData = () => {
  executionTimeData.echartsMap.clear();
  executionTimeData.tableData.length = 0;
  executionTimeData.ticksMap.clear();
  executionTimeData.timelineGroupsMap.clear();
};
// 提供方法给子组件
provide('swimGraphPmuBarMethod', {
  clickTask
});
</script>

<style lang="scss" scoped>
.pmu-report {
  padding: 20px;
  position: fixed;
  background: var(--devui-card-bg);
  top:0;
  bottom:0;
  right:0;
  z-index: 100;
}

.summary-container {
  overflow-y: auto; 
  height:calc(100vh - 110px);
}

.close-container {
  width: 16px;
  height: 16px;
  position: absolute;
  right: 20px;
  top: 20px;
}

.report-title {
  height: 26px;
  font-size: 18px;
  line-height: 18px;
  font-weight: 700;
  text-align: left;

}

.scheduling-gap-container-perform {
  margin-top: 12px;
  width: 440px;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;
  border-radius: 8px;
  background: var(--devui-category-search-bg);
  border: 1px solid var(--devui-category-search-bg);
}

.left-scheduling-gap-container {
  width: 109px;
  height: 58px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.right-scheduling-gap-container {
  display: flex;
  flex-direction: column;
  width: 268px;
  gap: 6px;
}

.scheduling-gap-title {
  height: 18px;
  display: flex;
  justify-content: space-between;
}

.scheduling-gap-title-item {
  font-size: 12px;
  color: rgba(153, 153, 153, 1);
}

.max-scheduling-gap {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
}

.max-scheduling-gap-item {
  height: 36px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.max-scheduling-gap-item-task {
  max-width: 48px;
  height: 16px;
  padding: 0px 4px 0px 4px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--base-bg-color);
  cursor: pointer;
}

.max-scheduling-gap-item-task:hover {
  background: var(--hover-bg-color);
}

.disabled {
  cursor: not-allowed !important;
  opacity: 0.5;
  pointer-events: none;
  user-select: none;
}

.max-scheduling-gap-item-task-text {
  text-overflow: ellipsis;
  white-space: nowrap; 
  overflow: hidden; 
  font-size: 12px;
  justify-content: center;
}

.max-scheduling-gap-item-task-text:hover {
  color: black;
}

.max-scheduling-gap-item-middle-container {
  align-self: flex-start;
  height: 19px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.max-scheduling-gap-item-time {
  height: 16px;
  color: rgba(153, 153, 153, 1);
  text-align: center;
}

.max-scheduling-gap-item-line {
  width: 173.5px;
  height: 1px;
  background: linear-gradient(
    to right,
    var(--left-color, #ccc),
    var(--right-color, #ccc)
  );
}

.time-task-item-container {
  width: 109px;
  height: 58px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 8px;
}

.split-line {
  margin-top: 3px;
  width: 0px;
  border: 1px solid var(--devui-node-edge-active);
}

.time-consuming-container-perform {
  margin-top: 12px;
  width: 440px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;
  border: 1px solid var(--devui-category-search-bg);
  border-radius: 8px;
  background: var(--devui-category-search-bg);
}

.task-statistic-item {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.time-consuming-split-line {
  margin-top: 24px;
  width: 0px;
  border: 1px solid var(--devui-node-edge-active);
}

.time-consuming-tasks-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.time-consuming-task {
  width: 236px;
  height: 16px;
  line-height: 16px;
  justify-content: flex-start;
  padding: 0px 4px 0px 4px;
  text-align: center;
  font-size: 12px;
  border-radius: 4px;
  background: var(--base-bg-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.time-consuming-task:hover {
  background: var(--hover-bg-color);
  color: black;
}
.top-row-group {
  display: flex;
  flex-direction: row;
}
.mt10 {
  margin-top: 10px;
}
.task-container {
  margin-top: 12px;
  width: 440px;
  height: 176px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  background: var(--devui-category-search-bg);
}

.task-item-container {
  width: 196px;
  height: 58px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 8px;
  margin-right: 6px;
}

.task-title {
  height: 18px;
  color: rgba(153, 153, 153, 1);
  font-size: 12px;
  font-weight: 400;
  gap: 1px;
  display: flex;
  flex-direction: row;
  white-space: nowrap;
}

.task-title-container {
  height: 18px;
  color: rgba(153, 153, 153, 1);
  font-size: 12px;
  font-weight: 400;
  gap: 1px;
  display: flex;
  flex-direction: row;
}

.aicore-e2e-time .task-title-container {
  overflow: hidden;
  max-width: 100%;
}

.aicore-e2e-time .task-title-container .task-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
  display: block;
}

.aicore-e2e-time .task-title-container d-icon {
  flex-shrink: 0;
}

.task-data {
  height: 32px;
  font-size: 24px;
  font-weight: 500;
}

.aicore-container {
  margin-top: 16px;
  width: 440px;
  height: 192px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 8px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  background: var(--devui-category-search-bg);
  padding: 16px;
}

.aicore-container-column {
  display: flex;
  flex-direction: row;
  gap: 8px; 
}

.cube-rate-cycle {
  height: 20px;
  color: var(--cube-rate-cycle-text);
  font-size: 18px;
  font-weight: 700;
  line-height: 20px;
}

.vec-rate-cycle {
  height: 20px;
  color: var(--vec-rate-cycle-text);
  font-size: 18px;
  font-weight: 700;
  line-height: 20px;
}

.cube-data-chart {
  position: relative;
  height: 24px;
  width: 410px;
  gap: 2px;
  display: flex;
  flex-direction: row;
}

.cube-time-bar {
  position: relative;
  height: 24px;
  border-radius: 4px;
  background: var(--cube-rate-cycle-bg);
  border: 1px solid var(--cube-rate-cycle-bg);
}

.vector-time-bar {
  position: relative;
  height: 24px;
  border-radius: 4px;
  background: var(--vec-rate-cycle-bg);
  border: 1px solid var(--vec-rate-cycle-bg);
  display: flex;
  flex-direction: row-reverse;
}

.cube-time-num {
  position: absolute;
  width: 100%;
  height: 12px;
  font-size: 12px;
  top: 3px;
  text-align: center;
  bottom: 6px;
  z-index: 1;
  color: var(--devui-primary-text);
}

.vector-time-num {
  position: absolute;
  width: 100%;
  height: 12px;
  font-size: 12px;
  top: 3px;
  text-align: center;
  bottom: 6px;
  z-index: 1;
  color: var(--devui-primary-text);
}

.time-statistics-tab-content {
  height: calc(100vh - 110px);
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
  }
}
</style>