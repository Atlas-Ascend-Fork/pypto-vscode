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
              <div class="task-title">{{maxSchedulingGap}}(μs)</div>
              <div class="task-data" v-if="maxGap.length > 0">{{maxGap[0].gap / 1000}}</div>
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
                  <div class="max-scheduling-gap-item-task" @click="showMaxSchedule(item)"
                  :style="{
                    '--base-bg-color': getBaseColor(item.parent),
                    '--hover-bg-color': getLightColor(item.parent)
                  }">
                    <div class="max-scheduling-gap-item-task-text">{{item.parent.name}}</div>
                  </div>
                </d-tooltip>
                <div class="max-scheduling-gap-item-middle-container">
                  <div class="max-scheduling-gap-item-time">{{SchedulingGap}}{{item.gap / 1000}} μs</div>
                  <div class="max-scheduling-gap-item-line"
                      :style="{
                      '--left-color': getBaseColor(item.parent),
                      '--right-color': getBaseColor(item.child),
                      width: gapLineWidth + 'px'
                    }"></div>
                </div>
                <d-tooltip :content="item.child.name">
                  <div class="max-scheduling-gap-item-task" @click="showMaxSchedule(item, true)"
                    :style="{
                    '--base-bg-color': getBaseColor(item.child),
                    '--hover-bg-color': getLightColor(item.child)
                  }">
                  <div class="max-scheduling-gap-item-task-text">{{item.child.name}}</div>
                  </div>
                </d-tooltip>
              </div>
            </div>
          </div>
        </div>

        <div class="time-consuming-container-perform"
        :style="{width: subContainerWidth + 'px'}">

          <div class="task-statistic-item">
            <div class="left-scheduling-gap-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="time-task-item-container" :style="{width: innerContainerWidth + 'px'}">
                <div class="task-title">{{TaskMaxDuration}}(μs)</div>
                <div class="task-data">{{maxTimeTaskVal}}</div>
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
                    '--base-bg-color': getBaseColor(item),
                     '--hover-bg-color': getLightColor(item),
                     width: timeConsumingTaskWidth +'px'
                    }"
                    @click="clickTask(item)">{{item.name}}</div>
                </d-tooltip>
              </div>
            </div>
          </div>

          <div class="task-statistic-item">
            <div class="left-scheduling-gap-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="time-task-item-container" :style="{width: innerContainerWidth + 'px'}">
                <div class="task-title">{{TaskMinDuration}}(μs)</div>
                <div class="task-data">{{minTimeTaskVal}}</div>
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
                    '--base-bg-color': getBaseColor(item),
                     '--hover-bg-color': getLightColor(item),
                     width: timeConsumingTaskWidth +'px'
                    }"
                    @click="clickTask(item)">{{item.name}}</div>
                </d-tooltip>
              </div>
            </div>
          </div>

        </div>

        <div class="task-container" :style="{width: subContainerWidth + 'px', gap: aiCoreContainerColumnGap + 'px'}">
          <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
            <div class="task-title">Task Time (μs)</div>
            <div class="task-data">{{ taskTime }}</div>
          </div>
          <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
            <div class="task-title">{{ icacheHitRateTitle }}</div>
            <div class="task-data">{{ icacheHitRate }}</div>
          </div>
        </div>
        <div class="aicore-container" :style="{width: subContainerWidth + 'px'}">
          <div class="aicore-container-column" :style="{gap: aiCoreContainerColumnGap + 'px'}">
            <div class="task-item-container" :style="{width: innerContainerWidth + 'px'}">
              <div class="task-title-container">
                <div class="task-title">AICore Time(μs)</div>
                <d-tooltip :content="$t('AICoreTimeTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="task-data">{{ aicoreTime }}</div>
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
      <d-tab id="tab2" :title="$t('executionTime')">
        <time-statistics/>
      </d-tab>
    </d-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, provide, inject, onMounted, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BigNumber from 'bignumber.js';
import { buildEventMap } from '../swimGraphProcesses/render/utils';
import SwimGraphBarChart from '../swimGraphBarChart/swimGraphBarChart.vue';
import TimeStatistics from './timeStatistics/timeStatistics.vue';
import { executionTimeData } from './utils';
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

const taskTime = ref(0);
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
  pmuTotal
} = inject('swimGraphPmuTotal');

const {
  viewState,
  sliderValue,
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
  isMaxSchedule
} = inject('swimGraphState');

