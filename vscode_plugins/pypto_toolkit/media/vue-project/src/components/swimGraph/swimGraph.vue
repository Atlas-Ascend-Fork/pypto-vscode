<template>
  <div>
    <div class="container">
      <div class="zoom-controls">
        <div class="left-container">
            <d-search class="hidden" icon-position="left" style="width: 400px" :placeholder=searchPlaceholder></d-search>
        </div>
        <div class="right-container">
          <div class="slider-container">
            <d-icon name="icon-zoom-out-2" id="swim-header-decrease" @click="decrease()"></d-icon>
            <div class="slider-wrapper">
              <d-slider id="swimSlider" :min="10" :max="sliderMax" v-model="sliderValue" :tips-renderer="null" @update:modelValue="updataScale()" style="width: 110px"></d-slider>
            </div>
            <d-icon name="icon-enlarge" id="swim-header-increase" @click="increase()"></d-icon>
          </div>
           <d-button class="right-container-buttor hidden">{{ $t("Measure") }}</d-button>
           <d-button class="right-container-buttor hidden" @click="toggleDetailsCores()">{{ $t("data") }}</d-button>
        </div>
      </div>

      <div class="main-view">
        <div class="swimlane-container" ref="swimlaneContainer">
          <div class="loading" v-if="loading">{{ $t("loadTraceData") }}</div>

          <!-- 一段时间轴区域 -->
          <div class="fixed-timeline-area">
            <div class="fixed-timeline-placeholder" :style="{ 'min-width': layout.processLabelWidth + 'px' }" v-if="!loading"></div>
            <canvas class="fixed-timeline-canvas" ref="fixedtimelineCanvas"
            @mousedown="timelineMouseDown($event)" @mousemove="timelineMouseMove($event)" @mouseup="timelineMouseUp()"></canvas>
          </div>

          <!-- 二段时间轴区域 -->
          <div class="timeline-area">
            <div class="timeline-placeholder" :style="{ 'min-width': layout.processLabelWidth + 'px' }" v-if="!loading"></div>
            <canvas class="timeline-canvas" ref="timelineCanvas"></canvas>
          </div>

          <!-- 进程和线程区域 -->
          <div class="processes-container">
            <div v-for="(process, index) in processesArray" :key="index" class="process-section">
              <!-- 进程头部 -->
              <span :data-processKey="process.key" :data-process="process.key"></span>
              <div class="process-header" @click="toggleProcess(process.key)">
                <div class="process-header-label" :style="{ width: layout.processLabelWidth + 'px' }">
                  <span class="expand-icon">{{ processExpanded.get(process.key) ? '▼' : '▶' }}</span>
                  <span>{{ process.processName }}</span>
                </div>
                <div class="process-header-line"></div>
              </div>

              <!-- 线程和事件区域 -->
              <div class="threads-container" v-show="processExpanded.get(process.key)">
                <!-- 线程标签区域 -->
                <div class="thread-labels" :style="{ width: layout.processLabelWidth + 'px' }">
                  <div v-for="(thread, threadIndex) in threadsArray(process)" :key="threadIndex" class="thread-label"
                    :style="{ height: layout.threadHeight * (lane2line.get(process.key + '@' + thread.tid) || 1) + 'px' }">
                    {{ thread.threadName }}
                  </div>
                </div>

                <!-- 线程事件区域 -->
                <div class="thread-events" :data-process-container="process.key">
                  <canvas class="events-canvas" :data-process-key="process.key"
                    @click="handleCanvasClick($event, process.key)" @mousemove="handleMouseMove($event, process.key)"
                    @mouseleave="hideTooltip()" @mousedown="handleMouseDown($event, process.key)" @mouseup="handleMouseUp($event, process.key)"
                    @wheel="handleWheel($event)"></canvas>
                  <canvas class="ui-events-canvas" :ui-data-process-key="process.key"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>

          <!-- 核间数据概览 -->
        <div class="details-cores" :class="{ expanded: detailsCoresExpanded}">
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
                                <div class="Title"> Title</div>
                                <d-tooltip :content="getEventDisplayName(selectedEvent)">
                                  <div :class="['Title-value', { 'dynamic-width' : useDynamicWidth}]" :style="dynamicWidthStyle(selectedEvent)">{{ getEventDisplayName(selectedEvent) }}</div>
                                </d-tooltip>
                            </div>
                        </div>
                        <div class="cate">
                          <div class="cat">Category</div>
                          <div class="cat-value">{{selectedEvent.cat}}</div>
                          <div class="ufcat">User Friendly Category</div>
                          <div class="cat-value">{{selectedEvent.cat}}</div>
                        </div>
                    </div>
                    <div class="content-stat">
                        <div class="content-border">
                            <div class="start">Start</div>
                            <div class="start-value">
                                <span>{{formatTimeWithUnit(selectedEvent.startTime - viewState.minTime).value}}</span>
                                {{formatTimeWithUnit(selectedEvent.startTime - viewState.minTime).unit}}
                            </div>
                        </div>
                        <div class="content-border">
                            <div class="duration">Wall Duration</div>
                            <div class="start-value">
                                <span>{{formatTimeWithUnit(selectedEvent.duration).value}}</span>
                                {{formatTimeWithUnit(selectedEvent.duration).unit}}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-args">
                  <div class="content-args-head">
                    <div>Args</div>
                    <div class="bindbox">
                      <d-tooltip position="bottom" :content=bindToolTip>
                        <d-button variant="text" color="secondary" v-show="bindFile" @click="openBoundComGraph" class="jump-to-file"><strong class="icon-details"></strong></d-button>
                      </d-tooltip>
                      <d-button variant="text" color="primary" @click="bindFilePath">{{ bindButtion }}</d-button>
                    </div>
                  </div>
                  <template v-if="selectedEvent.isCounter">
                    <strong>{{ $t("countValue") }}</strong> {{ selectedEvent.counterSize }}<br>
                    <strong>{{ $t("type") }}</strong> {{ $t("counterEvent") }}<br>
                  </template>
                  <template v-else>
                    <div>
                        <span>duration</span>
                        <span>{{selectedEvent.duration}}</span>
                    </div>
                    <div>
                        <span>end_time</span>
                        <span>{{selectedEvent.endTime - viewState.minTime}}</span>

                    </div>
                    <div style="display: none;">
                        <span>last_pred</span>
                        <span>17</span>
                    </div>
                    <div style="display: none;">
                        <span>ready_time</span>
                        <span>3640</span>
                    </div>
                    <div>
                        <span>start_time</span>
                        <span>{{selectedEvent.startTime - viewState.minTime}}</span>
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
                        <span class="args-key">{{ key }}</span>
                      </d-tooltip>
                      <d-tooltip v-if="value !== '' && key !== 'event-hint' ">
                        <span class="args-value">{{ value }}</span>
                        <template #content>
                          <div>{{ value }}</div>
                        </template>
                      </d-tooltip>

                      <span class="args-button" v-if="value.includes('rootHash') || value.includes('leafHash')">
                        <span v-for="(item, key) in splitValue(value)">
                          <span v-if="item[0]=='rootHash' || item[0]=='leafHash'">
                            {{ item[0] }}:<span class="event-hint-hash" @click="jumpToComGraph(item[1])">{{ item[1] }}</span>,
                          </span>
                          <span v-else>
                            {{ item[0] }}:{{ item[1] }},
                          </span>
                        </span>
                      </span>

                    </div>
                  </template>
                </div>
                <div id="canvas-container">
                  <div class="relevent">
                      Relevent
                  </div>
                  <div class="button-group">
                      <button @click="releventShowPre" :class="{'relevent-highlight': (releventDisplay == 'pre')}"><img class="left" :src="lPath" alt="left"/></button>
                      <button @click="releventShowAll" :class="{'relevent-highlight': (releventDisplay == 'all')}"><img class="all" :src="aPath" alt="all"/></button>
                      <button @click="releventShowNext" :class="{'relevent-highlight': (releventDisplay == 'next')}"><img class="right" :src="rPath" alt="right"/></button>                      
                  </div>
                  <div class="swim-graph-icon">
                      <div><span class="icon-span-i">Incoming</span><span class="icon-span-value">{{predecessors.length}}</span></div>
                      <div><span class="icon-span-c">Current</span></div>
                      <div><span class="icon-span-o">Outgoing</span><span class="icon-span-value">{{successors.length}}</span></div>
                  </div>
                  <canvas id="dependency-canvas"></canvas>
                </div>
                <div class="close-button">
                  <d-button icon="icon-close" style="width: 16px; font-size: 16px; border: none; background-color: transparent" @click="toggleDetailsPanel()"></d-button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="tooltip" ref="tooltip" :style="tooltipStyle"></div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { generateColorList } from '../../utils/color-list';
import { getTextWidth } from '../../utils/index';
import { throttle } from 'lodash-es';
import { pushState } from '@/core/state';
const { t: $t } = useI18n();
// 响应式状态
const fixedtimelineCanvas = ref(null);
const fixedtimelineCtx = ref(null);
const timelineCanvas = ref(null);
const timelineCtx = ref(null);
const swimlaneContainer = ref(null);
const counterEvents = ref([]);
const tooltip = ref(null);
const detailsContent = ref(null);
const timeLineX = ref(null);
const traceData = ref(null);
const processedEvents = ref([]);
const processes = reactive(new Map());
const selectedEvent = ref(null);
const highlightedPaths = reactive(new Set());
const processExpanded = reactive(new Map()); // 跟踪进程展开状态
const loading = ref(true);
const detailsPanelExpanded = ref(false);
const detailsCoresExpanded = ref(false);
const showPreNode = ref(true);
const showNextNode = ref(true);
const canvasclickedEvent = ref(null);
const releventDisplay = ref("all");
const bindFile = ref(false);
const bindButtion = ref($t("bindComGraphJson"));
const bindToolTip = ref($t("openComputationalGraphJsonFile"));

const tooltipStyle = reactive({
  display: 'none',
  left: '0px',
  top: '0px'
});
let altClickData = {
    preData: null,
    lastData: null,
    largeSpacing: false
};
const searchPlaceholder = $t("searchKeyword");

const sliderValue = ref(10);
const sliderMax = ref(100);

const initialScale = ref(1);

const useDynamicWidth = ref(true);

const dynamicWidthStyle = (event) => {
  if(!useDynamicWidth) return {};
  const eventName = getEventDisplayName(event);
  const width = eventName.length * 7 + 4 + 'px';
  return {width};
}

const viewState = reactive({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  minTime: 0,
  maxTime: 0,
  timeRange: 0
});

const layout = reactive({
  processLabelWidth: 250,
  eventHeight: 16,
  processHeaderHeight: 30,
  threadHeight: 24,
  counterHeight: 24,
  eventMargin: 2,
  processMargin: 5
});
let timeContainerRect = ref(null);
let eventContainerRect = ref(null);

const timelineState = reactive({
  startTime: 0,
  endTime: 0,
  startTimeX: 0,
  endTimeX: 0,
  isInLeftTag: false,
  isInRightTag: false,
  isOnTag: false,
  isOutTag: false,
});

let isTimelineDragging = false;
let timelineInitX = 0;
let timelineInitStartX = 0;
let timelineInitEndX = 0;
let lastPostion = 0;

