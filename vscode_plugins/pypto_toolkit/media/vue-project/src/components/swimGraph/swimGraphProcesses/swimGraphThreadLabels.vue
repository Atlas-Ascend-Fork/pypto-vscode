<template>
  <div class="thread-labels" :style="{ width: layout.processLabelWidth + 'px' }">
<template v-if="isMixMode && swimLaneOrder.length > 0">
      <div 
        v-for="(lane, index) in swimLaneOrder" 
        :key="index"  
        class="thread-labels-loop"
        :class="{ 'active': `${processKey}-${index}` === curThread, 'activeS': lane.type === 'thread' && activeThreadId === `${processKey}-${lane.thread.tid}` }"
        :style="{ height: lane.height + 'px' }"
        @mouseover="handleMixLabelHover(lane, index)"
        @mouseleave="handleMixLabelLeave(index)"
      >
        <div 
          v-if="lane.type === 'wrap-label'"
          class="thread-label-item wrap-label-item"
          :style="{ height: lane.height + 'px', lineHeight: lane.height + 'px', color: isDarkTheme ? '#666666' : '#C9C9C9', fontSize: '12px' }"
        >
          {{ index === firstWrapLabelIndex ? $t('mixTasks') : '' }}
        </div>
        <template v-else-if="lane.type === 'thread'">
          <!-- 取消置顶图标 - 直接检查线程是否在 pinnedThreadsList 中 -->
          <d-tooltip :content="$t('unpinThread')" position="right" v-if="isThreadPinned(lane.thread)">
            <d-icon
              name="icon-pushpin-fill"
              class="pin-icon-position unpin-icon"
              @click="handleMixUnpin(lane.thread)"
            >
            </d-icon>
          </d-tooltip>
          <!-- 置顶图标 -->
          <d-tooltip :content="$t('pinThread')" position="right" v-if="!isThreeColumn && hoveredThreadIndex === index && !isThreadPinned(lane.thread)">
            <d-icon 
              :name="isHoveringPinIcon ? 'icon-pushpin-fill' : 'icon-pushpin'"
              class="pin-icon-position pin-icon"
              @click="handleMixPinThread(lane.thread)"
              @mouseenter="isHoveringPinIcon = true"
              @mouseleave="isHoveringPinIcon = false"
            >
            </d-icon>
          </d-tooltip>
          <div 
            class="thread-label-item"
            :class="[{ 'has-threads-box': lane.thread.threadName.includes('AIV_') || lane.thread.threadName.includes('AIC_') }]"
            :style="{ height: lane.height + 'px' }"
          >
            {{ lane.thread.threadName }}
          </div>
          <div 
            class="threads-box" 
            v-if="isPrefProcess || isAicpuProcess || lane.thread.threadName.includes('AIV_') || lane.thread.threadName.includes('AIC_')" 
            :style="{'--thread-fill-width': threadFillWidth(lane.thread.tid, selectedOption) + '%', '--thread-fill-width-complement': (100 - threadFillWidth(lane.thread.tid, selectedOption)) + '%', 
            }"
          >
            <div class="threads-fill" :style="{ width: threadFillWidth(lane.thread.tid, selectedOption) + '%', 'background': getBackground(lane.thread.tid, selectedOption)}"></div>
            <div class="threads-text" :class="{ 'utilization-text': selectedOption === 'utilization' }"> {{ threadTotaltime(lane.thread.tid, selectedOption) }}</div>
          </div>
        </template>
      </div>
    </template>
    <template v-else>
      <div 
        v-for="(threadEntry, index) in process.threads" 
        :key="threadEntry[0]"  
        class="thread-labels-loop" 
        :class="{'active': `${props.processKey}-${index}` === curThread, 'activeS': activeThreadId === `${props.processKey}-${threadEntry[1].tid}`}"
        @mouseover="handleLabelHover(index)"
        @mouseleave="handleLabelLeave(index)"
      >
      <!-- 取消置顶图标 -->
      <d-tooltip :content="$t('unpinThread')" position="right" v-if="threadEntry[1].isPinned">
        <d-icon
          name="icon-pushpin-fill"
          class="pin-icon-position unpin-icon"
          @click="handleUnpin(threadEntry[0])"
        >
        </d-icon>
      </d-tooltip>
      <!-- 置顶图标 -->
      <d-tooltip :content="$t('pinThread')" position="right" v-if="!isThreeColumn && hoveredThreadIndex === index && !threadEntry[1].isPinned">
        <d-icon 
          :name="isHoveringPinIcon ? 'icon-pushpin-fill' : 'icon-pushpin'"
          class="pin-icon-position pin-icon"
          @click="handlePinThread(threadEntry[0])"
          @mouseenter="isHoveringPinIcon = true"
          @mouseleave="isHoveringPinIcon = false"
        >
        </d-icon>
      </d-tooltip>
        <div 
          class="thread-label-item"
          :class="[{ 'has-threads-box': threadEntry[1].threadName.includes('AIV_') || threadEntry[1].threadName.includes('AIC_') }]"
          :style="{ height: getThreadHeight(processKey, threadEntry[1].tid, lane2line, layout, threadEntry[1].isCounter) + 'px' }"
        >
          {{ threadEntry[1].threadName }}
        </div>
        <div 
          class="threads-box" 
          v-if="isPrefProcess || isAicpuProcess || threadEntry[1].threadName.includes('AIV_') || threadEntry[1].threadName.includes('AIC_')" 
          :style="{'--thread-fill-width': threadFillWidth(threadEntry[1].tid, selectedOption) + '%', '--thread-fill-width-complement': (100 - threadFillWidth(threadEntry[1].tid, selectedOption)) + '%', 
          }"
        >
          <div class="threads-fill" :style="{ width: threadFillWidth(threadEntry[1].tid, selectedOption) + '%', 'background': getBackground(threadEntry[1].tid, selectedOption)}"></div>
          <div class="threads-text" :class="{ 'utilization-text': selectedOption === 'utilization' }"> {{ threadTotaltime(threadEntry[1].tid, selectedOption) }}</div>
          <div class="average-line" :style="{ left: averageValue + '%'}"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getThreadHeight } from '../swimGraphUtils';