const {
  showDependencies,
  selectEvent,
  findEventAtPosition,
  showMaxScheduleEvent,
  resetMaxScheduleState,
  scrollToEvent,
  canvasStatusReset
} = inject('swimGraphMethods');

provide('swimGraphPmuBarChartInfo', {pmuRowCoordList, pmuColCoordList, pmuRowCoordLoc, pmuBarColorList, pmuChartDataLeft, pmuChartDataRight, reportTitle, pmuBackLineLoc, isDarkTheme});

const schedulingTask = ref($t('schedulingTask'));
const schedulingSubTask = ref($t('schedulingSubTask'));
const maxSchedulingGap = ref($t('maxSchedulingGap'));
const SchedulingGap = ref($t('SchedulingGap'));
const TaskMinDuration = ref($t('TaskMinDuration'));
const TaskMaxDuration = ref($t('TaskMaxDuration'));
const PerformanceSummary = ref($t('PerformanceSummary'));

const clickTask = (event) => {
  if (isMaxSchedule.value) {
    resetMaxScheduleState();
  }
  showDependencies(event, 'both');
  selectEvent(event, String(event.pid));
  scrollToEvent(event);
};

const showMaxSchedule = (item, isChild = false) => {
  showMaxScheduleEvent(item.parent, item.child);
  scrollToEvent(isChild ? item.child : item.parent);
};

const subContainerWidth = ref(440);
const subContainerGap = ref(16);
const innerContainerWidth = ref(109);
const timeConsumingTaskWidth = ref(236);
const cubeDataChartWidth = ref(410);
const aiCoreContainerColumnGap = ref(16);
const rightSchedulingGapContainerWidth =ref(268);
const gapLineWidth = ref(173.5);

SchedulingGap.value = isWideScreen.value? $t('SchedulingGap') : '';
subContainerWidth.value = isWideScreen.value? 440 : 300;
subContainerGap.value = isWideScreen.value? 16 : 8;
innerContainerWidth.value = isWideScreen.value? 109 : 101;
timeConsumingTaskWidth.value = isWideScreen.value? 236 : 123;
cubeDataChartWidth.value = isWideScreen.value? 410 : 270;
cubeTimeWidth.value = isWideScreen.value? 203 : 133;
vectorTimeWidth.value = isWideScreen.value? 203 : 133;
aiCoreContainerColumnGap.value = isWideScreen.value? 120 : 16;
rightSchedulingGapContainerWidth.value = isWideScreen.value? 268: 130;
gapLineWidth.value = isWideScreen.value? 173.5 : 66.5;

const getBaseColor = (event) => {
  if (isDarkTheme.value) {
    return event.color.dark.base;
  } else {
    return event.color.light.base;
  }
};

const getLightColor = (event) => {
  if (isDarkTheme.value) {
    return event.color.dark.light;
  } else {
    return event.color.light.light;
  }
};

const closeStatistics = () => {
  performanceVisible.value = false;
  performanceWidth.value = 0;
};

const buildTaskEventMap = (process) => {
  const eventMap = new Map();
  for (const [, thread] of process.threads) {
    if (thread.isCounter || thread.isFakeCore) {
      continue;
    }
    for (const event of thread.events) {
      eventMap.set(event.id, event);
    }
  }
  return eventMap;
};

