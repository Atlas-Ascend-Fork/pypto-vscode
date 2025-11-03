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
            <div class="content-one">
              <div class="content-title">
                <div class="title">
                  <img class="picture" :src="tPath" alt="picture">
                  <div>
                    <div class="Title">Title</div>
                    <d-tooltip :content="getEventDisplayName(selectedEvent)">
                      <div :class="['Title-value', { 'dynamic-width': useDynamicWidth }]"
                        :style="{...dynamicWidthStyle(selectedEvent)}">{{ getEventTruncateText(selectedEvent) }}</div>
                    </d-tooltip>
                  </div>
                </div>
                <div class="cate">
                  <div class="cat">Category</div>
                  <div class="cat-value">{{ selectedEvent.cat }}</div>
                  <div class="ufcat">User Friendly Category</div>
                  <div class="cat-value">{{ selectedEvent.cat }}</div>
                </div>
              </div>
              <div class="content-stat">
                <div class="content-border">
                  <div class="start">Start</div>
                    <d-tooltip :content="startTimeInfoAll" v-if="startTimeInfo.includes('...')">
                      <div class="start-value">
                          <span class="start-value-key">{{ startTimeInfo }}</span>
                          <span class="ml5">{{ startTimeUnitInfo }}</span>
                      </div>
                    </d-tooltip>
                    <div class="start-value" v-else>
                          <span class="start-value-key">{{ startTimeInfo }}</span>
                          <span class="ml5">{{ startTimeUnitInfo }}</span>
                    </div>
                </div>
                <div class="content-border">
                  <div class="duration">Wall Duration</div>
                  <d-tooltip :content="durationInfoAll"  v-if="durationInfo.includes('...')">
                    <div class="start-value">
                      <span class="start-value-key">{{ durationInfo }}</span>
                      <span class="ml5">{{ durationUnitInfo }}</span>
                    </div>
                  </d-tooltip>
                  <div class="start-value" v-else>
                    <span class="start-value-key">{{ durationInfo }}</span>
                    <span class="ml5">{{ durationUnitInfo }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="detail-main-container">
            <div class="content-args">
              <div class="content-args-head">
                <div class="main-text">Args</div>
                <div class="bindbox">
                  <d-tooltip position="bottom" :content=bindToolTip>
                    <d-button variant="text" color="secondary" v-show="bindFile" @click="openBoundComGraph" class="jump-to-file"><strong class="icon-details"></strong></d-button>
                  </d-tooltip>
                  <d-button variant="text" color="primary" @click="bindFilePath">{{ bindButton }}</d-button>
                </div>
              </div>
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
                    <div class="input-number-border" :style="{width: inputNumberWidth + 'px'}" :class="{ 'focusable': isFocused}" tabindex="0" @focus="handleFocus" @blur="handleBlur">{{$t('hierarchy')}}</div>
                    <d-input-number class="input-number-container" ref="inputNumberRef"  v-model="refLabel" :step="1" :precision="0" :min="-1" @change="onInputChange" @focus="onInputFocus" @blur="onInputBlur"></d-input-number> 
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
let startTimeInfo = ref('0');
let startTimeInfoAll = ref('');
let startTimeUnitInfo = ref('us');
let durationInfo = ref('0');
let durationInfoAll = ref('');
let durationUnitInfo = ref('us');
const refLabel = ref(-1);
let isFocused = ref(false);
const inputNumberWidth = ref(window.ascLang === 'zh' ? 50 : 80);
const inputNumberRef = ref(null);
const dynamicWidthStyle = (event) => {
  if(!useDynamicWidth) return {};
  const eventName = getEventTruncateText(event);
  const width = eventName.length * 7 + 4 + 'px';
  const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  let fillColor = eventColor ? eventColor.light : 'rgba(10, 89, 247, 0.3)';
  const fontColor = colorCfg.eventFontHighLight;
  return {width, background:fillColor, color: fontColor};
}

function bindFilePath() {
  if (bindFile.value) {
    return postMessage({ command: 'unbindComGraph' });
  }
  return postMessage({ command: 'bindComGraphJson' });
}

function openBoundComGraph() {
  postMessage({ command: 'openBoundComGraph' });
}

function jumpToComGraph(value) {
  postMessage({ command: 'jumpToComGraph', paramObj: { hash: value } }); 
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
  const maxLength = 16;
  let truncatedText = eventName.length > maxLength 
                ? eventName.substring(0, maxLength) + '...' 
                : eventName;
  return truncatedText;
};
window.jumpRawMagic = (value, hintValue) => {
  postMessage({ command: 'jumpRawMagic', paramObj: { rawmagic: value, ascendHint: hintValue}});
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
    if(startTimeInfo.value.length  > 5 ){
      startTimeInfo.value = startTimeInfo.value.slice(0, 5) + '...';
      startTimeUnitInfo.value = '';
    }
    durationInfo.value = formatTimeWithUnit(selectedEvent.value.duration).value;
    durationUnitInfo.value = formatTimeWithUnit(selectedEvent.value.duration).unit;
    durationInfoAll.value = durationInfo.value + durationUnitInfo.value;
    if(durationInfo.value.length  > 5 ){
      durationInfo.value = durationInfo.value.slice(0, 5) + '...';
      durationUnitInfo.value = '';
    }
    nextTick(() => {
      createHint(newEvent, 'ioperand-hint');
      createHint(newEvent, 'ooperand-hint');
      showDependencies(newEvent, "both");
    });
  }
});
watch(isDarkTheme, () => {
  updateTheme();
});
const updateTheme = () => {
  tPath.value =  isDarkTheme.value ?`${window.staticPath}/static-assets/circle.svg`: `${window.staticPath}/static-assets/circle_light.svg`;
  aPath.value = isDarkTheme.value ? `${window.staticPath}/static-assets/swim_all.svg` : `${window.staticPath}/static-assets/swim_all_light.svg`;
}
const onInputChange = (newValue, oldValue) => {
  userConfig.value.connectionLevel = newValue;
  const selectedEventTemp = clone(selectedEvent);
  highlightedPaths.clear();
  const processKey = String(selectedEventTemp.value.pid);
  selectEvent(null, processKey);
  selectEvent(selectedEventTemp.value, processKey)
}
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
  refLabel
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