const tPath = ref(`${window.staticPath}/static-assets/circle.svg`);
const lPath = ref(`${window.staticPath}/static-assets/swim_left.svg`);
const aPath = ref(`${window.staticPath}/static-assets/swim_all.svg`);
const rPath = ref(`${window.staticPath}/static-assets/swim_right.svg`);

const lane2line = reactive(new Map());  // 记录泳道中的节点一共有多少行，如果有重复的节点，需要分行展示，该数据base 0

const expandedProcess = [];
let isDragging = false;
let lastX;

const baseColorList = generateColorList(60).baseColorList;
const lightColorList = generateColorList(60).lightColorList;

const processEventMap = {};
const id2event = {};

// 计算属性
const timeRangeText = computed(() => {
  if (viewState.timeRange > 0) {
    const { value, unit } = formatTimeWithUnit(viewState.timeRange);
    return `${$t("totalDuration")} ${value}${unit}`;
  }
  return '';
});

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

// 将Map转换为数组以便在模板中使用v-for
const processesArray = computed(() => {
  return Array.from(processes.entries()).map(([key, value]) => {
    return {
      key,
      ...value
    };
  });
});

// 将线程Map转换为数组
const threadsArray = (process) => {
  return Array.from(process.threads.entries()).map(([key, value]) => {
    return {
      key,
      ...value
    };
  });
};

const onResize = () => {
  resizeCanvases();
  renderEvent();
}

// 方法
const initEventListeners = () => {
  window.addEventListener('resize', onResize);

  // 监听时间轴画布事件
  const timelineCanvasEl = timelineCanvas.value;
  timelineCanvasEl.addEventListener('wheel', handleWheel);

  // 监听来自VSCode的消息
  window.addEventListener('message', handleMessage);
};

const handleMessage = (event) => {
  const message = event.data;
  switch (message.command) {
    case 'returnSwimData':
      if (message.comGraphPath) {
        bindFile.value = message.comGraphPath;
        bindButtion.value = $t("unbindComGraph");
      }
      const oldMessage = /** @type { { message: object } | undefined } */ (vscode.getState());
      let newMessage = (oldMessage && oldMessage.message) || message;
      pushState({ message: message });

      loading.value = true;
      fetch(newMessage.data)
      .then(r => r.json())
      .then(json => {
        loadTraceData(json);
      });
      break;
    case 'bindResult':
      if (message.success) {
        bindFile.value = message.comGraphPath;
        bindButtion.value = $t("unbindComGraph");
      } else {
        bindFile.value = false;
        bindButtion.value = $t("bindComGraphJson");
      }
      
      break;
    case 'unbindResult':
      if (message.success) {
        bindFile.value = false;
        bindButtion.value = $t("bindComGraphJson");
      } else {
        bindFile.value = message.comGraphPath;
        bindButtion.value = $t("unbindComGraph");
      }
      break;
  }
};

const postMessage = (message) => {
  if (window.vscode) {
    window.vscode.postMessage(message);
  }
};

let ERROR_MESSAGES = {
  INVALID_FILE: $t("swimErroMsgINVALID_FILE"),
  MISSING_EVENT_FIELDS: $t("swimErroMsgMISSING_EVENT_FIELDS"),
  MISSING_END_EVENT: $t("swimErroMsgMISSING_END_EVENT"),
  MISSING_DUR: $t("swimErroMsgMISSING_DUR"),
  INVALID_ARGS: $t("swimErroMsgINVALID_ARGS"),
  MISSING_PROCESS_NAME: $t("swimErroMsgMISSING_PROCESS_NAME"),
  MISSING_THREADS_FIELDS: $t("swimErroMsgMISSING_THREADS_FIELDS"),
  NO_THREADS: $t("swimErroMsgNO_THREADS"),
  NO_PROCESS_NAME: $t("swimErroMsgNO_PROCESS_NAME")
}

const validData = (data) => {
  if (!data || !data.traceEvents || !Array.isArray(data.traceEvents)) {
    window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.INVALID_FILE}`);
  }

  let hasProcessName = false;
  let countThread = 0;

  const eventMap = new Map();
  data.traceEvents.forEach(event => {
    const key = `${event.name}-${event.id}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, []);
    }
    eventMap.get(key).push(event);
  });

  data.traceEvents.forEach(event => {
    if (event.cat === 'event' && (typeof event.id === "undefined" || !event.name || !event.ph || typeof event.pid === "undefined" || typeof event.tid === "undefined" || typeof event.ts === "undefined")) {
      window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_EVENT_FIELDS}: ["${event.name}"]`);
    }

    if (event.ph === 'B') {
      const key = `${event.name}-${event.id}`;
      const endEvent = eventMap.get(key) || [];
      const hasE = endEvent.some(e => e.ph === 'E');
      if (!hasE) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_END_EVENT}: ["${event.name}"]`);
      }
    } else if (event.ph === 'X') {
      if (!event.dur) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_DUR}: ["${event.name}"]`);
      }
    } else if (event.ph === 'C') {
      if (!event.args || (typeof event.args.size !== "number" && typeof event.args['/byte'] !== "number" )) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.INVALID_ARGS}: ["${event.name}"]`);
      }
    } 

    if (event.name === "process_name") {
      hasProcessName = true;
      if (typeof event.pid === "undefined" || !event.args || !event.args.name) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_PROCESS_NAME}: ["${event.args.name}"]`);
      }
    }

    if (event.name.includes("thread")) {
      countThread += 1;
      if (typeof event.pid === "undefined" || typeof event.tid === "undefined" || !event.args || !event.args.name) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_THREADS_FIELDS}: ["${event.args.name}"]`);
      }
    }
  });

  if (countThread === 0) {
    window.ascEventBus.emit('jsonParseError', ERROR_MESSAGES.NO_THREADS);
  }

  if (!hasProcessName) {
    window.ascEventBus.emit('jsonParseError', ERROR_MESSAGES.NO_PROCESS_NAME);
  }
};

const loadTraceData = (data) => {
  try {
    traceData.value = typeof data === 'string' ? JSON.parse(data) : data;
    validData(traceData.value);
    processTraceData();
    updateTimeRange();
    resetZoom();
    loading.value = false;
  } catch (error) {
    console.error($t("loadTraceDataError"), error);
    loading.value = true;
  }
};

const calculateLine = (event, lable2lines) => {
  const label = `${event.pid}@${event.tid}`;
  let lines = lable2lines[label];
  if (!lines) {
    lable2lines[label] = [];  // 索引所在位置表示第i行最后一个事件的 endTime
    lines = lable2lines[label];
  }
  let placed = false;

  for (let i = 0; i < lines.length; i++) {
    if (event.startTime >= lines[i]) {
      event.line = i;
      lines[i] = Math.max(lines[i], event.endTime);
      placed = true;
      break
    }
  }
  if (!placed) {
    event.line = lines.length;
    lines.push(event.endTime);
  }
  lane2line.set(label, lines.length);
}

const calculateDuration = (eventTasks, processedTasks) => {
  let taskIndex = 0;
  while (taskIndex < eventTasks.length - 1) {
    const tStart = eventTasks[taskIndex];
    if (tStart.ph.toUpperCase() === 'X') {
      const event = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: tStart.ts,
        endTime: tStart.ts + tStart.dur,
        duration: tStart.dur,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      processedTasks.push(event);
      taskIndex += 1;
      continue;
    }
    const tEnd = eventTasks[taskIndex + 1];

    if (tStart.id === tEnd.id && tStart.ph.toUpperCase() === 'B' && tEnd.ph.toUpperCase() === 'E') {
      const processedEvent = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: tStart.ts,
        endTime: tEnd.ts,
        duration: tEnd.ts - tStart.ts,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      processedTasks.push(processedEvent);
      taskIndex += 2;
    } else {
      taskIndex += 1;
    }
  }
};

const processTraceData = () => {
  processedEvents.value = [];
  processes.clear();
  processExpanded.clear();

  if (!traceData.value || !traceData.value.traceEvents) {
    return;
  }

  const processNames = new Map();
  const threadNames = new Map();
  const eventTasks = [];
  const connections = [];

  traceData.value.traceEvents.forEach((event, index) => {
    if (event.name === 'process_name') {
      processNames.set(event.pid, event.args.name);
    } else if (event.name === 'thread_name') {
      threadNames.set(`${event.pid}-${event.tid}`, event.args.name);
    } else if (event.cat === 'event' || event.ph === 'C') {
      if (event.ph === 'C' && (typeof(event.args.size) === 'number')) {
        const sId = event.name;
        if (!threadNames.has(sId)) {
          threadNames.set(sId, event.name);
        }
        counterEvents.value.push({ ...event, isCounter: true });
      } else {
        const color = getEventColor(event);
        eventTasks.push({ ...event, originalIndex: index, color });
      }
    } else if (event.cat === 'machine-view-last-dep') {
      connections.push(event);
    }
  });

  let processThreadMap = new Map();
  counterEvents.value = counterEvents.value.sort((a, b) => a.ts - b.ts);
  [...eventTasks, ...counterEvents.value].forEach(event => {
    const processKey = `${event.pid || 0}`;
    const threadKey =  event.isCounter ? event.name : `${event.pid || 0}-${event.tid || 0}`;

    if (!processThreadMap.has(processKey)) {
      processThreadMap.set(processKey, {
        pid: event.pid || 0,
        processName: processNames.get(event.pid) || `Process ${event.pid || 0}`,
        threads: new Map()
      });
    }

    const process = processThreadMap.get(processKey);
    if (!process.threads.has(threadKey)) {
      const threadName = threadNames.get(threadKey) || `Thread ${event.tid || 0}`;
      process.threads.set(threadKey, {
        tid: event.tid || 0,
        threadName,
        events: []
      });
    }
  });

  let processedTasks = [];

  calculateDuration(eventTasks, processedTasks);

  processedTasks = processedTasks.sort((a, b) => a.startTime - b.startTime);
  const lable2lines = {};
  for (const event of processedTasks) {
    calculateLine(event, lable2lines);
  }

  // 计算依赖关系
  calculateDependencies(processedTasks, connections);

  // 组织数据结构
  let firstExpanded = false;
  [...processedTasks, ...counterEvents.value].forEach(event => {
    const processKey = `${event.pid || 0}`;
    const threadKey =  event.isCounter ? event.name : `${event.pid || 0}-${event.tid || 0}`;

    if (!processes.has(processKey)) {
      const processInfo = processThreadMap.get(processKey);
      let expanded = false;
      if (!firstExpanded) {
        expanded = true;
        firstExpanded = true;
      }
      processes.set(processKey, {
        pid: processInfo.pid,
        processName: processInfo.processName,
        threads: new Map(),
        expanded: expanded // 除了第一个，其他默认折叠
      });
      processExpanded.set(processKey, expanded);
    }

    const process = processes.get(processKey);
    if (!process.threads.has(threadKey)) {
      const threadInfo = processThreadMap.get(processKey).threads.get(threadKey);
      const info = {
        tid: threadInfo.tid,
        threadName: threadInfo.threadName,
        events: [],
      };
      if (event.isCounter) {
        info.isCounter = true;
        info.maxCount = 0;
        info.argKey = Object.keys(event.args)[0];
      }
      process.threads.set(threadKey, info);
    }

    const thread = process.threads.get(threadKey);
    thread.events.push(event);
    if (thread.isCounter) {
      thread.maxCount = Math.max(thread.maxCount, event.args[thread.argKey]);
    }
  });

  processedEvents.value = processedTasks;

  if (processedEvents.value.length > 0) {
    const ret = parseTime(processedEvents);
    viewState.minTime = ret.minTime;
    viewState.maxTime = ret.maxTime;
    viewState.timeRange = viewState.maxTime - viewState.minTime;
  }

  // 对线程进行排序
  processes.forEach((value) => {
    const cThread = new Map([...value.threads.entries()].filter(
      (item) => item[1].isCounter
    ).sort());
    const eThread = new Map([...value.threads.entries()].filter((item) => !item[1].isCounter).sort());
    value.threads = new Map([...cThread.entries(), ...eThread.entries()]);
  });

  // 初始化画布
  nextTick(() => {
    initCanvases();
    renderTwoTimeline();
  });
};

