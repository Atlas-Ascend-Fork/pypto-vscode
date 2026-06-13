<template>
  <div>
    <div class="core-details" :class="{ expanded: aicpuScheduleDetailsExpanded }">
      <div class="core-details-content">
        <!-- 详情页面具体内容 -->
        <aicpu-detail-content />
        <div class="relevent">
          <div class="relevent-title">Relevent</div>
          <div class="relevent-content" v-if="aicpuHasRelevent">
            <div class="build-content">
              <div class="title">AICPU_DEV_TASK</div>
              <div class="content" :style="{...dynamicWidthStyle(aicpuBuildTask), width:'auto'}">{{ getEventDisplayName(aicpuBuildTask) }}</div>
            </div>
            <gradientDashedLine :left-color="buildTaskColor" :right-color="stopColor" />
            <div class="sched-content">
              <div class="title">Schedule NO.</div>
              <div class="sched"> {{ getThreadDisplayName(selectedEvent) }} </div>
            </div>
            <gradientDashedLine :left-color="stopColor" :right-color="currentTaskColor" />
            <div class="current-content">
              <div class="title current">Current</div>
              <div class="content" :style="{...dynamicWidthStyle(selectedEvent), width:'auto'}">{{ getEventDisplayName(selectedEvent) }}</div>
            </div>
            <gradientDashedLine :left-color="currentTaskColor" :right-color="stopColor" />
            <div class="cube-content">
              <div class="schedule-title">{{$t('aiCubeSched')}}</div>
              <aic-cube-schedule-detail
              :aic-dispatch-numstart="aicCubeStart" 
              :aic-dispatch-numend="aicCubeEnd"
              :aic-thread-num="aicThreadNum"/>
            </div>
            <div class="vec-content">
              <div class="schedule-title">{{$t('aiVectorSched')}}</div>
              <aiv-cube-schedule-detail 
              :aiv-dispatch-numstart="aivCubeStart" 
              :aiv-dispatch-numend="aivCubeEnd"
              :aic-end-num="aicEndmax"
              :aiv-thread-num="aivThreadNum"/>
            </div>
          </div>
          <template v-else>
            <aicpu-detail-nodata />
          </template>
        </div>
        <div class="close-button">
          <d-button icon="icon-close" style="width: 16px; font-size: 16px; border: none; background-color: transparent"
            @click="aicpuScheduleDetailsPanel()"></d-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch, computed} from 'vue';
import { useI18n } from 'vue-i18n';
import aicpuDetailContent from './aicpuDetailContent.vue';
import aicpuDetailNodata from './aicpuDetailNoData.vue';
import gradientDashedLine from './gradientDashedLine.vue';
import aicCubeScheduleDetail from './aicCubeScheduleDetail.vue';
import aivCubeScheduleDetail from './aivCubeScheduleDetail.vue';
import { getBaseColor } from '../swimGraphProcesses/processInfo';
import { getThreadDisplayName, getEventDisplayName } from '../swimGraphUtils';

const { t: $t } = useI18n();
// 注入父组件提供的状态和方法
const {
    aicpuScheduleDetailsExpanded,
    selectedEvent,
    isDarkTheme,
    aicpuBuildTask,
    kernelColorRending,
    processes,
    aicpuHasRelevent,
    aicpuScheduleMaps
} = inject('swimGraphState');

const {
  dynamicWidthStyle,
} = inject('swimGraphMethods');

const aicpuScheduleDetailsPanel = () => {
  aicpuScheduleDetailsExpanded.value = !aicpuScheduleDetailsExpanded.value;
};

const aicmin = ref(0);
const aivmin = ref(0);
const aicmax = ref(0);
const aivmax = ref(0);
const aicendmax = ref(0);
let aicThreadNum = 0;
let aivThreadNum = 0;

let buildTaskColor = computed(() => {
  return getBaseColor(aicpuBuildTask.value, { processes, isDarkTheme, kernelColorRending });
});
let currentTaskColor = computed(() => {
  return getBaseColor(selectedEvent.value, { processes, isDarkTheme, kernelColorRending });
});

