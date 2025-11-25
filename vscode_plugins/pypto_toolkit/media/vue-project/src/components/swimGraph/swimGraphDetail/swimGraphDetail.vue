<template>
  <div>
    <!-- 核间数据概览 -->
    <div class="details-cores" :class="{ expanded: detailsCoresExpanded }">
      <span>{{ $t("inter-CorePerformanceOverview") }}</span>
    </div>

    <div class="details-panel" :class="{ expanded: detailsPanelExpanded }">
      <div class="details-content" ref="detailsContent">
        <div class="details-title" v-if="!selectedEvent">{{ $t("nodeDetailsView") }}</div>
        <template v-else>
          <div class="detail-content">
              <div class="content-one-pipe">
                <div class="pipe-content-title">
                  <div class="pipe-title">
                    <img class="picture" :src="tPath" alt="picture">
                  </div>
                  <div class="pipe-name">
                    <d-tooltip :content="getEventDisplayName(selectedEvent)">
                      <div>{{ getEventTruncateText(selectedEvent) }}</div>
                    </d-tooltip>
                    <div class="pipe-subgraph">
                      <span :style="{...dynamicWidthStyle(selectedEvent), width:'auto'}">Subgraphid: {{ getSubGraphId(selectedEvent, 'subGraph') }}</span>
                    </div>
                  </div>
                </div>
                <div class="pipe-content-stat">
                  <div class="pipe-start">
                    <span class="pipe-start-up">
                      <span>Start</span><span class="ml5">({{ startTimeUnitInfo }})</span>
                      <span class="arrow-right-top"><d-icon name="icon-arrow-right-l" class="right-button"></d-icon></span>
                      <span>Duration</span><span class="ml5">({{ durationUnitInfo }})</span>
                    </span>
                    <span class="pipe-start-down">
                      <span class="start-value-key">{{ startTimeInfo }}</span>
                      <span class="arrow-right"><d-icon name="icon-arrow-right-l" class="right-button"></d-icon></span>
                      <span class="start-value-key">{{ durationInfo }}</span>
                    </span>
                  </div>
                  <div class="pipe-line"></div>
                  <div class="pipe-hit">
                    <span>{{ $t('hitRate')}}</span>
                    <span class="start-value-key">{{ getEventCacheHit(selectedEvent)}}</span>
                  </div>
                </div>
              </div>
            <div class="detail-main-container">
            <div class="content-args">
              <div class="content-args-head">
                <div class="main-text">
                  <d-tabs v-model="selectedView" class="argsTabs" show-content="false" @active-tab-change="selectView">
                    <d-tab id="args" :title="$t('args')"></d-tab>
                    <d-tab id="pipeStat" :title="$t('pipeStat')"></d-tab>
                  </d-tabs>
                </div>
                <div class="bindbox">
                  <d-tooltip position="bottom" :content=bindToolTip>
                    <d-button variant="text" color="secondary" v-show="bindFile" @click="openBoundComGraph" class="jump-to-file"><strong class="icon-details"></strong></d-button>
                  </d-tooltip>
                  <d-button v-if="selectedView === 'args'" variant="text" color="primary" @click="bindFilePath">{{ bindButton }}</d-button>
                </div>
              </div>
              <div class="content-two" v-if="selectedView === 'args'">
                <template v-if="selectedEvent.isCounter">
                  <strong>{{ $t("countValue") }}</strong> {{ selectedEvent.counterSize }}<br>
                  <strong>{{ $t("type") }}</strong> {{ $t("counterEvent") }}<br>
                </template>
                <template v-else>
                  <div class="argstime">
                    <span class="third-text">duration</span>
                    <span class="main-text">{{ selectedEvent.duration }}</span>
                  </div>
                  <div class="argstime">
                    <span class="third-text">end_time</span>
                    <span class="main-text">{{ selectedEvent.endTime - viewState.minTime }}</span>
                  </div>
                  <div style="display: none;">
                    <span>last_pred</span>
                    <span>17</span>
                  </div>
                  <div style="display: none;">
                    <span>ready_time</span>
                    <span>3640</span>
                  </div>
                  <div class="argstime">
                    <span class="third-text">start_time</span>
                    <span class="main-text">{{ selectedEvent.startTime - viewState.minTime }}</span>
                  </div>
                  <div style="display: none;">
                    <span>subgraph_average</span>
                    <span>569</span>
                  </div>
                  <div style="display: none;">
                    <span>subgraph_max</span>
                    <span>569</span>
                  </div>
                  <div style="display: none;">
                    <span>subgraph_min</span>
                    <span>569</span>
                  </div>
                  <div v-for="(value, key) in selectedEvent.args" :key="key" :id="key" class="args-item">
                    <d-tooltip :content="key" v-if="value !== ''">
                      <span class="args-key third-text">{{ key }}</span>
                    </d-tooltip>
                    <span v-if="value !== '' && key === 'ioperand-hint' ">
                      <template v-if="value.includes('rawmagic')">
                        <span class="args-value main-text" v-html="ioperandHtml"></span>
                      </template>
                      <span v-else class="args-value main-text"> {{ value }} </span>
                    </span>

                    <span v-if="value !== '' && key === 'ooperand-hint' ">
                      <template v-if="value.includes('rawmagic')">
                        <span class="args-value main-text" v-html="ooperandHtml"></span>
                      </template>
                      <span v-else class="args-value main-text"> {{ value }} </span>
                    </span>

                    <span v-if="value !== '' && key !== 'event-hint' && key !== 'ioperand-hint' && key !== 'ooperand-hint' ">
                      <span class="args-value main-text">{{ value }}</span>
                    </span>

                    <span class="args-button" v-if="typeof(value) === 'string' && (value.includes('rootHash') || value.includes('leafHash'))">
                      <span v-for="(item, key) in splitValue(value)">
                        <span v-if="item[0]=='rootHash' || item[0]=='leafHash'" class="main-text">
                          {{ item[0] }}:<span class="event-hint-hash" @click="jumpToComGraph(item[1])">{{ item[1] }}</span>.
                        </span>
                        <span v-else class="main-text">
                          {{ item[0] }}:{{ item[1] }},
                        </span>
                      </span>
                    </span>

                  </div>
                </template>
              </div>
              <template v-else>
                <div class="pipe-bar-chart" v-if="selectedEvent.pmu_info">
                  <div class="row-coord" :class="{'row-coord-active': selectedView === 'pipeStat'}">
                    <div class="row-coord-num" 
                      v-for="(coordIt, index) in rowCoordList" 
                      :key="index"
                      :style="{ left: rowCoordLoc[index]}">
                      {{rowCoordList[index]}}
                    </div>
                  </div>
                  <div class="occupy-rate-chart-container" :class="{'chart-container-active': selectedView === 'pipeStat'}" ref="barChartContainerDiv">
                    <div class="occupy-rate-chart-col-coord-container" ref="colCoordContainerDiv">
                      <div class="occupy-rate-chart-col-coord" 
                        v-for="(colCoordIt, index) in colCoordList"
                        :key="index">
                        {{colCoordIt}}
                      </div>
                    </div>
                    <div class="occupy-rate-bar-container"
                      :style="{ height: rowCoordList.length * 36 + 4 + 'px'}">
                      <div class="occupy-rate-bar-line"
                        v-for="(lineLoc, index) in backLineLoc"
                        :key="index"
                        :style="{ left: lineLoc}"> 
                      </div>

                      <div class="occupy-rate-backbar"
                        v-for="(dataLeft, index) in chartDataLeft"
                        :key="index"
                        :style="{ top: 8 + 36 * index + 'px'}">
                        <div class="occupy-rate-bar" 
                          :style="{ width: barWidthList[index] + 'px', background: pmuBarColorList[index]}"></div>
                        <div class="occupy-rate-cycle">{{ dataLeft }}</div>
                        <div class="occupy-rate-percentage">{{ chartDataRight[index] }}%</div>
                      </div>
                    </div>
                  </div>
                </div>
                <template v-else>
                  <div class="noPmu"> {{ $t('noPmu')}} </div>
                </template>
              </template>
            </div>
            <div id="canvas-container">
              <div class="mr10">
                <div class="relevent">Relevent</div>
                <div class="display-containner">
                  <div class="button-group">
                    <button @click="releventShowPre" :class="{'relevent-highlight': (releventDisplay == DEP_MODE.pre)}"><img class="left" :src="lPath" alt="left"/></button>
                    <button @click="releventShowAll" :class="{'relevent-highlight': (releventDisplay == DEP_MODE.all)}"><img class="all" :src="aPath" alt="all"/></button>
                    <button @click="releventShowNext" :class="{'relevent-highlight': (releventDisplay == DEP_MODE.next)}"><img class="right" :src="rPath" alt="right"/></button> 
                  </div>
                  <div class="detail-level display-containner">
                    <div class="input-number-border" :style="{width: inputNumberWidth + 'px'}" :class="{ 'focusable': isFocused}" tabindex="0" @focus="handleFocus" @blur="handleBlur">{{$t('taskConnectionLevel') + ':'}}</div>
                    <d-input-number class="input-number-container" ref="inputNumberRef"  v-model="connectionLevel" :step="1" :precision="0" :min="-1" @change="onInputChange" @focus="onInputFocus" @blur="onInputBlur"></d-input-number> 
                    <d-tooltip :content="$t('connectionLevel')">
                      <d-icon name="icon-helping" class="help-font"></d-icon>
                    </d-tooltip>
                  </div>
                </div>
                  <div class="swim-graph-icon">
                    <div><span class="icon-span-i secondary-text">Incoming</span><d-badge class="swimGraphBadge" status="common" :count="predecessors.length"></d-badge></div>
                    <div><span class="icon-span-c secondary-text">Current</span></div>
                    <div><span class="icon-span-o secondary-text">Outgoing</span><d-badge class="swimGraphBadge" status="common" :count="successors.length"></d-badge></div>
                  </div>
                  <canvas id="dependency-canvas"></canvas>
              </div>
            </div>
            </div>
            <div class="close-button">
                <d-button icon="icon-close" style="width: 16px; font-size: 16px; border: none; background-color: transparent" @click="toggleDetailsPanel()"></d-button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch, nextTick, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import { clone } from 'lodash-es';