const getSubGraphId = (event) => {
  let subGraphId;
  if (event.args && event.args['ascend-hint']) {
    const subGraphArr = event.args['ascend-hint'].split(',');
    const subGraphItem = subGraphArr.find(item => item.includes('subGraphId'));
    subGraphId = subGraphItem ? subGraphItem.split(':')[1] : null;
  }
  if (!subGraphId) {
    const nameParts = event.name.split('(')[0].split('-');
    subGraphId = nameParts[nameParts.length - 1].trim();
  }
  return Number(subGraphId) || 15;
};

const getEventColor = (event) => {
  const subGraphId = getSubGraphId(event);
  let color = baseColorList[subGraphId];
  let lightColor = lightColorList[subGraphId];

  if (subGraphId > 360 && !color) {
    color = baseColorList[subGraphId % 360 ];
    lightColor = lightColorList[subGraphId % 360];
  }

  if (!color || !lightColor) {
    color = '#666666';
    lightColor = '#666666';
  }
  return { dark: color, light: lightColor };
};

const parseTime = (processedEvents) => {
  let minTime = processedEvents.value[0].startTime;
  let maxTime = 0;
  for (const event of processedEvents.value) {
    minTime = Math.min(...[minTime, event.startTime]);
    maxTime = Math.max(...[maxTime, event.endTime]);
  }
  return { minTime, maxTime };
};

const calculateDependencies = (events, connections) => {
  // 构建索引：以 (tid, startTime, endTime) 为键，事件对象为值
  // 由于 startTime 和 endTime 是范围，我们可以使用 Map 存储每个 tid 的事件列表，并按 startTime 排序
  const eventIndex = new Map();

  // 预处理 events，按 tid 分组并排序
  events.forEach(event => {
    if (!eventIndex.has(event.tid)) {
      eventIndex.set(event.tid, []);
    }
    eventIndex.get(event.tid).push(event);
  });

  // 对每个 tid 的事件列表按 startTime 排序
  for (let eventsList of eventIndex.values()) {
    eventsList.sort((a, b) => a.startTime - b.startTime);
  }

  let cIndex = 0;
  while (cIndex < connections.length) {
    const start = connections[cIndex];
    const end = connections[cIndex + 1];
    const tid1 = start.tid;
    const tid2 = end.tid;

    // 使用索引快速查找 parent 事件
    const parentEvents = eventIndex.get(tid1);
    const parent = parentEvents ? findEvent(parentEvents, start.ts) : null;

    // 使用索引快速查找 child 事件
    const childEvents = eventIndex.get(tid2);
    const child = childEvents ? findEvent(childEvents, end.ts) : null;

    if (parent && child && start.ts <= end.ts) {
      parent.dependencies.successors.push(child.id);
      child.dependencies.predecessors.push(parent.id);
    }

    cIndex += 2;
  }
};

// 二分查找辅助函数
const findEvent = (eventsList, timestamp) => {
  let left = 0;
  let right = eventsList.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const event = eventsList[mid];

    if (timestamp >= event.startTime && timestamp <= event.endTime) {
      return event;
    } else if (timestamp < event.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
}

const calculateMaxScale = () => {
  if (!fixedtimelineCtx.value || !fixedtimelineCanvas.value) return 10;
  const canvasWidth = fixedtimelineCanvas.value.width;
  const calculateScale = (viewState.timeRange / canvasWidth) * 1000 * 100;
  const maxScale = Math.floor(calculateScale);
  return maxScale;
}

const updateTimeRange = () => {
  // 时间范围已通过计算属性更新
  const maxScale = calculateMaxScale();
  sliderMax.value = maxScale * 10;
};

// 时间轴统一单位
const TimelineWithUnit = (timelineRange, timeInMicroseconds) => {
  const microseconds = timelineRange;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  let timelineValue = 0;

  if (minutes >= 1) {
    timelineValue = timeInMicroseconds / 60000000;
    return { value: timelineValue.toFixed(1), unit: 'min' };
  } else if (seconds >= 1) {
    timelineValue = timeInMicroseconds / 1000000;
    return { value: timelineValue.toFixed(1), unit: 's' };
  } else if (milliseconds >= 1) {
    timelineValue = timeInMicroseconds / 1000;
    return { value: timelineValue.toFixed(1), unit: 'ms' };
  } else {
    return { value: timeInMicroseconds.toFixed(0), unit: 'μs' };
  }
};

const formatTimeWithUnit = (timeInMicroseconds) => {
  const microseconds = timeInMicroseconds;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;

  if (minutes >= 1) {
    return { value: minutes.toFixed(2), unit: 'min' };
  } else if (seconds >= 1) {
    return { value: seconds.toFixed(2), unit: 's' };
  } else if (milliseconds >= 1) {
    return { value: milliseconds.toFixed(2), unit: 'ms' };
  } else {
    return { value: microseconds.toFixed(0), unit: 'μs' };
  }
};

// 初始化所有画布
const initCanvases = () => {
  // 初始化时间轴画布
  if (fixedtimelineCanvas.value) {
    fixedtimelineCtx.value = fixedtimelineCanvas.value.getContext('2d');
  }
  if (timelineCanvas.value) {
    timelineCtx.value = timelineCanvas.value.getContext('2d');
  }

  resizeCanvases();
};

const resizeCanvases = () => {
  if (!swimlaneContainer.value) return;

  let containerRect = swimlaneContainer.value.getBoundingClientRect();
  const availableWidth = containerRect.width;

  // 调整时间轴画布大小
  if (fixedtimelineCanvas.value) {
    fixedtimelineCanvas.value.width = availableWidth - layout.processLabelWidth;
    fixedtimelineCanvas.value.height = 30; // 时间轴高度
  }
  if (timelineCanvas.value) {
    timelineCanvas.value.width = availableWidth - layout.processLabelWidth;
    timelineCanvas.value.height = 50; // 时间轴高度
  }

  // 计算总高度
  let totalHeight = 0;
  for (const [processKey, process] of processes.entries()) {
    totalHeight += layout.processHeaderHeight;
    if (processExpanded.get(processKey)) {
      totalHeight += getCanvasHeight(process, processKey);
    }
    totalHeight += layout.processMargin;

    // 调整进程事件画布大小
    if (processExpanded.get(processKey)) {
      const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
      if (canvasRef) {
        canvasRef.width = availableWidth - layout.processLabelWidth;
        canvasRef.height = getCanvasHeight(process, processKey);
      }
      const uiCanvasRef = document.querySelector(`[ui-data-process-key="${processKey}"]`);
      if (uiCanvasRef) {
        uiCanvasRef.width = availableWidth - layout.processLabelWidth;
        uiCanvasRef.height = getCanvasHeight(process, processKey);
      }
    }
  }
};

const renderTwoTimeline = () => {
  // 渲染两段时间轴
  if (import.meta.env.DEV) console.time('renderTwoTimeline');
  renderFixedTimeline();
  renderTimeline();
  if (import.meta.env.DEV) console.timeEnd('renderTwoTimeline');
}

const renderEvent = () => {
  if (!processedEvents.value.length && !counterEvents.value.length) return;
  // 渲染每个进程的事件
  for (const [processKey, process] of processes.entries()) {
    if (processExpanded.get(processKey)) {
      if (import.meta.env.DEV) console.time('renderProcessEvents: ' + processKey);
      // 确保进程画布存在
      const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
      if (!canvasRef) {
        console.warn(`Canvas for process ${processKey} not found, trying to create it`);
        // 在下一个tick尝试重新渲染，以确保DOM已更新
        nextTick(() => renderProcessEvents(process, processKey));
      } else {
        renderProcessEvents(process, processKey);
      }
      if (import.meta.env.DEV) console.timeEnd('renderProcessEvents: ' + processKey);
    }
  }
}

const render = () => {
  if (!processedEvents.value.length && !counterEvents.value.length) return;
  renderTwoTimeline();
  renderEvent();
};

const renderFixedTimeline = () => {
  if (!fixedtimelineCtx.value || !fixedtimelineCanvas.value) return;

  const ctx = fixedtimelineCtx.value;
  const canvas = fixedtimelineCanvas.value;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制背景
  ctx.fillStyle = '#252526';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制时间网格
  ctx.strokeStyle = '#3e3e42';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(canvas.width, 30);
  ctx.stroke();

  let lastx = 0;
  const canvasWidth = canvas.width;
  const timePerPixel = viewState.timeRange / canvasWidth;
  const gridInterval = calculateGridInterval(timePerPixel);

  // 联动二段轴逻辑
  const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
  const startTime = viewState.minTime + Math.abs(viewState.offsetX * timelinePerPixel);
  const startTimex = fixedTimeToX(startTime) - layout.processLabelWidth;

  const endTime = startTime + (canvasWidth * timelinePerPixel);
  const endTimex = fixedTimeToX(endTime) - layout.processLabelWidth;
  const endSecondTimex = timeToX(viewState.maxTime) - layout.processLabelWidth;
  timelineState.startTime = startTime;
  timelineState.startTimeX = startTimex;
  timelineState.endTime = endTime;
  timelineState.endTimeX = endTimex;
  timeLineX.value = endSecondTimex;
  timelineState.startTime = startTime;
  timelineState.endTime = endTime;

  for (let time = viewState.minTime; time <= viewState.maxTime; time += gridInterval) {
    const x = fixedTimeToX(time) - layout.processLabelWidth;
    if (x >= 0 && x <= canvas.width) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
      if(lastx - x !== 0){
        const distance = x - lastx;
        const segmentWidth = distance / 10;
        for (let i = 1; i < 10; i++) {
          const segmentX = lastx + i * segmentWidth;
          ctx.beginPath();
          ctx.moveTo(segmentX, 30);
          ctx.lineTo(segmentX, 20);
          ctx.stroke();
        }
      }

      const { value, unit } = TimelineWithUnit(viewState.timeRange, time - viewState.minTime);
      ctx.fillStyle = '#cccccc';
      ctx.font = '14px Arial';
      if (x < startTimex || x > endTimex) {
        ctx.fillStyle = 'rgba(102, 102, 102, 1)';
      }
      ctx.fillText(`${value}${unit}`, x + 2, 15);
    }
    lastx = x;
  }
  // 绘制间距条
  ctx.strokeStyle = 'rgb(255, 255, 255)';
  ctx.lineWidth = 6;
  
  ctx.beginPath();
  ctx.moveTo(startTimex, 0);
  ctx.lineTo(startTimex, canvas.height / 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endTimex, 0);
  ctx.lineTo(endTimex, canvas.height / 3);
  ctx.stroke();

  ctx.strokeStyle = 'rgb(255, 255, 255)';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(startTimex, canvas.height / 3);
  ctx.lineTo(startTimex, canvas.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endTimex, 0);
  ctx.lineTo(endTimex, canvas.height);
  ctx.stroke();
};

