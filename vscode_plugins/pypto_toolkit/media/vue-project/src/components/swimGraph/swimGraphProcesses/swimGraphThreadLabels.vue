<template>
  <div class="thread-labels" :style="{ width: layout.processLabelWidth + 'px' }">
    <div v-for="(thread, threadIndex) in threadsArray" :key="threadIndex"  
      class="thread-labels-loop" 
      :class="{'active': `${props.processKey}-${threadIndex}` === curThread}"
      @mouseover="handleLabelHover(threadIndex)">
      <div 
        class="thread-label-item"
        :class="[{ 'has-threads-box': thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_') }, activeThreadName === (thread.threadName) && 'active']"
        :style="{ height: layout.threadHeight * (lane2line.get(processKey + '@' + thread.tid) || 1) + 'px' }"
      >
        {{ thread.threadName }}
      </div>
      <div class="threads-box" v-if="thread.threadName.includes('AIV_') || thread.threadName.includes('AIC_')" style="display: none;">
        <div class="threads-fill"></div>
        <div class="threads-text">doing</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue';


// 注入父组件提供的状态
const {
  layout,
  lane2line
} = inject('swimGraphState');

const {
  searchResult,
  currentResultIndex
} = inject('swimGraphSearch');

const curThread = inject('curThread');

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

const handleLabelHover = (threadIndex) => {
  let hoverId = `${props.processKey}-${threadIndex}`;
  if (hoverId != curThread.value) {
    curThread.value = hoverId;
  }
}

const activeThreadName = computed(() => {
  if(searchResult.value.length === 0) {
    return "";
  }
  if (searchResult.value[currentResultIndex.value - 1]) {
    return searchResult.value[currentResultIndex.value - 1].at(1);
  } else {
    return "";
  }
})

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

  &.active {
    background: rgba(49, 122, 247, 1);
    opacity: 0.7;
    color: #ffffff;
    width: 250px;
  }
}
</style>
