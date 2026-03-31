<template>
  <div class="process-section">
    <!-- 进程头部 -->
    <span :data-processKey="processKey" :data-process="processKey"></span>
    <swim-graph-process-header 
      v-if="labelRender"
      :process-key="processKey" 
      :process="process"
    />

    <!-- 线程和事件区域 -->
    <div class="threads-container" v-if="hasThreads" v-show="isExpanded">
      <!-- 线程标签区域 -->
      <swim-graph-thread-labels 
        v-if="labelRender"
        :process-key="processKey" 
        :process="process"
      />

      <!-- 线程事件区域 -->
      <swim-graph-thread-events 
        :process-key="processKey" 
        :process="process"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject, provide, ref, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import SwimGraphProcessHeader from './swimGraphProcessHeader.vue';
import SwimGraphThreadLabels from './swimGraphThreadLabels.vue';
import SwimGraphThreadEvents from './swimGraphThreadEvents.vue';

const props = defineProps({
  process: {
    type: Object,
    required: true
  },
  processKey: {
    type: String,
    required: true
  },
  labelRender: {
    type: Boolean,
    default: true
  }
});

const { t: $t } = useI18n();

const {
  processExpanded,
} = inject('swimGraphState');

const isExpanded = computed(() => {
  return processExpanded.get(props.processKey);
});

const hasThreads = computed(() => {
  return props.process && props.process.threads && props.process.threads.size > 0;
});

const cycleDisplay = ref('none');
const selectedOption = ref('clockCycle');
const selectOptions = [
  { name: $t('clockCycle'), value: 'clockCycle', disabled: false },
  { name: $t('cacheHit'), value: 'cacheHit', disabled: false },
  { name: $t('task'), value: 'task', disabled: false },
  { name: $t('utilization'), value: 'utilization', disabled: false },
];
const options = reactive(selectOptions);

provide('swimCycleDisplay', { 
  cycleDisplay, 
  selectedOption, 
  options 
});

</script>

<style scoped>
@import url("../css/swimGraph/Processes/processes.css");
</style>