const calculateStatistics = () => {
  const processesArray =  Array.from(processes.entries()).map(([key, value]) => {
    return {
      key,
      ...value
    };
  });

  const globalEventMap = {};

  for (const process of processesArray) {
    globalEventMap[process.pid] = buildTaskEventMap(process);
  }
    
  let tMaxGap = -Infinity;
  let tMaxTimeTask = -Infinity;
  let tMinTimeTask = Infinity;
      
  let curMaxGap = [];
  let curMaxTimeTask = [];
  let curMinTimeTask = [];

  const mod = 1000;

  for (const eventMap of Object.values(globalEventMap)) {
    for (const event of eventMap.values()) {
      let taskDur = 0;
      if (event.duration) {
        taskDur = event.duration;
      } else {
        taskDur = event.endTime - event.startTime;
      }
      
      if (taskDur > tMaxTimeTask) {
        tMaxTimeTask = taskDur;
        curMaxTimeTask = [event];
      } else if (taskDur == tMaxTimeTask) {
        curMaxTimeTask.push(event);
      }

      if (taskDur < tMinTimeTask) {
        tMinTimeTask = taskDur;
        curMinTimeTask = [event];
      } else if (taskDur == tMinTimeTask) {
        curMinTimeTask.push(event);
      }

      for (const childId of event.dependencies.successors) {
        const child = eventMap.get(childId);
        if (!child) {
          continue;
        }
        const gap = child.startTime - event.endTime;
        if (gap > tMaxGap) {
          tMaxGap = gap;
          let printGap = 0;
          if (Number.isInteger(gap)) {
            printGap = gap;
          } else {
            printGap = parseFloat(gap.toFixed(3));
          }
          curMaxGap = [{parent: event, child, gap: printGap}];
        } else if (gap == tMaxGap) {
          let printGap = 0;
          if (Number.isInteger(gap)) {
            printGap = gap;
          } else {
            printGap = parseFloat(gap.toFixed(3));
          }
          curMaxGap.push({parent: event, child, gap: printGap});
        }
      }
    }
  }

  tMaxTimeTask = tMaxTimeTask / mod;
  tMinTimeTask = tMinTimeTask / mod;

  maxGap.value = curMaxGap;
  maxTimeTask.value = curMaxTimeTask;
  maxTimeTaskVal.value = Number.isInteger(tMaxTimeTask) ? tMaxTimeTask : parseFloat(tMaxTimeTask.toFixed(3));
  minTimeTask.value = curMinTimeTask;
  minTimeTaskVal.value = Number.isInteger(tMinTimeTask) ? tMinTimeTask : parseFloat(tMinTimeTask.toFixed(3));
};


const calculateAicoreInfo = () => {
  let aicTaskTimeSum = 0;
  let totalCnt = 0;
  for (const [processKey, processVal] of processes) {
    for (const [threadKey, threadVal] of processVal.threads) {
      if (threadVal.isCounter == false) {
        totalCnt = totalCnt + 1;
      }
      if (!threadVal.threadName.toLowerCase().startsWith('aic') && !threadVal.threadName.toLowerCase().startsWith('aiv')) {
        continue;
      }
      for (const event of threadVal.events) {
        aicTaskTimeSum = aicTaskTimeSum + (event.duration ? event.duration : 0);
      }
    }
  }

  aicoreTime.value = parseFloat((aicTaskTimeSum / 1000).toFixed(2));
  const aicoreRateBigNumber = ((new BigNumber(aicTaskTimeSum)).dividedBy(new BigNumber(totalCnt * taskTime.value))).div(new BigNumber('1000'));
  aicoreRate.value = parseFloat((aicoreRateBigNumber * 100).toFixed(2)) + '%';
};