let stopColor = computed(() => {
  return isDarkTheme.value ? '#ffffff' : '#000000';
});

let aicCubeStart = computed(() => {
  return aicmin.value;
});

let aicCubeEnd = computed(() => {
  return aicmax.value;
});

let aivCubeStart = computed(() => {
  return aivmin.value;
});

let aivCubeEnd = computed(() => {
  return aivmax.value;
});

let aicEndmax = computed(() => {
  return aicendmax.value;
});

const scheduleGraphData = () => {
  const result = new Map();
  if (!aicpuScheduleMaps.value) {
    return result;
  }

  const controlGroups = new Set();

  for (const [key, value] of aicpuScheduleMaps.value.entries()) {
    const ctrlMatch = key.match(/^AICPU-SCHED-(?<number>\d+)$/);
    if (ctrlMatch) {
      controlGroups.add(ctrlMatch.groups.number);
    }
  }

  if (controlGroups.size === 0) {
    return result;
  }

  for (const group of controlGroups) {
    result.set(`AICPU-CTRL-${group}`, {
      aic: { min: null, max: null },
      aiv: { min: null, max: null }
    });
  }

  for (const [key, value] of aicpuScheduleMaps.value.entries()) {
    const aicMatch = key.match(/^SCHED(?<group>\d+)-AIC-(?<number>\d+)$/);
    const aivMatch = key.match(/^SCHED(?<group>\d+)-AIV-(?<number>\d+)$/);

    if (aicMatch) {
      const groupNumber = aicMatch.groups.group;
      const secondNumber = parseInt(aicMatch.groups.number);

      if (controlGroups.has(groupNumber)) {
        const keyName = `AICPU-CTRL-${groupNumber}`;
        const current = result.get(keyName);
        if (current.aic.min === null) {
          current.aic.min = secondNumber;
          current.aic.max = secondNumber;
        } else {
          current.aic.min = Math.min(current.aic.min, secondNumber);
          current.aic.max = Math.max(current.aic.max, secondNumber) + 1;
        }
      }
    }

    if (aivMatch) {
      const groupNumber = aivMatch.groups.group;
      const secondNumber = parseInt(aivMatch.groups.number);

      if (controlGroups.has(groupNumber)) {
        const keyName = `AICPU-CTRL-${groupNumber}`;
        const current = result.get(keyName);
        if (current.aiv.min === null) {
          current.aiv.min = secondNumber;
          current.aiv.max = secondNumber;
        } else {
          current.aiv.min = Math.min(current.aiv.min, secondNumber);
          current.aiv.max = Math.max(current.aiv.max, secondNumber) + 1;
        }
      }
    }
  }
  const keyNumName = `AICPU-CTRL-3`;
  const currentNum = result.get(keyNumName);
  aicThreadNum = currentNum.aic.max - 1;
  aivThreadNum = currentNum.aiv.max - aicThreadNum - 1;
  return result;
};

watch(selectedEvent, (newEvent) => {
  if (aicpuHasRelevent) {
    const smap = scheduleGraphData();
    if (newEvent) {
      const match = newEvent.threadName.match(/^AICPU-SCHED-(?<number>\d+)$/);
        if(match && match.groups.number) {
          const groupNumber = match.groups.number;
          const keyName = `AICPU-CTRL-${groupNumber}`;
          if (smap.has(keyName)) {
            const data = smap.get(keyName);
            aicmin.value = data.aic.min;
            aicmax.value = data.aic.max;
            aivmin.value = data.aiv.min;
            aivmax.value = data.aiv.max;
          }
        }
    }
    const aicEndkeyName = `AICPU-CTRL-3`;
    if (smap.has(aicEndkeyName)) {
      const data = smap.get(aicEndkeyName);
      aicendmax.value = data.aic.max;
    }
  }
});

</script>

<style scoped lang="scss">
@import url("../css/swimGraph/AicpuDetail/aicpuScheduleDetail.css");
</style>