import { formatTimeWithUnit, COLOR_CFG, DEP_MODE } from '../swimGraphUtils';
import { getSubGraphId } from '../swimGraphProcesses/processInfo';
import { useViewServer } from '../../../core/use-view-server';

const { server } = useViewServer();
const { t: $t } = useI18n();
const useDynamicWidth = ref(true);
const detailsContent = ref(null);
const bindToolTip = ref($t("openComputationalGraphJsonFile"));
const ioperandHtml = ref('');
const ooperandHtml = ref('');
const releventDisplay = ref(DEP_MODE.all);
// 注入父组件提供的状态和方法
const {
  selectedEvent,
  viewState,
  processedEvents,
  detailsPanelExpanded,
  detailsCoresExpanded,
  childContextMap,
  bindFile,
  bindButton,
  isDarkTheme,
  highlightedPaths,
} = inject('swimGraphState');

const {
  showDependencies,
  toggleDetailsPanel,
  renderDependencyLines,
  postMessage,
  selectEvent,
} = inject('swimGraphMethods');
const { userConfig } = inject('swimGraphCfg');
const connectionLevel = computed({
  get: () => userConfig.get('connectionLevel') ?? -1,
  set: (value) => {
    userConfig.set('connectionLevel', value);
  }
});
let startTimeInfo = ref('0');
let startTimeInfoAll = ref('');
let startTimeUnitInfo = ref('us');
let durationInfo = ref('0');
let durationInfoAll = ref('');
let durationUnitInfo = ref('us');
let isFocused = ref(false);
const inputNumberWidth = ref(window.ascLang === 'zh' ? 108 : 160);
const inputNumberRef = ref(null);
const rowCoordLoc = ref(['0%', '18%', '36%', '54%', '72%', '88%']);
const backLineLoc = ref(['20%', '40%', '60%', '80%']);
const rowCoordList = ref(['0%', '20%', '40%', '60%', '80%', '100%']);
const colCoordList = ref(['Vector Cycles', 'Cube Cycles', 'Scalar Cycles', 'MTE1 Cycles', 
                            'MTE2 Cycles', 'MTE3 Cycles']);
