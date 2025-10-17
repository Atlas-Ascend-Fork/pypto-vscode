<template>
  <div class="thread-labels" :style="{ width: layout.processLabelWidth + 'px' }">
    <div v-for="(thread, threadIndex) in threadsArray" :key="threadIndex"  
      class="thread-labels-loop" 
      :class="{'active': `${props.processKey}-${threadIndex}` === curThread, 'activeS': activeThreadName === (thread.threadName)}"
      @mouseover="handleLabelHover(threadIndex)">
      <div 
        class="thread-label-item"
        :class="[{ 'has-threads-box': thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_') }]"
        :style="{ height: getThreadHeight(processKey, thread.tid, lane2line, layout, thread.isCounter) + 'px' }"
      >
        {{ thread.threadName }}
      </div>
      <div class="threads-box" v-if="thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_')" 
        :style="{'--thread-fill-width': threadFillWidth(thread.threadName, selectedOption) + '%', '--thread-fill-width-complement': (100 - threadFillWidth(thread.threadName, selectedOption)) + '%', 
          'background': getBackground(thread.threadName, selectedOption),
          'display':cycleDisplay}">
        <div class="threads-fill" :style="{ width: threadFillWidth(thread.threadName, selectedOption) + '%'}"></div>
        <div class="threads-text"> {{ threadTotaltime(thread.threadName, selectedOption) }}</div>
        <div class="average-line" :style="{ left: averageValue + '%'}"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { BigNumber } from 'bignumber.js';
import { getThreadHeight } from '../swimGraphUtils';

// 注入父组件提供的状态
const {
  layout,
  lane2line,
  processes
} = inject('swimGraphState');

const {
  searchResult,
  currentResultIndex
} = inject('swimGraphSearch');

const curThread = inject('curThread');
const { cycleDisplay, selectedOption, options } = inject('swimCycleDisplay');

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

const calculateThreadCycles = (allProcesses, proKey) => {
  const threadCyclesMap = new Map();
  const threadCacheHitMap = new Map();
  const { threads = new Map() } = allProcesses.get(proKey) || {};
  for(const [threadKey, thread] of threads) {
    let totleCycles = new BigNumber(0);
    let icacheMiss = new BigNumber(0);
    let icacheReq = new BigNumber(0);
    if (thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_')) {
      for (const event of thread.events) {
        if (!event['pmu_info']) {
          cycleDisplay.value = 'none';
          const optionToDisable = options.filter(option => option.value === 'clockCycle' || option.value === 'cacheHit');
          optionToDisable.forEach(option => {
            option.disabled = true;
          });
          return [null, null];
        }
        totleCycles = totleCycles.plus(new BigNumber(event['pmu_info']['total cycle']));
        icacheMiss = icacheMiss.plus(new BigNumber(event['pmu_info']['icache_miss']));
        icacheReq = icacheReq.plus(new BigNumber(event['pmu_info']['icache_req']));
      }
      cycleDisplay.value = 'flex';
      threadCyclesMap.set(thread.threadName, totleCycles.toString());
      threadCacheHitMap.set(thread.threadName, new BigNumber(1).minus(icacheMiss.dividedBy(icacheReq)).toString());
    }
  }
  return [threadCyclesMap, threadCacheHitMap];
};

const calculateThreadTask = (allProcesses, proKey) => {
  const threadTaskMap = new Map();
  const { threads = new Map() } = allProcesses.get(proKey) || {};
  for(const [threadKey, thread] of threads) {
    if (thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_')) {
      threadTaskMap.set(thread.threadName, thread.events.length);
    }
  }
  if (cycleDisplay.value === 'none') {
    cycleDisplay.value = 'flex';
    selectedOption.value = 'task';
  }
  return threadTaskMap;
};

const [threadCyclesMap, threadCacheHitMap] = calculateThreadCycles(processes, props.processKey);
const threadTaskMap = calculateThreadTask(processes, props.processKey);