import { swimDataManager } from '../swimData';

const { t: $t } = useI18n();
const { isDarkTheme } = inject('root');

// 注入父组件提供的状态
const {
  layout,
  lane2line,
  processes,
  isThreeColumn,
  viewState,
  isMixMode,
} = inject('swimGraphState');

const swimLaneOrder = computed(() => {
  if (!isMixMode?.value) {
    return [];
  }
  return swimDataManager.getSwimLaneOrder();
});

const isThreadPinned = (thread) => {
  const identifier = thread.isCounter ? thread.threadName : thread.tid;
  return pinnedThreadsList.value.some(p => {
    const pinnedIdentifier = p.thread?.isCounter ? p.thread?.threadName : p.thread?.tid;
    return pinnedIdentifier === identifier;
  });
};

const firstWrapLabelIndex = computed(() => {
  const order = swimLaneOrder.value;
  for (let i = 0; i < order.length; i++) {
    if (order[i].type === 'wrap-label') {
      return i;
    }
  }
  return -1;
});

const {
  searchResult,
  currentResultIndex
} = inject('swimGraphSearch');

const curThread = inject('curThread');
const { cycleDisplay, selectedOption, options } = inject('swimCycleDisplay');

// 注入置顶线程状态
const { pinThread, unpinThread, pinnedThreadsList } = inject('swimGraphPinnedState');

// 定义props
const props = defineProps({
  processKey: {
    type: String,
    required: true
  },
  process: {
    type: Object,
    required: true
  }
});

const averageValue = ref(0);
const hoveredThreadIndex = ref(-1);
const isHoveringPinIcon = ref(false);

const isAicpuProcess = computed(() => {
  const process = processes.get(props.processKey);
  if (process) {
    return process.type === 'aicpu';
  }
  return false;
});

const isPrefProcess = computed(() => {
  const process = processes.get(props.processKey);
  if (process) {
    return process.type === 'PerfSwim';
  }
  return false;
});