const pmuBarColorList = ref([]);
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
if (isDarkTheme.value) {
  pmuBarColorList.value = ['rgba(135, 52, 0, 1)', 'rgba(181, 78, 4, 1)', 'rgba(3, 97, 66, 1)', 
                          'rgba(70, 94, 184, 1)', 'rgba(158, 63, 0, 1)', 'rgba(72, 142, 32, 1)'];
} else {
  pmuBarColorList.value = ['rgba(255, 200, 201, 1)', 'rgba(255, 201, 138, 1)', 'rgba(0, 238, 237, 1)', 
                          'rgba(171, 217, 255, 1)', 'rgba(231, 216, 0, 1)', 'rgba(0, 242, 186, 1)'];
}

const barWidthList = ref([]);
const chartDataLeft = ref([]);
const chartDataRight = ref([]);

const selectedView = ref('args');
const selectView = (view) => {
  selectedView.value = view;
};
const getEventCacheHit = (event) => {
  if (event.pmu_calc_info) {
    let hitRate = event.pmu_calc_info.icache_hit * 100;
    return hitRate === 100 ? '100%' : hitRate.toFixed(2) + '%';
  }
  if (event.pmu_info) {
    let hitRate = event.pmu_info.icache_hit * 100;
    return hitRate === 100 ? '100%' : hitRate.toFixed(2) + '%';
  }
  return '/';
};