const renderTimeline = () => {
  if (!timelineCtx.value || !timelineCanvas.value) return;

  const ctx = timelineCtx.value;
  const canvas = timelineCanvas.value;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制背景
  ctx.fillStyle = '#252526';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制时间网格
  ctx.strokeStyle = '#3e3e42';
  ctx.lineWidth = 1;

  const timelineTimeRange = timelineState.endTime - timelineState.startTime;
  const canvasWidth = canvas.width;
  const timePerPixel = timelineTimeRange / canvasWidth;
  const gridInterval = calculateGridInterval(timePerPixel);
  for (let time = timelineState.startTime; time <= timelineState.endTime; time += gridInterval) {
    const x = timeToX(time) - layout.processLabelWidth;
    if (x >= 0 && x <= canvas.width) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      const { value, unit } = TimelineWithUnit(viewState.timeRange, time - viewState.minTime);
      ctx.fillStyle = '#cccccc';
      ctx.font = '12px Arial';
      ctx.fillText(`${value}${unit}`, x + 2, 15);
      ctx.fillStyle = '#cccccc';
      ctx.font = '12px Arial';
      const timeValue = xToTimeValue(time);
      ctx.fillText(`${timeValue}`, x + 2, 30);
    }
  }
};

const xToTimeValue = (time) => {
  const currentTime = Math.trunc((time - viewState.minTime) * 1000);
  let truncatedCurrentTime = currentTime;
  if (currentTime.toString().length > 10) {
    truncatedCurrentTime = parseInt(currentTime.toString().slice(-9));
  }
  let str = truncatedCurrentTime.toString().padStart(9, '0');
  str = str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return str;
}

const getCanvasHeight = (process, processKey) => {
  let height = 0;
  for (const [threadKey, thread] of process.threads.entries()) {
    const label = `${processKey}@${thread.tid}`;
    const lineCount = lane2line.get(label) || 1;
    height += layout.threadHeight * lineCount;
  }
  return height;
}

const renderProcessEvents = (process, processKey) => {
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  const uiCanvasRef = document.querySelector(`[ui-data-process-key="${processKey}"]`);
  if (!canvasRef) {
    console.warn(`Canvas for process ${processKey} not found`);
    return;
  }

  const ctx = canvasRef.getContext('2d');
  const uiLayerCanvasCtx = uiCanvasRef.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);

  // 确保画布尺寸正确
  if (canvasRef.width === 0 || canvasRef.height === 0) {
    let containerRect = timeContainerRect.value;
    if (!containerRect) {
      timeContainerRect.value = swimlaneContainer.value.getBoundingClientRect();
      containerRect = timeContainerRect.value;
    }
    canvasRef.width = containerRect.width - layout.processLabelWidth;
    canvasRef.height = getCanvasHeight(process, processKey);
  }

  ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  uiLayerCanvasCtx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  // 绘制背景
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvasRef.width, canvasRef.height);
  uiLayerCanvasCtx.fillStyle = 'rgba(0, 0, 0, 0)';
  uiLayerCanvasCtx.fillRect(0, 0, canvasRef.width, canvasRef.height);

  let threadY = 0;
  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      drawCounterThread(thread, ctx, threadY);
    } else {
      drawEventThread(thread, ctx, threadY);
    }
    threadY += thread.isCounter ? layout.counterHeight : layout.threadHeight * (lane2line.get(`${processKey}@${thread.tid}`) || 1);
  }

  // 绘制依赖线
  if (selectedEvent.value && highlightedPaths.size > 0) {
    drawDependencyLines(ctx, process);
  }
  expandedProcess.push(processKey);
};

const calculateGridInterval = (timePerPixel) => {
  const minPixelInterval = 100;
  const minTimeInterval = timePerPixel * minPixelInterval;

  const intervals = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100,
   200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  for (const interval of intervals) {
    if (interval >= minTimeInterval) {
      return interval;
    }
  }
  return intervals[intervals.length - 1];
};

const drawCounterThread = (thread, ctx, threadY) => {
  const argKey = thread.argKey;
  const maxHight = layout.counterHeight * 2 / 3;
  const maxCount = thread.maxCount;
  const segment = 10; // 分段
  const countPerHeight = maxHight / segment;
  
  ctx.beginPath();
  ctx.strokeStyle = '#4aaad6ff';
  ctx.lineWidth = 1;

  let lastSegment = undefined;
  let lastLineX = undefined;
  let lastLineY = threadY + layout.counterHeight;
  let targetY = lastLineY;

  ctx.moveTo(0, lastLineY);

  for (const event of thread.events) {
    const x = timeToX(event.ts) - layout.processLabelWidth;
    if (x < viewState.offsetX || x > ctx.canvas.width) {
      break;
    }
    const size = event.args[argKey];
    const currentSegment = maxCount ? Math.floor(size / (maxCount / segment)) : 0;
    targetY = threadY + layout.counterHeight - countPerHeight * currentSegment;
    if (lastSegment === undefined || currentSegment !== lastSegment ) {
      ctx.lineTo(x, lastLineY);
      ctx.lineTo(x, targetY);
      lastSegment = currentSegment;
      lastLineX = x;
      lastLineY = targetY;
    }
  }

  ctx.lineTo(ctx.canvas.width, targetY);
  ctx.stroke();
  ctx.closePath();
};

const drawEventThread = (thread, ctx, threadY) => {
  // 绘制线程事件
  let eventDatas = [];
  for (const event of thread.events) {
    const x = timeToX(event.ts) - layout.processLabelWidth;
    if (x < viewState.offsetX || x > ctx.canvas.width) {
      continue;
    }
    const drawData = {rectX: 0, rectY: 0, eventWidth: 0, height: 0, rectColor: '', text: '', textX: 0, textY: 0, fontColor: ''};
    const y = threadY + layout.threadHeight * ((event.line || 0) + 1) - layout.threadHeight / 2;
    if (getDrawData(ctx, event, y, drawData)) {
      eventDatas.push(drawData);
    }
  }
  for (const drawData of eventDatas) {
    // 填充矩形
    ctx.fillStyle = drawData.rectColor;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
    ctx.beginPath();
    if (drawData.eventWidth < 4) {
      ctx.rect(drawData.rectX, drawData.rectY, drawData.eventWidth, drawData.height);
    } else {
      ctx.roundRect(drawData.rectX, drawData.rectY, drawData.eventWidth, drawData.height, 4);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = drawData.fontColor;
    ctx.font = '9px sans-serif';
    ctx.fillText(drawData.text, drawData.textX, drawData.textY);
  }
};

const getDrawData = (ctx, event, y, drawData) => {
  if (!ctx || !ctx.canvas) {
    console.warn('Canvas context not available for drawing event');
    return false;
  }
  const x = timeToX(event.startTime) - layout.processLabelWidth;
  let width;
  let height;

  width = Math.max(1, durationToWidth(event.duration));
  height = layout.eventHeight;
  const eventX = x;
  const eventY = y - height / 2;
  const eventWidth = Math.min(width, ctx.canvas.width - eventX);

  // 存储事件的位置信息，用于点击检测
  event.renderInfo = {
    x: eventX,
    y: eventY,
    width: eventWidth,
    height: height,
    processKey: ctx.canvas.dataset.processKey
  };

  // 检查事件是否在可视区域内
  if (x + width < 0 || x > ctx.canvas.width) {
    return false;
  }

  // 计算填充颜色
  let fillColor = event.color ? event.color.dark : '';
  let fontColor = '#ffffff';
  const isSelf = selectedEvent.value && selectedEvent.value.id === event.id;
  if (highlightedPaths.size > 0 && !isSelf && !highlightedPaths.has(event.id)) {
    fillColor = 'rgba(125, 125, 125, 0.5)';
    fontColor = '#999999ff';
  } else if (isSelf || highlightedPaths.has(event.id)) {
    fillColor = event.color.light;
    fontColor = '#000000';
  }

  // 确保宽度和高度为正值
  if (eventWidth <= 0 || height <= 0) {
    return false;
  }
  drawData.rectX = eventX;
  drawData.rectY = eventY;
  drawData.eventWidth = eventWidth;
  drawData.height = height;
  drawData.rectColor = fillColor;

  const textX = event.renderInfo.x;
  let actualWidth = textX >= 0 ? width : width + textX;
  if (actualWidth < 10) {
    return true;
  }
  const displayName = event.isCounter ? event.displayName || event.name : event.name;
  const textWidth = getTextWidth(displayName, 10);
  const widthPerChar = textWidth / displayName.length;

  let maxCharsToFit = Math.floor(actualWidth / widthPerChar);
  
  let displayText = '';
  if (textWidth >= actualWidth && maxCharsToFit > 3) {
    maxCharsToFit -= 3;
    displayText = displayName.substr(0, maxCharsToFit) + '...';
  } else if (textWidth < actualWidth) {
    displayText = displayName;
  }

  let textStartX = textX + (actualWidth - getTextWidth(displayText, 10)) / 2;
  if (textX < 0) {
    textStartX = (actualWidth - getTextWidth(displayText, 10)) / 2;
  }
  drawData.text = displayText;
  drawData.textX = textStartX;
  drawData.textY = y + 2;
  drawData.fontColor = fontColor;
  return true;
}

const drawDependencyLines = (ctx, process) => {
  if (!selectedEvent.value || highlightedPaths.size === 0) return;

  ctx.strokeStyle = '#FF4444';
  ctx.lineWidth = 2;

  // 构建 ID 到事件的映射，提高查找效率
  let eventMap = processEventMap[process.pid];
  if (!eventMap) {
    processEventMap[process.pid] = new Map();
    eventMap = processEventMap[process.pid];
    processedEvents.value.forEach(event => {
      eventMap.set(event.id, event);
    });
  }

  // 获取所有在路径中的相关节点（祖先 + 自身 + 子孙）
  const allRelevantIds = new Set(Array.from(highlightedPaths));

  // 遍历当前进程中的所有事件，绘制依赖线
  for (const [threadKey, thread] of process.threads.entries()) {
    for (const event of thread.events) {
      if (!allRelevantIds.has(event.id)) continue;

      // 遍历所有后继
      for (const succId of event.dependencies.successors) {
        if (allRelevantIds.has(succId)) {
          const toEvent = eventMap.get(succId);
          if (toEvent && toEvent.renderInfo && event.renderInfo) {
            // 只绘制同一进程内的依赖线
            if (toEvent.renderInfo.processKey === event.renderInfo.processKey) {
              drawArrow(
                ctx,
                event.renderInfo.x + event.renderInfo.width,
                event.renderInfo.y + event.renderInfo.height / 2,
                toEvent.renderInfo.x,
                toEvent.renderInfo.y + toEvent.renderInfo.height / 2
              );
            }
          }
        }
      }
    }
  }
};

const drawArrow = (ctx, startX, startY, endX, endY) => {
  let cp1x = startX;
  let cp1y = startY;
  let cp2x = endX;
  let cp2y = endY;
  const endXLine = endX - 10;

  if (Math.abs(startX - endX) > 0.01 * ctx.canvas.width)
  {
    cp1x = startX + 0.03 * ctx.canvas.width;
    cp2x = endX - 0.03 * ctx.canvas.width;
  }
  
  if (Math.abs(startY - endY) > 0.01 * ctx.canvas.height)
  {
    cp1y = startY - 0.01 * ctx.canvas.height;
    cp2y = endY + 0.01 * ctx.canvas.height;
  }
  
  if (Math.abs(startX - endXLine) < 50) {
    cp2x = endX - 50;
  } else {
    cp2x = endX - 0.03 * ctx.canvas.width;
  }

  const pixel1 = ctx.getImageData(startX-1, startY, 1, 1).data;
  const pixel2 = ctx.getImageData(endX+1, endY, 1, 1).data;
  const color1 = `rgba(${pixel1[0]}, ${pixel1[1]}, ${pixel1[2]}, 1)`;
  const color2 = `rgba(${pixel2[0]}, ${pixel2[1]}, ${pixel2[2]}, 1)`;

  const gradient = ctx.createLinearGradient(startX, startY, endXLine, endY);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);

  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endXLine, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endXLine, endY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const arrowLength = 10;
  const arrowAngle = Math.PI / 6;
  const arrowTipX = endX;
  const arrowTipY = endY;
  const arrowVertex1X = arrowTipX - arrowLength * Math.cos(-arrowAngle);
  const arrowVertex1Y = arrowTipY - arrowLength * Math.sin(-arrowAngle);
  const arrowVertex2X = arrowTipX - arrowLength * Math.cos(arrowAngle);
  const arrowVertex2Y = arrowTipY - arrowLength * Math.sin(arrowAngle);

  ctx.strokeStyle = color2;
  ctx.beginPath();
  ctx.moveTo(arrowTipX, arrowTipY);
  ctx.lineTo(arrowVertex1X, arrowVertex1Y);
  ctx.lineTo(arrowVertex2X, arrowVertex2Y);
  ctx.closePath();

  ctx.fillStyle = color2;
  ctx.fill();
};