const initializePerformance = () => {
  calculateStatistics();
  
  isCfgEditing.value = false;
  isShortcutKeyShow.value = false;

  if (Number.isInteger(viewState.timeRange)) {
    taskTime.value = viewState.timeRange / 1000;
  } else {
    taskTime.value = (viewState.timeRange / 1000).toFixed(2);
  }

  if (isAicpu.value) {
    aicoreTime.value = '/';
    aicoreRate.value = '/';
  } else {
    calculateAicoreInfo();
  }
  
  if (pmuTotal.value == undefined || Object.keys(pmuTotal.value).length == 0) {
    cubeRateCycle.value = '/';
    vectorRateCycle.value = '/';
    cubeTimePercentage.value = '/';
    vectorTimePercentage.value = '/';
    pmuExist.value = false;
    return;
  }

  const cubeTime = Number(pmuTotal.value.cube_busy_cycles);
  const vectorTime = Number(pmuTotal.value.vec_busy_cycles);

  icacheHitRate.value = String(Math.round(pmuTotal.value.icache_hit * 100)) + '%';

  const barWidth = 406;

  cubeTimePercentage.value = Math.floor(cubeTime / (cubeTime + vectorTime) * 100) + '%';
  vectorTimePercentage.value = String(100 - Math.floor(cubeTime / (cubeTime + vectorTime) * 100)) + '%';
  cubeTimeWidth.value = barWidth * cubeTime / (cubeTime + vectorTime);
  vectorTimeWidth.value = barWidth * vectorTime / (cubeTime + vectorTime);

  vectorRateCycle.value = pmuTotal.value.vec_busy_cycles;
  cubeRateCycle.value = pmuTotal.value.cube_busy_cycles;
  scalarRateCycle.value = pmuTotal.value.scalar_busy_cycles;
  mte1RateCycle.value = pmuTotal.value.mte1_busy_cycles;
  mte2RateCycle.value = pmuTotal.value.mte2_busy_cycles;
  mte3RateCycle.value = pmuTotal.value.mte3_busy_cycles;

  vectorRatePercentage.value = Math.round(pmuTotal.value.vec_ratio * 100);
  cubeRatePercentage.value = Math.round(pmuTotal.value.cube_ratio * 100);
  scalarRatePercentage.value = Math.round(pmuTotal.value.scalar_ratio * 100);
  mte1RatePercentage.value = Math.round(pmuTotal.value.mte1_ratio * 100);
  mte2RatePercentage.value = Math.round(pmuTotal.value.mte2_ratio * 100);
  mte3RatePercentage.value = Math.round(pmuTotal.value.mte3_ratio * 100);

  vectorRateWidth.value = pmuTotal.value.vec_ratio * barWidth;
  cubeRateWidth.value = pmuTotal.value.cube_ratio * barWidth;
  scalarRateWidth.value = pmuTotal.value.scalar_ratio * barWidth;
  mte1RateWidth.value = pmuTotal.value.mte1_ratio * barWidth;
  mte2RateWidth.value = pmuTotal.value.mte2_ratio * barWidth;
  mte3RateWidth.value = pmuTotal.value.mte3_ratio * barWidth;

  pmuRowCoordLoc.value = ['0%', '18%', '36%', '54%', '72%', '88%'];
  pmuBackLineLoc.value = ['20%', '40%', '60%', '80%'];
  pmuRowCoordList.value = ['0%', '20%', '40%', '60%', '80%', '100%'];
  pmuColCoordList.value = ['Vector Cycles', 'Cube Cycles', 'Scalar Cycles', 'MTE1 Cycles', 
                            'MTE2 Cycles', 'MTE3 Cycles'];
  if (isDarkTheme.value) {
    pmuBarColorList.value = ['rgba(135, 52, 0, 1)', 'rgba(181, 78, 4, 1)', 'rgba(3, 97, 66, 1)', 
                            'rgba(70, 94, 184, 1)', 'rgba(158, 63, 0, 1)', 'rgba(72, 142, 32, 1)'];
  } else {
    pmuBarColorList.value = ['rgba(255, 200, 201, 1)', 'rgba(255, 201, 138, 1)', 'rgba(0, 238, 237, 1)', 
                            'rgba(171, 217, 255, 1)', 'rgba(231, 216, 0, 1)', 'rgba(0, 242, 186, 1)'];
  }
  pmuChartDataLeft.value = [vectorRateCycle.value, cubeRateCycle.value, scalarRateCycle.value,
                            mte1RateCycle.value, mte2RateCycle.value, mte3RateCycle.value];
  pmuChartDataRight.value = [vectorRatePercentage.value, cubeRatePercentage.value, scalarRatePercentage.value,
                              mte1RatePercentage.value, mte2RatePercentage.value, mte3RatePercentage.value];
  iniComplete.value = true;
};
const handleClickOutside = (e) => {
  const composedPath = e.composedPath();
  const index = composedPath.findIndex(
    (item) =>
      item.classList?.contains('time-consuming-task') ||
      item.classList?.contains('max-scheduling-gap-item-task')||
      item.classList?.contains('time-range-marker') || 
      item.classList?.contains('time-statistics-table') ||
      item.classList?.contains('event-container')
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
  executionTimeData.ticks.length = 0;
  executionTimeData.timelineGroupsMap.clear();     
};
// 提供方法给子组件
provide('swimGraphPmuBarMethod', {
  clickTask
});
</script>

<style scoped>
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

.task-container {
  margin-top: 12px;
  width: 440px;
  height: 90px;
  display: flex;
  flex-direction: row;
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
  color: rgba(199, 98, 7, 1);
  font-size: 18px;
  font-weight: 700;
  line-height: 20px;
}

.vec-rate-cycle {
  height: 20px;
  color: rgba(72, 142, 32, 1);
  font-size: 18px;
  font-weight: 700;
  line-height: 20px;
}

.cube-data-chart {
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
  background: rgba(199, 98, 7, 1);
}

.vector-time-bar {
  position: relative;
  height: 24px;
  border-radius: 4px;
  background: rgba(72, 142, 32, 1);
  display: flex;
  flex-direction: row-reverse;
}

.cube-time-num {
  position: absolute;
  height: 12px;
  font-size: 12px;
  top: 3px;
  left: 4px;
  bottom: 6px;
  z-index: 1;
  color: white;
}

.vector-time-num {
  position: absolute;
  height: 12px;
  font-size: 12px;
  top: 3px;
  right: 4px;
  bottom: 6px;
  z-index: 1;
  color: white;
}
</style>