const updateEventPmu = (event) => {
  if (event.pmu_info) {
    let pmuData = event.pmu_info;
    let pmucalcData = event.pmu_calc_info ? event.pmu_calc_info : pmuData;
    vectorRateCycle.value = pmuData.vec_busy_cycles;
    cubeRateCycle.value = pmuData.cube_busy_cycles;
    scalarRateCycle.value = pmuData.scalar_busy_cycles;
    mte1RateCycle.value = pmuData.mte1_busy_cycles;
    mte2RateCycle.value = pmuData.mte2_busy_cycles;
    mte3RateCycle.value = pmuData.mte3_busy_cycles;

    vectorRatePercentage.value = Math.round(pmucalcData.vec_ratio * 100);
    cubeRatePercentage.value = Math.round(pmucalcData.cube_ratio * 100);
    scalarRatePercentage.value = Math.round(pmucalcData.scalar_ratio * 100);
    mte1RatePercentage.value = Math.round(pmucalcData.mte1_ratio * 100);
    mte2RatePercentage.value = Math.round(pmucalcData.mte2_ratio * 100);
    mte3RatePercentage.value = Math.round(pmucalcData.mte3_ratio * 100);

    chartDataLeft.value = [vectorRateCycle.value, cubeRateCycle.value, scalarRateCycle.value,
                            mte1RateCycle.value, mte2RateCycle.value, mte3RateCycle.value];
    chartDataRight.value = [vectorRatePercentage.value, cubeRatePercentage.value, scalarRatePercentage.value,
                              mte1RatePercentage.value, mte2RatePercentage.value, mte3RatePercentage.value];
    const barChartContainerDivWidth = 340;
    barWidthList.value = [];
    for (const percent of chartDataRight.value) {
      barWidthList.value.push(barChartContainerDivWidth * percent / 100);
    }
  }
};

const dynamicWidthStyle = (event) => {
  if(!useDynamicWidth) return {};
  const eventName = getEventTruncateText(event);
  const width = eventName.length * 7 + 4 + 'px';
  const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  let fillColor = eventColor ? eventColor.base : 'rgba(10, 89, 247, 0.3)';
  const fontColor = colorCfg.eventFont;
  return {width, background:fillColor, color: fontColor};
}

function bindFilePath() {
  if (bindFile.value) {
    return server.unbindComGraph();
  }
  return server.bindComGraphJson();
}

function openBoundComGraph() {
  server.openBoundComGraph();
}