const fixedTimeToX = (time) => {
  if (!fixedtimelineCanvas.value) return 0;

  const canvasWidth = fixedtimelineCanvas.value.width;
  const relativeTime = time - viewState.minTime;
  const normalizedTime = relativeTime / viewState.timeRange;
  return layout.processLabelWidth + (normalizedTime * canvasWidth);
};

const fixedXToTime = (x) => {
  if (!fixedtimelineCanvas.value) return 0;

  const canvasWidth = fixedtimelineCanvas.value.width;
  const normalizedTime = (x - layout.processLabelWidth) / canvasWidth;
  return viewState.minTime + (normalizedTime * viewState.timeRange);
};

const timeToX = (time) => {
  if (!timelineCanvas.value) return 0;

  const canvasWidth = timelineCanvas.value.width;
  const relativeTime = time - viewState.minTime;
  const normalizedTime = relativeTime / viewState.timeRange;
  return layout.processLabelWidth + (normalizedTime * canvasWidth * viewState.scale) + viewState.offsetX;
};

const durationToWidth = (duration) => {
  if (!timelineCanvas.value) return 0;

  const canvasWidth = timelineCanvas.value.width;
  const normalizedDuration = duration / viewState.timeRange;
  return normalizedDuration * canvasWidth * viewState.scale;
};

const handleCanvasClick = (e, processKey) => {
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  if (!canvasRef) {
    console.warn(`Canvas for process ${processKey} not found during click handling`);
    return;
  }

  const rect = canvasRef.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 检查是否点击了事件
  const clickedEvent = findEventAtPosition(x, y, processKey)?.event;
  canvasclickedEvent.value = clickedEvent;
  if (clickedEvent) {
     if(e.altKey){
      measureDistance(clickedEvent, processKey);
     } else {
      selectEvent(clickedEvent);
     }
  } else {
    selectedEvent.value = null;
    highlightedPaths.clear();
    detailsPanelExpanded.value = false;
    render();
  }
};

const findEventAtPosition = (x, y, processKey) => {
    let processObj = {
      event: null,
      altClickData: {
        preData: null,
        lastData: null,
        nodeSpacingX: 0
      },
    };
    const process = processes.get(processKey);
    if (!process) return null;
  
    // 遍历进程中的所有事件，检查点击位置
    for (const [threadKey, thread] of process.threads.entries()) {
      // 优化: 先确定目标位置的y坐标是否在当前泳道中,如果不在,及时返回
      const temp = thread.events[0];
      if (!temp) {
        continue;
      }
      const label = `${processKey}@${thread.tid}`;
      const lineCount = lane2line.get(label) || 1;
      if (temp.renderInfo) {
        const minY = temp.renderInfo.y;
        const maxY = minY + layout.threadHeight * lineCount;
        if (y < minY || y > maxY) {
          continue;
        }
      }
      thread.events.forEach((event, index) => {
        if (event.renderInfo) {
          const { x: eventX, y: eventY, width: eventWidth, height: eventHeight } = event.renderInfo;
          if (x >= eventX && x <= eventX + eventWidth &&
            y >= eventY && y <= eventY + eventHeight) {
            processObj.event = event;
            return processObj;
          } else {
            const nextEvent = thread.events[index + 1];
            if(nextEvent){
              const { x: nextEventX } = nextEvent.renderInfo;
              if (x >= eventX + eventWidth && x <= nextEventX) {
                processObj.altClickData.preData = event;
                processObj.altClickData.lastData = nextEvent;
                processObj.altClickData.nodeSpacingX = nextEventX - (eventX + eventWidth);
                return processObj;
              }
            }
          }
        }
      });
    }
  
    return processObj;
  };