const calculateThreadCycles = (allProcesses, proKey) => {
  if (isAicpuProcess.value) {
    cycleDisplay.value = 'none';
    options.splice(0, options.length, ...options.filter(option => option.value !== 'clockCycle' && option.value !== 'cacheHit'));
    return [null, null];
  }
  const threadCyclesMap = new Map();
  const threadCacheHitMap = new Map();
  const { threads = new Map() } = allProcesses.get(proKey) || {};
  let hasPmu = false;
  for(const [threadKey, thread] of threads) {
    let totleCycles = 0n;
    let icacheMiss = 0n;
    let icacheReq = 0n;
    if (thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_')) {
      for (const event of thread.events) {
        if (!event['pmu_info'] || Object.keys(event['pmu_info']).length === 0) {
          cycleDisplay.value = 'none';
          options.splice(0, options.length, ...options.filter(option => option.value !== 'clockCycle' && option.value !== 'cacheHit'));
          return [null, null];
        }
        if (event['pmu_info']['total cycle'] == 0 || event['pmu_info']['total cycle']==undefined) {
          continue;
        }
        hasPmu = true;
        totleCycles += BigInt(event['pmu_info']['total cycle']);
        icacheMiss += BigInt(event['pmu_info']['icache_miss']);
        icacheReq += BigInt(event['pmu_info']['icache_req']);
      }
      cycleDisplay.value = 'flex';
      threadCyclesMap.set(thread.tid, totleCycles.toString());
      const missRate = Number(icacheMiss) / Number(icacheReq);
      threadCacheHitMap.set(thread.tid, (1 - missRate).toString());
    }
  }
  if (!hasPmu) {
    cycleDisplay.value = 'none';
    options.splice(0, options.length, ...options.filter(option => option.value !== 'clockCycle' && option.value !== 'cacheHit'));
    return [null, null];
  }
  return [threadCyclesMap, threadCacheHitMap];
};

const calculateThreadTask = (allProcesses, proKey) => {
  const threadTaskMap = new Map();
  const currentProcess = allProcesses.get(proKey);
  const { threads = new Map() } = currentProcess || {};
  
  for (const [threadKey, thread] of threads) {
    const typeValided = isPrefProcess.value || isAicpuProcess.value;
    const nameValided = thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_');
    if (typeValided || nameValided) {
      threadTaskMap.set(thread.tid, thread.events.length);
    }
  }
  if (cycleDisplay.value === 'none') {
    // 设置默认显示选项
    if (isAicpuProcess.value) {
       selectedOption.value = 'utilization';
    } else {
       selectedOption.value = 'task';
    }
  }
  return threadTaskMap;
};

const calculateThreadUtilization = (allProcesses, proKey) => {
  const threadUtilizationMap = new Map();
  const currentProcess = allProcesses.get(proKey);
  const { threads = new Map() } = currentProcess || {};
  
  let utilization = 0;
  let eventTime = 0;
  for (const [threadKey, thread] of threads) {
    const typeValided = isPrefProcess.value || isAicpuProcess.value;
    const nameValided = thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_');
    if (typeValided || nameValided) {
      for (const event of thread.events) {
        eventTime = eventTime + (event.endTime - event.startTime);
      }
      utilization = viewState.timeRange !== 0 ? (eventTime / viewState.timeRange) : 1;
      utilization = (utilization * 100).toFixed(0);
      if (utilization === '0') {
        utilization = '1';
      }
      threadUtilizationMap.set(thread.tid, utilization);
      eventTime = 0;
    }
  }
  return threadUtilizationMap;
};

const [threadCyclesMap, threadCacheHitMap] = calculateThreadCycles(processes, props.processKey);
const threadTaskMap = calculateThreadTask(processes, props.processKey);
const threadUtilizationMap = calculateThreadUtilization(processes, props.processKey);

const getBackground = (threadId, option) => {
  let values;
  let utilization;
  if (option === 'clockCycle' && threadCyclesMap) {
    values = Array.from(threadCyclesMap.values()).map(value => BigInt(value));
    if (values.every((value, _, arr) => value === arr[0])) {
      return 'var(--devui-timebar-bg)';
    }
  } else if (option === 'task' && threadTaskMap) {
    values = Array.from(threadTaskMap.values());
    if (values.every((value, _, arr) => value === arr[0])) {
      return 'var(--devui-timebar-bg)';
    }
  } else if (option === 'utilization' && threadUtilizationMap) {
    utilization = threadUtilizationMap.get(threadId);
    if (utilization < 50 || utilization === 50) {
      return 'var(--devui-timefull-bg)';
    } else {
      return 'var(--devui-timebar-bg)';
    }
  } else if (option === 'cacheHit' && threadCacheHitMap) {
    values = Array.from(threadCacheHitMap.values()).map(value => Number(value));
    if (values.every((value, _, arr) => value === arr[0])) {
      return 'var(--devui-timebar-bg)';
    }
  } else {
    return 'var(--devui-timebar-bg)';
  }
  return threadFillWidth(threadId, option) === 100 ? 'var(--devui-timefull-bg)' : 'var(--devui-timebar-bg)';
};