function jumpToComGraph(value) {
  server.jumpToComGraph({paramObj: { hash: value }});
}

function splitValue(value) {
  const splitString = value.split(", ");
  const splitMap = new Map(splitString.map(pair => {
    const [key, value] = pair.split(':');
    return [key, value];
  }));

  return splitMap;
}

function releventShowPre() {
  releventDisplay.value = DEP_MODE.pre;
  viewState.depMode = releventDisplay.value;
  renderDependencyLines();
}
function releventShowAll() {
  releventDisplay.value = DEP_MODE.all;
  viewState.depMode = releventDisplay.value;
  renderDependencyLines();
}
function releventShowNext() {
  releventDisplay.value = DEP_MODE.next;
  viewState.depMode = releventDisplay.value;
  renderDependencyLines();
}
let tPath = isDarkTheme.value ? ref(`${window.staticPath}/static-assets/circle.svg`) : ref(`${window.staticPath}/static-assets/circle_light.svg`);
const lPath = ref(`${window.staticPath}/static-assets/swim_left.svg`);
let aPath = isDarkTheme.value ? ref(`${window.staticPath}/static-assets/swim_all.svg`) : ref(`${window.staticPath}/static-assets/swim_all_light.svg`);
const rPath = ref(`${window.staticPath}/static-assets/swim_right.svg`);

const predecessors = computed(() => {
  if (!selectedEvent.value) return [];
  return selectedEvent.value.dependencies.predecessors.map(id =>
    processedEvents.value.find(e => e.id === id)
  ).filter(e => e);
});

const successors = computed(() => {
  if (!selectedEvent.value) return [];
  return selectedEvent.value.dependencies.successors.map(id =>
    processedEvents.value.find(e => e.id === id)
  ).filter(e => e);
});

const getEventDisplayName = (event) => {
  return event.isCounter ? event.displayName : (event.name || 'Event');
};
const getEventTruncateText = (event) => {
  const eventName = getEventDisplayName(event);
  const maxLength = 22;
  let truncatedText = eventName.length > maxLength 
                ? eventName.substring(0, maxLength) + '...' 
                : eventName;
  return truncatedText;
};
window.jumpRawMagic = (value, hintValue) => {
  server.jumpRawMagic({paramObj: { rawmagic: value, ascendHint: hintValue}});
}

const createHint = (event, operate) => {
  if (!event.args) {
    return;
  }
  let value = event.args[operate];
  let eventhint = event.args['event-hint'];
  const regex = /'rawmagic':\s*(\d+)/g;
  let matches;
  let result = value;
  while((matches = regex.exec(value)) !== null) {
    const rawmagicValue = matches[1];
    const spanvalue = `<span class="event-hint-hash" onclick="jumpRawMagic('${rawmagicValue}', '${eventhint}')">${rawmagicValue}</span>`;
    result = result.replace(matches[0], `'rawmagic': ${spanvalue}`);
  }
  if(operate === 'ioperand-hint') {
    ioperandHtml.value = result;
  } else {
    ooperandHtml.value = result;
  }
}