const getBackground = (threadId, option) => {
  let values;
  if (option === 'clockCycle' && threadCyclesMap) {
    values = Array.from(threadCyclesMap.values()).map(value => new BigNumber(value));
    if (values.every((value, _, arr) => value.eq(arr[0]))) {
      return 'initial';
    }
  } else if (option === 'task' && threadTaskMap) {
    values = Array.from(threadTaskMap.values());
    if (values.every((value, _, arr) => value === arr[0])) {
      return 'initial';
    }
  } else if (option === 'cacheHit' && threadCacheHitMap) {
    values = Array.from(threadCacheHitMap.values()).map(value => new BigNumber(value));
    if (values.every((value, _, arr) => value.eq(arr[0]))) {
      return 'initial';
    }
  } else {
    return 'initial';
  }
  return threadFillWidth(threadId, option) === 100 ? 'var(--devui-timefull-bg)' : 'initial';
};

const threadTotaltime = (threadId, option) => {
  if (option === 'clockCycle' && threadCyclesMap) {
    return threadCyclesMap.get(threadId);
  }  else if (option === 'task' && threadTaskMap) {
    return threadTaskMap.get(threadId);
  }  else if (option === 'cacheHit' && threadCacheHitMap) {
    const hitRate = threadCacheHitMap.get(threadId);
    if (hitRate) {
      return parseFloat(hitRate).toFixed(4);
    }
  } else {
    return 0;
  }
  return 0;
};

const threadFillWidth = (threadId, option) => {
  let values;
  if (option === 'clockCycle' && threadCyclesMap) {
    const currenThreadTime = new BigNumber(threadCyclesMap.get(threadId));
    let maxThreadTime = new BigNumber(0);
    values = Array.from(threadCyclesMap.values()).map(value => new BigNumber(value));
    let sum = new BigNumber(0);
    maxThreadTime = values.reduce((max, value) => max.gt(value) ? max : value);
    sum = values.reduce((acc, value) => acc.plus(value), new BigNumber(0));
    const averageBN = sum.dividedBy(values.length);
    averageValue.value = averageBN.dividedBy(maxThreadTime).times(100).toNumber();
    return currenThreadTime.dividedBy(maxThreadTime).times(100).toNumber();
  } else if (option === 'task' && threadTaskMap) {
    values = Array.from(threadTaskMap.values());
    const maxTaskNum = values.length > 0 ? Math.max(...values) : 0;
    averageValue.value = ((values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0) / maxTaskNum) * 100;
    return (threadTaskMap.get(threadId) / maxTaskNum) * 100;
  } else if (option === 'cacheHit' && threadCacheHitMap) {
    const currenThreadHit = new BigNumber(threadCacheHitMap.get(threadId));
    let maxThreadHit = new BigNumber(0);
    values = Array.from(threadCacheHitMap.values()).map(value => new BigNumber(value));
    let sum = new BigNumber(0);
    maxThreadHit = values.reduce((max, value) => max.gt(value) ? max : value);
    sum = values.reduce((acc, value) => acc.plus(value), new BigNumber(0));
    const averageBN = sum.dividedBy(values.length);
    averageValue.value = averageBN.dividedBy(maxThreadHit).times(100).toNumber();
    return currenThreadHit.dividedBy(maxThreadHit).times(100).toNumber();
  } else {
    return 0;
  }
};

const handleLabelHover = (threadIndex) => {
  let hoverId = `${props.processKey}-${threadIndex}`;
  if (hoverId != curThread.value) {
    curThread.value = hoverId;
  }
};

const activeThreadName = computed(() => {
  if(searchResult.value.length === 0) {
    return "";
  }
  if (searchResult.value[currentResultIndex.value - 1]) {
    return searchResult.value[currentResultIndex.value - 1].at(1);
  } else {
    return "";
  }
});

// 将线程Map转换为数组
const threadsArray = computed(() => {
  return Array.from(props.process.threads.entries()).map(([key, value]) => {
    return {
      key,
      ...value
    };
  });
});
</script>

<style scoped lang="scss">
@import url("../css/swimGraph/Processes/labels.css");
.thread-label-item {
  padding-left: 36px;
  align-items: center;
  display: flex;
  width: 240px;
  height: 24px;
  color: var(--devui-thread-text);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
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
    var(--devui-slider-container-bg) 4px
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