const threadTotaltime = (threadId, option) => {
  if (option === 'clockCycle' && threadCyclesMap) {
    return threadCyclesMap.get(threadId);
  } else if (option === 'task' && threadTaskMap) {
    return threadTaskMap.get(threadId);
  } else if (option === 'utilization' && threadUtilizationMap) {
    return threadUtilizationMap.get(threadId) + '%';
  } else if (option === 'cacheHit' && threadCacheHitMap) {
    const hitRate = threadCacheHitMap.get(threadId);
    if (hitRate) {
      return parseFloat(hitRate).toFixed(2);
    }
  } else {
    return 0;
  }
  return 0;
};

const threadFillWidth = (threadId, option) => {
  let values;
  if (option === 'clockCycle' && threadCyclesMap) {
    const currenThreadTime = BigInt(threadCyclesMap.get(threadId));
    let maxThreadTime = 0n;
    values = Array.from(threadCyclesMap.values()).map(value => BigInt(value));
    let sum = 0n;
    maxThreadTime = values.reduce((max, value) => max > value ? max : value);
    sum = values.reduce((acc, value) => acc + value, 0n);
    const average = Number(sum) / values.length;
    averageValue.value = (average / Number(maxThreadTime)) * 100;
    return (Number(currenThreadTime) / Number(maxThreadTime)) * 100;
  } else if (option === 'task' && threadTaskMap) {
    values = Array.from(threadTaskMap.values());
    const maxTaskNum = values.length > 0 ? Math.max(...values) : 0;
    averageValue.value = ((values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0) / maxTaskNum) * 100;
    return (threadTaskMap.get(threadId) / maxTaskNum) * 100;
  } else if (option === 'utilization' && threadUtilizationMap) {
    averageValue.value = 50;
    return (threadUtilizationMap.get(threadId));
  } else if (option === 'cacheHit' && threadCacheHitMap) {
    const currenThreadHit = Number(threadCacheHitMap.get(threadId));
    let maxThreadHit = 0;
    values = Array.from(threadCacheHitMap.values()).map(value => Number(value));
    let sum = 0;
    maxThreadHit = values.reduce((max, value) => max > value ? max : value);
    sum = values.reduce((acc, value) => acc + value, 0);
    const average = sum / values.length;
    averageValue.value = (average / maxThreadHit) * 100;
    return (currenThreadHit / maxThreadHit) * 100;
  } else {
    return 0;
  }
};

const handleLabelHover = (threadIndex) => {
  let hoverId = `${props.processKey}-${threadIndex}`;
  if (hoverId != curThread.value) {
    curThread.value = hoverId;
  }
  hoveredThreadIndex.value = threadIndex;
};

const handleLabelLeave = (threadIndex) => {
  hoveredThreadIndex.value = -1;
  isHoveringPinIcon.value = false;
};

const handleMixLabelHover = (lane, index) => {
  if (lane.type === 'thread') {
    const hoverId = `${props.processKey}-${index}`;
    if (hoverId !== curThread.value) {
      curThread.value = hoverId;
    }
    hoveredThreadIndex.value = index;
  }
};

const handleMixLabelLeave = (index) => {
  hoveredThreadIndex.value = -1;
  isHoveringPinIcon.value = false;
};