// 监听选中事件变化，更新依赖图
watch(selectedEvent, (newEvent) => {
  if (newEvent) {
    startTimeInfo.value = formatTimeWithUnit(selectedEvent.value.startTime - viewState.minTime).value;
    startTimeUnitInfo.value = formatTimeWithUnit(selectedEvent.value.startTime - viewState.minTime).unit;
    startTimeInfoAll.value = startTimeInfo.value + startTimeUnitInfo.value;
    durationInfo.value = formatTimeWithUnit(selectedEvent.value.duration).value;
    durationUnitInfo.value = formatTimeWithUnit(selectedEvent.value.duration).unit;
    durationInfoAll.value = durationInfo.value + durationUnitInfo.value;
    nextTick(() => {
      createHint(newEvent, 'ioperand-hint');
      createHint(newEvent, 'ooperand-hint');
      showDependencies(newEvent, "both");
      updateEventPmu(newEvent);
      getEventCacheHit(newEvent);
    });
  }
});
watch(isDarkTheme, () => {
  updateTheme();
});
const updateTheme = () => {
  tPath.value =  isDarkTheme.value ?`${window.staticPath}/static-assets/circle.svg`: `${window.staticPath}/static-assets/circle_light.svg`;
  aPath.value = isDarkTheme.value ? `${window.staticPath}/static-assets/swim_all.svg` : `${window.staticPath}/static-assets/swim_all_light.svg`;
  if (isDarkTheme.value) {
    pmuBarColorList.value = ['rgba(135, 52, 0, 1)', 'rgba(181, 78, 4, 1)', 'rgba(3, 97, 66, 1)', 
                            'rgba(70, 94, 184, 1)', 'rgba(158, 63, 0, 1)', 'rgba(72, 142, 32, 1)'];
  } else {
    pmuBarColorList.value = ['rgba(255, 200, 201, 1)', 'rgba(255, 201, 138, 1)', 'rgba(0, 238, 237, 1)', 
                            'rgba(171, 217, 255, 1)', 'rgba(231, 216, 0, 1)', 'rgba(0, 242, 186, 1)'];
  }
}
const onInputChange = (newValue, oldValue) => {
  userConfig.value.connectionLevel = newValue;
  const selectedEventTemp = clone(selectedEvent);
  highlightedPaths.clear();
  const processKey = String(selectedEventTemp.value.pid);
  selectEvent(null, processKey);
  selectEvent(selectedEventTemp.value, processKey);
  changeUserCfgConnection(newValue);
}
function changeUserCfgConnection(connectionLevelInfo) {
    server.changeUserCfgConnection({paramObj: {level: connectionLevelInfo}});
};
const onInputFocus = (event) => {
  isFocused.value = true;
};
const onInputBlur = (event) => {
  isFocused.value = false;
};
const handleFocus = (event) => {
  if (inputNumberRef.value && inputNumberRef.value.focus) {
    inputNumberRef.value.focus();
  }
};
const handleBlur = (event) => {
  if (inputNumberRef.value && inputNumberRef.value.blur) {
    inputNumberRef.value.blur();
  }
};
// 暴露方法给父组件
defineExpose({
  connectionLevel
});
</script>

<style scoped lang="scss">
@import url("../css/swimGraph/Detail/detail.css");
:deep() {
  .input-number-container {
    margin-left: -6px;

    :deep() {
      .devui-input-number__input-box {
        border-radius: 0 var(--devui-border-radius) var(--devui-border-radius) 0;
        border-left: none !important;
      }

      .devui-input-number__input-box:not(.disabled) {
        box-shadow: none !important;
      }
    }
  }

  .input-number-container.devui-input-number {
    width: 54px;
  }

  .input-number-container.devui-input-number--md {
    height: 28px;
  }

  .input-number-container .devui-input-number__input-box:not(.disabled) {
    border-left: none;
    box-shadow: none !important;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .input-number-container .devui-input-number__control-buttons .control-button.control-dec svg {
    bottom: 0;
  }
  
  .input-number-container .devui-input-number__control-buttons .control-button.control-inc svg {
    top: 0;
  }
  .argsTabs {
    .devui-tabs__nav--tabs li {
      margin-bottom: 0px;
    }
    .devui-tabs__nav--tabs {
      border-bottom: 1px var(--devui-swim-border-color) solid;
    }
    .devui-tabs__nav--tabs li.active a, .devui-tabs__nav--tabs li:hover:not(.disabled) a, .devui-tabs__nav--pills li.active a, .devui-tabs__nav--pills li:hover:not(.disabled) a {
      color: var(--devui-title-text);
    }
    .devui-tabs__nav--tabs li.active:after, .devui-tabs__nav--pills li.active:after {
      background: var(--devui-slider-bar);
    }
    .devui-tab__content {
      margin-top: 0;
      padding: 0;
    }
  }
}
</style>
<style>
.event-hint-hash {
  color: #526ECC !important;
  margin: 0 2px 0 2px !important;
}

.event-hint-hash:hover{
  color: #344899 !important;
  cursor: pointer !important;
}
</style>
