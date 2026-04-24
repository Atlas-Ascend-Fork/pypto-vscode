<template>
  <div class="thread-labels" :style="{ width: layout.processLabelWidth + 'px' }">
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
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getThreadHeight } from '../swimGraphUtils';

const { t: $t } = useI18n();

// 注入父组件提供的状态
const {
  layout,
  lane2line,
  processes,
  isThreeColumn,
  viewState,
} = inject('swimGraphState');

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