const handleMixPinThread = (thread) => {
  if (!thread) {
    return;
  }
  
  const threadKey = thread.isCounter ? thread.threadName : thread.tid;
  let pinnedY = 0;
  for (const pinnedThread of pinnedThreadsList.value) {
    const t = pinnedThread.thread;
    const tk = t.isCounter ? t.threadName : t.tid;
    const lc = lane2line.get(`${pinnedThread.processKey}@${tk}`) || 1;
    pinnedY += layout.threadHeight * lc;
  }
  const lc = thread.isCounter ? 1 : (lane2line.get(`${props.processKey}@${threadKey}`) || 1);
  const swimLaneOrderlist = swimDataManager.getSwimLaneOrder();

  let laneY = 0;
  const threadIdentifier = thread.isCounter ? thread.threadName : thread.tid;
  for (const lane of swimLaneOrderlist) {
    if (lane.type === 'thread') {
      const laneIdentifier = lane.thread.isCounter ? lane.thread.threadName : lane.thread.tid;
      if (laneIdentifier === threadIdentifier) {
        laneY = lane.y;
        lane.thread.isPinned = true;
        break;
      }
    }
  }
  
  const offsetY = laneY - pinnedY;

  pinThread(props.processKey, threadKey, offsetY);
};

const handleMixUnpin = (thread) => {
  if (!thread) {
    return;
  }
  
  const identifier = thread.isCounter ? thread.threadName : thread.tid;
  
  // 从 pinnedThreadsList 中找到对应的 threadKey
  const pinnedThread = pinnedThreadsList.value.find(p => {
    const t = p.thread;
    const pinnedIdentifier = t.isCounter ? t.threadName : t.tid;
    return pinnedIdentifier === identifier;
  });
  
  if (!pinnedThread) {
    return;
  }
  // 同步 isPinned 状态到 swimLaneOrder
  const swimLaneOrderlist = swimDataManager.getSwimLaneOrder();
  for (const lane of swimLaneOrderlist) {
    if (lane.type === 'thread') {
      const laneIdentifier = lane.thread.isCounter ? lane.thread.threadName : lane.thread.tid;
      if (laneIdentifier === identifier) {
        lane.thread.isPinned = false;
        break;
      }
    }
  }

  unpinThread(pinnedThread.processKey, pinnedThread.threadKey);
};

const handlePinThread = (threadKey) => {
  const thread = props.process.threads.get(threadKey);
  if (!thread) {
    return;
  }
  let pinnedY = 0;
  for (const pinnedThread of pinnedThreadsList.value) {
    const t = pinnedThread.thread;
    const tk = t.isCounter ? t.threadName : t.tid;
    const lc = lane2line.get(`${pinnedThread.processKey}@${tk}`) || 1;
    pinnedY += layout.threadHeight * lc;
  }

  const lc = thread.isCounter ? 1 : (lane2line.get(`${props.processKey}@${threadKey}`) || 1);
  const originalY = thread.bottomY - (layout.threadHeight * lc);

  const offsetY = originalY - pinnedY;
  pinThread(props.processKey, threadKey, offsetY);
};

const handleUnpin = (threadKey) => {
  unpinThread(props.processKey, threadKey);
};

const activeThreadId = computed(() => {
  if(searchResult.value.length === 0) {
    return "";
  }
  if (searchResult.value[currentResultIndex.value - 1]) {
    const result = searchResult.value[currentResultIndex.value - 1];
    const processKey = result.at(2);
    const tid = result.at(3);
    return `${processKey}-${tid}`;
  } else {
    return "";
  }
});
</script>

<style scoped lang="scss">
@import url("../css/swimGraph/Processes/labels.css");
.thread-label-item {
  padding-left: 36px;
  align-items: center;
  display: flex;
  height: 24px;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  min-width: 140px;
  text-align: left;
  position: relative;
}

.pin-icon-position {
  position: absolute;
  right: 223px;
  z-index: 1;
  cursor: pointer;
}

.pin-icon {
  color: var(--devui-thread-text);
}

.unpin-icon {
  color: var(--devui-primary-button-bg);
}

.pin-icon:hover {
  color: var(--devui-primary-button-hover-bg);
}
 
.threads-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: var(--thread-fill-width);
  width: var(--thread-fill-width-complement);
  height: 100%;
  background: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 1px,
    var(--devui-timebar-bg) 4px
  );
  z-index: 0;
}

.average-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  border-left: 1px dashed var(--devui-slider-bar);
  opacity: 0.1;
  z-index: 2;
}
</style>