const toggleProcess = (processKey) => {
  const isExpanded = processExpanded.get(processKey);
  processExpanded.set(processKey, !isExpanded);

  // 确保process存在再设置expanded属性
  const process = processes.get(processKey);
  if (process) {
    process.expanded = !isExpanded;
  }

  if (isExpanded || expandedProcess.includes(processKey)) {
    return;
  }

  nextTick(() => {
    resizeCanvases();
    render(); // 确保重新渲染
  });
};
const clearDrawConnector = (ctx, processKey) => {
    const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    altClickData = {
      preData: null,
      lastData: null,
      largeSpacing: false
    };
  }
  const drawConnector = (ctx, largeSpacing) => {
    const rect = calculateRect(ctx , largeSpacing);
    // 填充矩形
    ctx.fillStyle = '#3f64ae';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px sans-serif';
    ctx.fillText(rect.text, rect.textX, rect.textY);
    // 绘制双向箭头
    if(largeSpacing){
      drawDoubleArrow(rect, ctx);
    }
  };
  const drawDiffConnector = (ctx, largeSpacing) => {
    const rect = calculateDiffRect(largeSpacing);
    // 填充矩形
    ctx.fillStyle = '#3f64ae';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px sans-serif';
    ctx.fillText(rect.text, rect.textX, rect.textY);
    if(!largeSpacing){
      return;
    }
    // 绘制线水平实线部分
    ctx.beginPath();
    const {x: preX, y: preY, width: preWidth, height: preHeight}  = altClickData.preData.renderInfo;
    const {x: lastX, y: lastY}  = altClickData.lastData.renderInfo;
    const leftLineWidth = lastX;
    const leftLineHeight = preY + preHeight /2;
    ctx.moveTo(preX + preWidth, leftLineHeight ); 
    ctx.lineTo(leftLineWidth, leftLineHeight);
    ctx.strokeStyle = '#3f64ae';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 左侧箭头头部
    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(preX + preWidth, preY + preHeight /2);
    ctx.lineTo(preX + preWidth + arrowSize, leftLineHeight - arrowSize / 2);
    ctx.lineTo(preX + preWidth + arrowSize, leftLineHeight + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = '#3f64ae';
    ctx.fill();
    // 垂直虚线部分（从水平线末端垂直延伸到第二个节点）
    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    ctx.moveTo(lastX, preY + preHeight /2);
    ctx.lineTo(lastX, lastY + preHeight /2);
    ctx.strokeStyle = '#3f64ae';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    // 右侧箭头头部
    ctx.beginPath();
    ctx.moveTo(lastX , preY + preHeight /2);
    ctx.lineTo(lastX - arrowSize + 1, leftLineHeight - arrowSize / 2);
    ctx.lineTo(lastX - arrowSize + 1, leftLineHeight + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = '#3f64ae';
    ctx.fill();
  };
  // 绘制双箭头
  const drawDoubleArrow = (rect, ctx) => {
    const arrowSize = 8;
  
    // 左侧箭头（指向左边）
    const leftLineWidth = rect.x - rect.arrowWidth ;
    const rightLineWidth = rect.x + rect.width + rect.arrowWidth ;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.centerY); 
    ctx.lineTo(leftLineWidth, rect.centerY);
    ctx.strokeStyle = '#3f64ae';
    ctx.lineWidth = 2;
    ctx.stroke();
  
    // 左侧箭头头部
    ctx.beginPath();
    ctx.moveTo(leftLineWidth, rect.centerY);
    ctx.lineTo(leftLineWidth + arrowSize, rect.centerY - arrowSize / 2);
    ctx.lineTo(leftLineWidth + arrowSize, rect.centerY + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = '#3f64ae';
    ctx.fill();
  
    // 右侧箭头（指向右边）
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.width, rect.centerY);
    ctx.lineTo(rightLineWidth , rect.centerY);
    ctx.strokeStyle = '#3f64ae';
    ctx.lineWidth = 2;
    ctx.stroke();
  
    // 右侧箭头头部
    ctx.beginPath();
    ctx.moveTo(rightLineWidth, rect.centerY);
    ctx.lineTo(rightLineWidth - arrowSize + 1, rect.centerY - arrowSize / 2);
    ctx.lineTo(rightLineWidth - arrowSize + 1, rect.centerY + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = '#3f64ae';
    ctx.fill();
  };
  // 计算矩形位置
  const calculateRect = (ctx, largeSpacing) => {
    let { x: preX, width: preWidth, y: preY, height: preHeight } = altClickData.preData.renderInfo;
    if(!largeSpacing){
      preY = preY < layout.threadHeight ? preY + layout.threadHeight : preY - layout.threadHeight;
     }
    const { x: lastX } = altClickData.lastData.renderInfo;
    const width = 40;
    const height = preHeight;
    const centerY = preY + height / 2;
    const text = getMeasureDistance(altClickData);
    return {
      x: (preX + preWidth) + (lastX - (preX + preWidth) - width) / 2,
      y: preY,
      width: width,
      height: height,
      centerX: (preX + preWidth) + (lastX - (preX + preWidth) - width) / 2 + (width / 2 - text.length) / 2,
      centerY: centerY,
      textX: (preX + preWidth) + (lastX - (preX + preWidth) - width) / 2 + (width / 2 - text.length) / 2,
      textY: centerY + 3,
      text: text,
      arrowWidth: (lastX - (preX + preWidth) - width - 6) / 2
    };
  };
  
  const calculateDiffRect = (largeSpacing) => {
    let { x: preX, width: preWidth, y: preY, height: preHeight } = altClickData.preData.renderInfo;
    if(!largeSpacing){
      preY = preY < layout.threadHeight ? preY + layout.threadHeight : preY - layout.threadHeight;
     }
    const { x: lastX} = altClickData.lastData.renderInfo;
    const width = 40;
    const height = preHeight;
    const centerY = preY + height / 2;
    const text = getMeasureDistance(altClickData);
    return {
      x: preX + preWidth + (lastX- (preX + preWidth)) / 2,
      y: preY + height,
      width: width,
      height: height,
      textX: preX + preWidth + (lastX- (preX + preWidth)) / 2 + (width / 2 - text.length) / 2,
      textY: centerY + height + 3,
      text: text,
    };
  };
  const getMeasureDistance = (altClickData) => {
    const time = Math.abs(altClickData.lastData.startTime - altClickData.preData.endTime);
    const timeInfo = formatTimeWithUnit(time);
    return timeInfo.value + timeInfo.unit;
  };
  const measureDistance = (event, processKey) => {
    const uiCanvasRef = document.querySelector(`[ui-data-process-key="${processKey}"]`);
    const uiCtx = uiCanvasRef.getContext('2d');
    uiCtx.strokeStyle = "#FFFFFF";
    uiCtx.lineWidth = 1;
    const {x ,y , width, height} = event.renderInfo;
    uiCtx.strokeRect(x, y, width,height); 
    if(altClickData.preData && altClickData.lastData){
        clearDrawConnector(uiCtx, processKey);
    }
    if(!altClickData.preData){
     altClickData.preData = event;
    } else {
      altClickData.lastData = event;
    }
    if(altClickData.preData && altClickData.lastData){
      const { renderInfo: preRenderInfo } = altClickData.preData;
      const { renderInfo: lastRenderInfo } = altClickData.lastData;
      const { x: preX, y: preY} = preRenderInfo;
      const { x: lastX, y: lastY} = lastRenderInfo;
      const nodeSpacingX = Math.abs(lastX - preX);
      if(nodeSpacingX < 3) return;
      let largeSpacing = nodeSpacingX > 40;
      // 同泳道
      if(lastY === preY){
        drawConnector(uiCtx, largeSpacing);
      } else {
        if(lastX < preX){
          for(const key in preRenderInfo){
            [preRenderInfo[key], lastRenderInfo[key]] =  [lastRenderInfo[key], preRenderInfo[key]];
          }
        }
        largeSpacing = nodeSpacingX > 80;
        drawDiffConnector(uiCtx, largeSpacing);
      }
    }
  }
const selectEvent = (event) => {
  selectedEvent.value = event;
  calculateHighlightedPaths(event);
  showDetailsPanel();
  showDependencies(event, "both");
  render();
};

const showDependencies = (event, type) => {
  const displayName = event.isCounter ? event.displayName : (event.name || 'Event');
  const predecessors = event.dependencies.predecessors.map(id =>
      processedEvents.value.find(e => e.id === id)
  ).filter(e => e);

  const successors = event.dependencies.successors.map(id =>
      processedEvents.value.find(e => e.id === id)
  ).filter(e => e);
  const canvas = document.getElementById('dependency-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const canvasWidth = 400;
  const canvasHeight = Math.max(186, 20 * (Math.max(predecessors.length, successors.length) + 1));
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  function overflowText(text) {
    let textWidth = ctx.measureText(text).width;
    const widthPerChar = textWidth / text.length;

    let actualWidth = 80;

    let maxCharsToFit = Math.floor(actualWidth / widthPerChar);
    
    let displayText = '';
    if (textWidth >= actualWidth && maxCharsToFit > 3) {
      maxCharsToFit -= 3;
      displayText = text.substr(0, maxCharsToFit) + '...';
    } else if (textWidth < actualWidth) {
      displayText = text;
    }

    let textStartX = (actualWidth - ctx.measureText(displayText).width) / 2;
    return [displayText, textStartX];
  }
  function drawGraph(showMode) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const currentNode = {
          x:canvas.width / 2 - 40,
          y:10,
          width:80,
          height:16,
      }
      ctx.fillStyle = 'rgba(10, 89, 247, 0.3)';
      ctx.roundRect(currentNode.x, currentNode.y, currentNode.width, currentNode.height, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(179,179,179,1)';
      ctx.font = '12px Arial';
      let [displayText, leftspace] = overflowText(displayName);
      ctx.fillText(displayText, currentNode.x + leftspace, currentNode.y + 12);
      if(showMode === "forward" || showMode === "both") {
          predecessors.forEach((pre, index) => {
              const preNode = {
                  x:0,
                  y:10 + index * 20,
                  width:80,
                  height:16,
              }
              ctx.beginPath();
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.roundRect(preNode.x, preNode.y, preNode.width, preNode.height, 4);
              ctx.fill();
              ctx.closePath();
              ctx.fillStyle = 'rgba(179,179,179,1)';
              ctx.font = '12px Arial';
              let [displayText, leftspace] = overflowText(pre.isCounter ? pre.displayName:(pre.name || 'Event'));
              ctx.fillText(displayText, preNode.x + leftspace, preNode.y + 12);
              ctx.beginPath();
              ctx.moveTo(currentNode.x, currentNode.y + currentNode.height / 2);
              ctx.bezierCurveTo(currentNode.x + 5, 
                                currentNode.y + currentNode.height / 2 + 5,
                                preNode.x + preNode.width, 
                                preNode.y + preNode.height / 2 + 5,
                                preNode.x + preNode.width,
                                preNode.y + preNode.height / 2);
              ctx.strokeStyle = 'rgba(10,89,247,0.3)';
              ctx.lineWidth = 0.8;
              ctx.stroke();
          });
      }
      if(showMode === "backward" || showMode === "both") {
          successors.forEach((dep, index) => {
              const depNode = {
                  x:320,
                  y:10 + index * 20,
                  width:80,
                  height:16,
              };
              ctx.beginPath();
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.roundRect(depNode.x, depNode.y, depNode.width, depNode.height, 4);
              ctx.fill();
              ctx.closePath();
              ctx.fillStyle = 'rgba(179,179,179,1)';
              ctx.font = '12px Arial';
              let [displayText, leftspace] = overflowText(dep.isCounter ? dep.displayName:(dep.name || 'Event'));
              ctx.fillText(displayText, depNode.x + leftspace, depNode.y + 12);
              ctx.beginPath();
              ctx.moveTo(currentNode.x + currentNode.width, currentNode.y + currentNode.height / 2);
              ctx.bezierCurveTo(currentNode.x + currentNode.width, 
                                currentNode.y + currentNode.height / 2 + 5,
                                depNode.x, 
                                depNode.y + depNode.height / 2 + 5,
                                depNode.x,
                                depNode.y + depNode.height / 2);
              ctx.strokeStyle = 'rgba(10,89,247,0.3)';
              ctx.lineWidth = 0.8;
              ctx.stroke();
          });
      }
  }
  drawGraph(type);
};

const calculateHighlightedPaths = (event) => {
  if (!Object.keys(id2event).length) {
    processedEvents.value.forEach(element => {
      id2event[element.id] = element;
    });
  }
  highlightedPaths.clear();

  // 获取事件位置的辅助函数
  const getEventById = (eventId) => id2event[eventId];

  // 添加所有前置依赖（包括自身）
  let visited = new Set();
  const addAllAncestors = (eventId) => {
    if (visited.has(eventId)) {
      return;
    }
    visited.add(eventId);
    let currentEvent = getEventById(eventId);
    if (currentEvent) {
      highlightedPaths.add(currentEvent.id); // 高亮当前节点
      currentEvent.dependencies.predecessors.forEach(predId => {
        addAllAncestors(predId); // 递归处理前驱
      });
    }
  };

  // 添加所有后续依赖（包括自身）
  const addAllDescendants = (eventId) => {
    if (visited.has(eventId)) {
      return;
    }
    visited.add(eventId);
    let currentEvent = getEventById(eventId);
    if (currentEvent) {
      highlightedPaths.add(currentEvent.id); // 高亮当前节点
      currentEvent.dependencies.successors.forEach(succId => {
        addAllDescendants(succId); // 递归处理后继
      });
    }
  };

  // 从选定事件开始，分别向前后端递归查找
  addAllAncestors(event.id);
  visited = new Set();
  addAllDescendants(event.id);

  // 确保选择的事件本身也被高亮显示
  highlightedPaths.add(event.id);
};

const getEventDisplayName = (event) => {
  return event.isCounter ? event.displayName : (event.name || 'Event');
};

const showDetailsPanel = () => {
  detailsPanelExpanded.value = true;
};

const hideDetailsPanel = () => {
  detailsPanelExpanded.value = false;
};

const toggleDetailsPanel = () => {
  detailsPanelExpanded.value = !detailsPanelExpanded.value;
};

const timelineMouseDown = (e) => {
  if (!fixedtimelineCtx.value || !fixedtimelineCanvas.value) return;
  const rect = fixedtimelineCanvas.value.getBoundingClientRect();
  
  const mouseX = e.clientX - rect.left;
  timelineInitX = mouseX;
  lastPostion = mouseX;
  timelineInitStartX = timelineState.startTimeX;
  timelineInitEndX = timelineState.endTimeX;

  if (Math.abs(mouseX - timelineInitStartX) < 5){
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'ew-resize';
    timelineState.isInLeftTag = true;
    return;
  }

  if (Math.abs(mouseX - timelineInitEndX) < 5){
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'ew-resize';
    timelineState.isInRightTag = true;
    return;
  }

  if (mouseX > timelineInitStartX && mouseX < timelineInitEndX) {
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'move';
    timelineState.isOnTag = true;
    return;
  }

  if (mouseX < timelineInitStartX || mouseX > timelineInitEndX) {
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'crosshair';
    timelineState.isOutTag = true;
    return;
  }
}

const timelineMouseMove = (e) => {
  if (!isTimelineDragging) return;
  const rect = fixedtimelineCanvas.value.getBoundingClientRect();
  const canvasWidth = fixedtimelineCanvas.value.width;
  const mouseX = e.clientX - rect.left;
  const timelineOffsetX = mouseX - timelineInitX;
  let startTime = 0;

  if (timelineState.isInLeftTag === true) {
    viewState.scale = canvasWidth / Math.abs(timelineInitEndX - mouseX);
    startTime = fixedXToTime(mouseX + layout.processLabelWidth);
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    // 同步范围滑块变化
    let scaleValue = viewState.scale * 10;
    const roundedValue = Math.round(scaleValue);
    sliderValue.value = parseInt(roundedValue, 10);
    render();
    return;
  }

  if (timelineState.isInRightTag === true) {
    viewState.scale = canvasWidth / Math.abs(mouseX - timelineInitStartX);
    startTime = fixedXToTime(timelineInitStartX + layout.processLabelWidth);
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    // 同步范围滑块变化
    let scaleValue = viewState.scale * 10;
    const roundedValue = Math.round(scaleValue);
    sliderValue.value = parseInt(roundedValue, 10);
    render();
    return;
  }

  if (timelineState.isOnTag === true) {
    const onTagTimerange = mouseX - timelineInitX;
    startTime = fixedXToTime(timelineInitStartX + onTagTimerange + layout.processLabelWidth);
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    if (viewState.offsetX > 0) {
      viewState.offsetX = 0;
      render();
      return;
    }
    if (timelineState.endTimeX > canvasWidth) {
      if (mouseX - lastPostion > 0) {
        lastPostion = mouseX;
        return;
      }
      lastPostion = mouseX;
    }
    render();
    return;
  }

  if (timelineState.isOutTag === true) {
    viewState.scale = canvasWidth / Math.abs(timelineOffsetX);
    startTime = fixedXToTime(timelineInitX + layout.processLabelWidth);
    if (timelineOffsetX < 0){
      startTime = fixedXToTime(mouseX + layout.processLabelWidth);
    }
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    // 同步范围滑块变化
    let scaleValue = viewState.scale * 10;
    const roundedValue = Math.round(scaleValue);
    sliderValue.value = parseInt(roundedValue, 10);
    render();
    return;
  }
}

const timelineMouseUp = () => {
  fixedtimelineCanvas.value.style.cursor = 'default';
  isTimelineDragging = false;
  timelineState.isInLeftTag = false;
  timelineState.isInRightTag = false;
  timelineState.isOnTag = false;
  timelineState.isOutTag = false;
  timelineInitX = 0;
  timelineInitStartX = timelineState.startTimeX;
  timelineInitEndX = timelineState.endTimeX;
}

const handleMouseDown = (e, processKey) => {
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  if (!e.ctrlKey || !canvasRef) return;
  isDragging = true;
  lastX = e.clientX;
  canvasRef.style.cursor = 'grabbing';
};

const handleMouseUp = (e, processKey) => {
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  if (!e.ctrlKey || !canvasRef) return;
  isDragging = false;
  canvasRef.style.cursor = 'grab';
};

const handleMouseMove = throttle((e, processKey) => {
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  if (!canvasRef) return;
  const uiCanvasRef = document.querySelector(`[ui-data-process-key="${processKey}"]`);
    if (!uiCanvasRef) return;
    const uiCtx = uiCanvasRef.getContext('2d');
    if(altClickData.preData && altClickData.lastData){
        clearDrawConnector(uiCtx, processKey);
    }
  mousePosition = {
    x: e.clientX,
    y: e.clientY
  };
  const rect = canvasRef.getBoundingClientRect();
  const x = mousePosition.x - rect.left;
  const y = mousePosition.y - rect.top;

  const hoveredEvent = findEventAtPosition(x, y, processKey)?.event;
  const altClickDataTemp = findEventAtPosition(x, y, processKey)?.altClickData;
    if (altClickDataTemp.preData && altClickDataTemp.lastData && !e.altKey && altClickDataTemp.nodeSpacingX > 3) {
      if(altClickDataTemp.lastData?.renderInfo?.x < canvasRef.width && altClickDataTemp.preData?.renderInfo?.x +  altClickDataTemp.preData?.renderInfo?.width > 0 ){
        altClickData = {
        preData: altClickDataTemp.preData,
        lastData: altClickDataTemp.lastData,
        largeSpacing: altClickDataTemp.nodeSpacingX > 40
        };
        drawConnector(uiCtx, altClickData.largeSpacing);
      }
    }
  if (hoveredEvent && !e.altKey) {
    showTooltip(e, hoveredEvent, canvasRef);
    canvasRef.style.cursor = 'pointer';
  } else {
    canvasRef.style.cursor = isDragging ? 'grab' : '';
    hideTooltip();
  }

  if (isDragging && e.ctrlKey) {
    if (viewState.scale === 1) return;
    const timeLineEndX = Math.abs(timeLineX.value);
    const deltaX = (e.clientX - lastX);
    if (deltaX < 0 && timelineCanvas.value.width > timeLineEndX) {
      return;
    }
    viewState.offsetX += deltaX / viewState.scale;
    if (deltaX > 0 && viewState.offsetX > 0) {
      viewState.offsetX = 0;
    }
    render();
  }
}, 16);

const showTooltip = (e, event, canvasRef) => {
  if (!tooltip.value) return;

  const displayName = event.isCounter ? event.displayName : (event.name || 'Event');
  let tooltipContent = `<div class="tooltip-container">`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("title")}</span><span class="tooltip-value">${displayName}</span></div>`;
  if(event.cat){
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("categroy")}</span><span class="tooltip-value">${event.cat}</span></div>`;
  }
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("start")}</span><span class="tooltip-value">${formatTimeWithUnit(event.startTime - viewState.minTime).value}${formatTimeWithUnit(event.startTime - viewState.minTime).unit}</span></div>`;
  if (event.isCounter) {
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("countValue")}</span><span class="tooltip-value">${event.counterSize}</span></div>`;
  } else {
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("duration")}</span><span class="tooltip-value">${formatTimeWithUnit(event.duration).value}${formatTimeWithUnit(event.duration).unit}</span></div>`;
  }
  tooltipContent += "</div>"; 
  tooltip.value.innerHTML = tooltipContent;
  tooltipStyle.display = 'block';
  if(event.renderInfo.x + 200  > canvasRef.width){
     tooltipStyle.left = (e.clientX - 100) + 'px';
  } else {
      tooltipStyle.left = (e.clientX + 10) + 'px';
  }
  tooltipStyle.top = (e.clientY - 10) + 'px';
};

const hideTooltip = () => {
  tooltipStyle.display = 'none';
};

const handleWheel = (e) => {
  const isZooming = e.ctrlKey;

  if (!timelineCanvas.value) return;

  let rect = timeContainerRect.value;
  if (!rect) {
    timeContainerRect.value = swimlaneContainer.value.getBoundingClientRect();
    rect = timeContainerRect.value;
  }
  const mouseX = e.clientX - rect.left;

  // 如果没有按住 ctrl 键，则允许默认滚动行为（不阻止事件）
  if (!isZooming) {
    return;
  }

  const zoomFactor = e.deltaY > 0 ? 0.8 : 1.2;
  const oldScale = viewState.scale;
  
  if (e.deltaY > 0 && viewState.scale * zoomFactor < initialScale.value) {
    viewState.scale = initialScale.value;
  } else {
    viewState.scale = Math.max(initialScale.value, Math.min(sliderMax.value / 10, viewState.scale * zoomFactor));
  }
 
  const scaleValue = viewState.scale * 10;
  const roundedValue = Math.round(scaleValue);
  sliderValue.value = parseInt(roundedValue, 10);
  const scaleChange = viewState.scale / oldScale;
  viewState.offsetX = mouseX - (mouseX - viewState.offsetX) * scaleChange;
  const timeLineEndX = Math.abs(timeLineX.value);
  if(timelineCanvas.value.width > timeLineEndX){
    const tempOffsetX = timelineCanvas.value.width - timeLineEndX;
    viewState.offsetX += tempOffsetX;
  }
  if (viewState.offsetX > 0) {
    viewState.offsetX = 0;
  }

  render();
};

const updataScale = () => {
  const scale = sliderValue.value / 10;
  const scaleChange = scale / viewState.scale;
  viewState.offsetX = viewState.offsetX * scaleChange;
  const timeLineEndX = Math.abs(timeLineX.value);
  if(timelineCanvas.value.width > timeLineEndX){
    const tempOffsetX = timelineCanvas.value.width - timeLineEndX;
    viewState.offsetX += tempOffsetX;
  }
  if (viewState.offsetX > 0) {
    viewState.offsetX = 0;
  }
  
  viewState.scale = sliderValue.value / 10;
  render();
};

const increase = () => {
  if (sliderValue.value < sliderMax.value) {
    sliderValue.value *= 1.2;
    updataScale();
  }
};

const decrease = () => {
  if (sliderValue.value > 10) {
    sliderValue.value *= 0.8;
    updataScale();
  }
};

const leftmove = () => {
  if (viewState.scale === 1) {
    return;
  } else {
    const timeLineEndX = Math.abs(timeLineX.value);
    if (timelineCanvas.value.width > timeLineEndX) {
      return;
    }
    viewState.offsetX -= 30;
    render();
  }
};

const rightmove = () => {
  if (viewState.scale === 1) {
    return;
  } else {
    viewState.offsetX += 30;
    if (viewState.offsetX > 0) {
      viewState.offsetX = 0;
      render();
      return;
    }
    render();
  } 
};

const resetZoom = () => {
  viewState.scale = 1;
  viewState.offsetX = 0;
  viewState.offsetY = 0;
  render();
};

const toggleDetailsCores = () => {
  detailsCoresExpanded.value = !detailsCoresExpanded.value;
};

const scaleCanvas = (mouseX, scale) => {
  const oldScale = viewState.scale;
  
  if (viewState.scale * scale < initialScale.value) {
    viewState.scale = initialScale.value;
  } else {
    viewState.scale = Math.max(initialScale.value, Math.min(sliderMax.value / 10, viewState.scale * scale));
  }
 
  const scaleValue = viewState.scale * 10;
  const roundedValue = Math.round(scaleValue);
  sliderValue.value = parseInt(roundedValue, 10);
  const scaleChange = viewState.scale / oldScale;
  viewState.offsetX = mouseX - (mouseX - viewState.offsetX) * scaleChange;
  const timeLineEndX = Math.abs(timeLineX.value);
  if(timelineCanvas.value.width > timeLineEndX){
    const tempOffsetX = timelineCanvas.value.width - timeLineEndX;
    viewState.offsetX += tempOffsetX;
  }
  if (viewState.offsetX > 0) {
    viewState.offsetX = 0;
  }

  render();
};

let mousePosition = null;
const handlekeydown = (event, processKey) => {
  const key = event.key.toLowerCase();
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  if (!canvasRef) return;
  const scaleStep = 0.1;
  const moveStep = 50;
  if(!timelineCanvas.value) return;
  const rect = timelineCanvas.value.getBoundingClientRect();
  const mouseX = mousePosition.x - rect.left;
  const mouseY = mousePosition.y - rect.top;
  if(mouseX < 0 || mouseY < 0 || mouseX > canvasRef.width || mouseY > canvasRef.height) {
    console.log('the mouse is not on the canvas');
    return;
  }
  switch(key) {
    case '+':
    case '=':
      scaleCanvas(mouseX, 1 + scaleStep);
      break;
    case '-':
      scaleCanvas(mouseX, 1 - scaleStep);
      break;
    case 'w':
      scrollCanvas(-moveStep);
      break;
    case 's':
      scrollCanvas(moveStep);
      break;
    case 'a':
      leftmove();
      break;
    case 'd':
      rightmove();
      break;
  }
}

const scrollCanvas = (deltaY) => {
  swimlaneContainer.value.scrollTo({
    top: swimlaneContainer.value.scrollTop + deltaY,
    behavior: 'smooth'}
    );
}

function releventShowPre(evnet) {
  showPreNode.value = true;
  showNextNode.value = false;
  rerender(canvasclickedEvent.value, "both");
  releventDisplay.value = "pre";
}
function releventShowAll(evnet) {
  showPreNode.value = true;
  showNextNode.value = true;
  rerender(canvasclickedEvent.value, "both");
  releventDisplay.value = "all";
}
function releventShowNext(evnet) {
  showPreNode.value = false;
  showNextNode.value = true;
  rerender(canvasclickedEvent.value, "both");
  releventDisplay.value = "next";
}

function rerender(evnet, showtype){
  calculateHighlightedPaths(evnet);
  showDetailsPanel();
  showDependencies(evnet, showtype);
  render();
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

// 为每个进程的事件画布添加事件监听器
const setupEventCanvasListeners = () => {
  for (const [processKey, process] of processes.entries()) {
    if (processExpanded.get(processKey)) {
      const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
      if (canvasRef) {
        document.addEventListener('keydown', (e) => {
          handlekeydown(e, processKey)
        });
      }
    }
  }
};

// 生命周期钩子
onMounted(() => {
  fixedtimelineCtx.value = fixedtimelineCanvas.value.getContext('2d');
  timelineCtx.value = timelineCanvas.value.getContext('2d');
  initEventListeners();
  postMessage({ command: 'getSwimData' });
});

// 监听进程展开状态变化，重新设置事件监听器
watch(processExpanded, () => {
  nextTick(() => {
    setupEventCanvasListeners();
  });
});

// 监听窗口大小变化
watch(
  () => [swimlaneContainer.value?.clientWidth, swimlaneContainer.value?.clientHeight],
  () => {
    resizeCanvases();
    render();
  }
);
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.zoom-controls {
  height: 60px;
  background: #1F1F1F;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 10px;
}

.left-container {
  display: flex;
  align-items: center;
  gap: 20px;
}

.right-container {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}

.slider-container {
  width: 184px;
  height: 28px;
  display: flex;
  gap: 5px;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  justify-content: space-around;
}

.slider-wrapper {
  position: reactive;
}

.right-container-buttor {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.swimlane-container {
  flex: 1;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  background: #252526;
}

/* 一段时间轴区域 */
.fixed-timeline-area {
  display: flex;
  position: sticky;
  top: 0;
  height: 30px;
  z-index: 11;
  background: #252526;
}

.fixed-timeline-placeholder {
  background: #2d2d30;
  border-right: 1px solid #3e3e42;
}

.fixed-timeline-canvas {
  height: 30px;
}

/* 二段时间轴区域 */
.timeline-area {
  position: sticky;
  top: 30px;
  display: flex;
  height: 50px;
  z-index: 10;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.timeline-placeholder {
  background: #2d2d30;
  border-right: 1px solid #3e3e42;
}

.timeline-canvas {
  height: 50px;
}

/* 进程和线程区域 */
.processes-container {
  display: flex;
  flex-direction: column;
}

.process-section {
  margin-bottom: 5px;
}

.process-header {
  display: flex;
  height: 30px;
  cursor: pointer;
}

.process-header-label {
  background: #2d2d30;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  color: #cccccc;
  border-right: 1px solid #3e3e42;
}

.process-header:hover .process-header-label {
  background: #3e3e42;
}

.process-header-line {
  flex: 1;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.expand-icon {
  margin-right: 5px;
  font-family: monospace;
  font-weight: bold;
  width: 12px;
  text-align: center;
}

.threads-container {
  display: flex;
}

.thread-labels {
  background: #1F1F1F;
  border-right: 1px solid #3e3e42;
}

.thread-label {
  display: flex;
  align-items: center;
  padding-left: 20px;
  font-size: 13px;
  color: #999999;
  border-bottom: 1px solid #3e3e42;
}

.thread-events {
  flex: 1;
  position: relative;
}

.events-canvas {
  position: absolute;
  top: 0;
  left: 0;
}
.ui-events-canvas {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }
.details-cores {
  visibility: hidden;
  height: 0;
  width: 0;
  position: fixed;
  right: 0;
  top: 60px;
  background-color: #1e1e1e;
  border-left: 1px solid #ccc;
  padding: 10px;
}

.details-cores.expanded {
  visibility: visible;
  height: 100%;
  width: 300px;
}

.details-panel {
  height: 0;
  background: #1e1e1e;
  border-top: 1px solid #3e3e42;
  overflow: hidden;
  transition: height 0.3s ease;
}

.details-panel.expanded {
  height: 218px;
}

.details-header {
  height: 30px;
  background: #2d2d30;
  display: flex;
  align-items: center;
  padding: 0 10px;
  cursor: pointer;
  border-bottom: 1px solid #3e3e42;
}

.details-header:hover {
  background: #3e3e42;
}

.details-toggle {
  margin-left: auto;
  font-size: 12px;
}

.detail-content {
  display: flex;
  align-items: flex-start;
  min-width: 1569px;
  height: 218px;
  border-radius: 16px;
  box-shadow: 0px 10px 70px 0px rgba(0, 0, 0, 0.5);
  background: rgba(38, 38, 38, 1);
}

.content-one {
  width: 300px;
  height: 186px;
  display: flex;
  gap: 7px;
  border-radius: 16px;
  background-color: rgba(255, 255, 255, 0.05);
  margin-left: 16px;
  margin-top: 16px;
  margin-bottom: 16px;
  padding-right: 16px;
}

.content-title {
  margin-left: 16px;
  margin-top: 16px;
  margin-bottom: 16px;
}

.picture {
  width: 48px;
  height: 48px;
}

.left {
  width: 16px;
  height: 16px;
}

.right {
  width: 16px;
  height: 16px;
}

.all {
  width: 16px;
  height: 16px;
}

.title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cate {
  margin: 16px 0;
}

.Title {
  width: 34px;
  height: 24px;
  flex-direction: row;
  align-items: center;
  color: rgba(230, 230, 230, 1);
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0px;
  text-align: left;
}

.Title-value {
  border-radius: 4px;
  padding: 0 2px;
  background: rgba(10, 89, 247, 0.3);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.cat {
  width: 51px;
  height: 20px;
  color: rgba(153, 153, 153, 1);
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0px;
  text-align: left;
}

.cat-value {
  width: 28px;
  height: 20px;
  color: rgba(230, 230, 230, 1);
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0px;
  text-align: left;
}

.ufcat {
  width: 126px;
  height: 20px;
  color: rgba(153, 153, 153, 1);
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0px;
  text-align: left;
  margin-top: 16px;
}

.content-stat {
  margin: 16px 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-border {
  width: 118px;
  height: 71px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05);
}

.start {
  width: 27px;
  height: 20px;
  color: rgba(153, 153, 153, 1);
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0px;
  text-align: left;
  margin-top: 10px;
  margin-left: 16px;
}

.duration {
  width: 74px;
  height: 20px;
  color: rgba(153, 153, 153, 1);
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0px;
  text-align: left;
  margin-top: 10px;
  margin-left: 16px;
}

.close-button {
  width: 16px;
  height: 16px;
  position: fixed;
  margin-top: 8px;
  right: 16px;
  margin-right: auto;
  cursor: pointer;
  font-size: 16px;
  color: whitesmoke;
}


.start-value {
  width: 113px;
  height: 32px;
  color: rgba(230, 230, 230, 1);
  font-size: 14px;
  font-weight: 400;
  line-height: 32px;
  letter-spacing: 0px;
  text-align: left;
  margin-left: 16px;
}

.start-value span {
  font-size: 24px;
}

#title {
  font-size: 13px;
}

.content-args {
  height: 186px;
  width: 650px;
  margin-left: 30px;
  margin-bottom: 16px;
  margin-top: 16px;
  line-height: 1.6;
  font-size: 12px;
  color: rgba(230, 230, 230, 1);
  max-height: 200px;
  overflow-y: auto;
  padding-right: 10px;
}

.content-args span:first-child {
  width: 90px;
  display: inline-block;
  white-space: nowrap;
  color: rgba(153, 153, 153, 1);
}

.args-item {
  display: flex;
}

.args-button {
  white-space: pre-line;
  max-width: 600px;
  overflow: visible;
  text-overflow: ellipsis;
  height: auto;
}

.args-button span:first-child {
  color: rgba(230, 230, 230, 1);
  overflow: visible;
  white-space: pre-line;
  display: inline;
}

.event-hint-hash {
  color: #526ECC !important;
  margin: 0 2px 0 2px !important;
}

.event-hint-hash:hover{
  color: #344899 !important;
  cursor: pointer !important;
}

.args-value {
  white-space: nowrap;
  max-width: 550px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.args-key {
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.content-args::-webkit-scrollbar {
  width: 4px;
  height: 200px;
}

.content-args-head {
  display: flex;
  justify-content: space-between;
}

.content-args-head:first-child {
  font-size: 14px;
}

.jump-to-file {
  margin-right: 10px;
}

#canvas-container {
  margin-left: 16px;
  margin-top: 16px;
  margin-bottom: 16px;
  overflow-y: scroll;
  width: 495px;
  height: 186px;
  position: relative;
}

#canvas-container::-webkit-scrollbar {
  width: 4px;
  height: 60px;
}

.relevent {
  color: rgba(230, 230, 230, 1);
  margin-left: 10px;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: 0px;
  text-align: left;
}

#dependency-canvas {
  top: 86px;
  left: 10px;
  position: absolute;
}

.swim-graph-icon {
  width: 400px;
  display: flex;
  justify-content: space-between;
  margin-top: 9px;
  margin-left: 10px;
}

.swim-graph-icon>div {
  display: flex;
  align-items: center;
  flex-direction: row;
  color: rgba(179, 179, 179, 1);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0px;
  text-align: left;
}

.icon-span-i {
  height: 20px;
  line-height: 16px;
  width: 55px;
}

.icon-span-c {
  height: 20px;
  line-height: 16px;
  width: 45px;
}

.icon-span-o {
  height: 20px;
  line-height: 16px;
  width: 57px;
}

.icon-span-value {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background-color: rgba(179, 179, 179, 0.6);
  color: rgba(179, 179, 179, 1);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0px;
  text-align: center;
  vertical-align: middle;
  margin-left: 8px;
  margin-top: 0px;
}

.button-group {
  width: 84px;
  height: 28px;
  border-radius: 4px;
  margin-top: 8px;
  margin-left: 10px;
}

.button-group>button {
  width: 24px;
  height: 24px;
  margin: 2px;
  border-radius: 4px;
  border: none;
  background-color: transparent;
}

.button-group .relevent-highlight {
  background: rgba(255, 255, 255, 0.3);
}

.button-group>button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.details-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #ffffff;
}

.dependency-section {
  margin-bottom: 20px;
}

.dependency-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #cccccc;
}

.dependency-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.dependency-item {
  background: #2d2d30;
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #0e639c;
  font-size: 12px;
  cursor: pointer;
}

.dependency-item:hover {
  background: #3e3e42;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #cccccc;
}

.tooltip {
  position: absolute;
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  max-width: 300px;
  word-wrap: break-word;
}

.hidden {
  display: none !important;
}

#swim-header-decrease.devui-icon__container,
#swim-header-increase.devui-icon__container {
  color: #CED1DB;
  cursor: pointer;
}

.tooltip-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.tooltip-key {
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tooltip-value {
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

#swimSlider .devui-slider__runway .devui-slider__bar {
  background-color: rgba(255, 255, 255, 1);
}

#swimSlider .devui-slider__runway {
  background-color: rgba(24, 24, 24, 1);
}

#swimSlider .devui-slider__runway .devui-slider__button {
  background-color: #CED1DB;
  border: 2px solid #CED1DB;
}
</style>