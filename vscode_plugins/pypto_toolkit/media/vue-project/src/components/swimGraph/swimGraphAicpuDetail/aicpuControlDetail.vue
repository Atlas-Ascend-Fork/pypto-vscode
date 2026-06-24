<template>
  <div>
    <div class="control-details" :class="{ expanded: aicpuControlDetailsExpanded }">
      <div class="control-details-content">
        <!-- 详情页面具体内容 -->
        <aicpu-detail-content />
        <div class="relevent">
          <div class="relevent-title">Relevent</div>
          <div class="relevent-content" v-if="aicpuHasRelevent">
            <div class="build-content">
              <div class="title">Current</div>
              <div class="current-content" ref="currentContent" :style="{...dynamicWidthStyle(canvasclickedEvent), width:'auto'}">{{ getEventDisplayName(canvasclickedEvent) }}</div>
            </div>
            <svg class="connection-svg" ref="connectionSvg">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" id="startStop" :style="{stopColor: startColor, stopOpacity: 1}" />
                  <stop offset="100%" id="endStop" :style="{stopColor: stopColor, stopOpacity: 1}" />
                </linearGradient>
              </defs>
              <path
                v-for="(item, index) in scheduleList" 
                :key="index"
                :d="getPathData(index)"
                stroke="url(#grad1)"
                stroke-width="1"
                fill="none"
                stroke-dasharray="4,4"
              />
            </svg>
            <div class="sched-content">
              <div class="title">Schedule NO.</div>
              <div class="scheds">
                <div class="schedules" v-for="(item, index) in scheduleList" :key="index" ref="schedItem"> {{item }} </div>
              </div>
            </div>
            <svg class="connection-svg" ref="connectionSvg1">
              <defs>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" id="startStop" :style="{stopColor: stopColor, stopOpacity: 1}" />
                  <stop offset="100%" id="endStop" :style="{stopColor: stopColor, stopOpacity: 1}" />
                </linearGradient>
              </defs>
              <path
                v-for="(item, index) in scheduleList" 
                :key="index"
                :d="getScedPathData(index)"
                stroke="url(#grad2)"
                stroke-width="1"
                fill="none"
                stroke-dasharray="4,4"
              />
            </svg>            
            <div class="cube-content" ref="cubes">
              <div class="schedule-title">{{$t('aiCubeSched')}}</div>
              <template v-for="(key, index) in sortedResultKeys.slice(0, 3)" :key="key">
                <aic-cube-schedule-detail 
                  :aic-dispatch-numstart="aicpuScheduleData.get(key).aic.min" 
                  :aic-dispatch-numend="aicpuScheduleData.get(key).aic.max"
                  :aic-thread-num="aicpuScheduleData.get(sortedResultKeys[2]).aic.max"/>
              </template>
            </div>
            <div class="vec-content">
              <div class="schedule-title">{{$t('aiVectorSched')}}</div>
              <template v-for="(key, index) in sortedResultKeys.slice(0, 3)" :key="key">
                <aiv-cube-schedule-detail 
                  :aiv-dispatch-numstart="aicpuScheduleData.get(key).aiv.min" 
                  :aiv-dispatch-numend="aicpuScheduleData.get(key).aiv.max"
                  :aic-end-num="aicpuScheduleData.get(sortedResultKeys[2]).aic.max"
                  :aiv-thread-num="aivThreadNum"/>
              </template>
            </div>
          </div>
          <template v-else>
            <aicpu-detail-nodata />
          </template>
        </div>
        <div class="close-button">
          <d-button icon="icon-close" style="width: 16px; font-size: 16px; border: none; background-color: transparent"
            @click="AicpuControlDetailsPanel()"></d-button>
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
import aicCubeScheduleDetail from './aicCubeScheduleDetail.vue';
import aivCubeScheduleDetail from './aivCubeScheduleDetail.vue';
const { t: $t } = useI18n();
import { getEventDisplayName } from '../swimGraphUtils';
import { getBaseColor } from '../swimGraphProcesses/processInfo';
// 注入父组件提供的状态和方法
const currentContent = ref();
const connectionSvg = ref();
const connectionSvg1 = ref();
const schedItem = ref();
const cubes = ref();
const {
    aicpuControlDetailsExpanded,
    scheduleList,
    selectedEvent,
    isDarkTheme,
    aicpuHasRelevent,
    aicpuScheduleMaps,
    canvasclickedEvent
} = inject('swimGraphState');

const {
  dynamicWidthStyle,
  kernelColorRending,
  processes,
} = inject('swimGraphMethods');

const aicpuScheduleData = ref(new Map());
let aivThreadNum = 0;

const AicpuControlDetailsPanel = () => {
  aicpuControlDetailsExpanded.value = !aicpuControlDetailsExpanded.value;
};

const getScedPathData = (index) => {
  const svg = connectionSvg1.value;
  const startEl = schedItem.value;
  const endEl = cubes.value;
  if (!startEl || ! endEl) {
    return '';
  }
  if (index < 0 || index >= startEl.length) {
    return '';
  }
  const startRect = startEl[index].getBoundingClientRect();
  const endRect = endEl.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const startX = startRect.right - svgRect.left;
  const startY = startRect.top + (startRect.height / 2) - svgRect.top;
  const endX = endRect.left - svgRect.left;
  const endY = startY - 1;

  return `M${startX}, ${startY} L${endX}, ${endY}`;
};


const getPathData = (index) => {
  const svg = connectionSvg.value;
  const startEl = currentContent.value;
  const endEl = schedItem.value;
  if (!startEl || ! endEl) {
    return '';
  }
  if (index < 0 || index >= endEl.length) {
    return '';
  }
  const startRect = startEl.getBoundingClientRect();
  const endRect = endEl[index].getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const startX = startRect.right - svgRect.left;
  const startY = startRect.top + (startRect.height / 2) - svgRect.top;
  const endX = endRect.left - svgRect.left;
  let endY = endRect.top + (endRect.height / 2) - svgRect.top;
  const deltaY = endY - startY;
  if (Math.abs(deltaY) < 10) {
    if (startY === endY) {
      endY += 1;
    }
    return `M${startX}, ${startY} L${endX}, ${endY}`;
  }
  const curveHeight = Math.abs(deltaY) * 0.3;
  const curveDirection = deltaY > 0 ? 1 : -1;
  return `M${startX},${startY}
          C${startX + (curveHeight * curveDirection)}, ${startY + (curveHeight * curveDirection)}
          ${endX - (curveHeight * curveDirection)},${endY - (curveHeight * curveDirection)}
          ${endX},${endY}`;
};
let startColor = computed(() => {
  return getBaseColor(selectedEvent.value, { processes, isDarkTheme, kernelColorRending });
});
let stopColor = computed(() => {
  return isDarkTheme.value ? '#ffffff' : '#000000';
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
  aivThreadNum = result.get('AICPU-CTRL-3')?.aiv.max - result.get('AICPU-CTRL-3')?.aic.max || 0;
  return result;
};

const sortedResultKeys = computed(() => {
  return Array.from(aicpuScheduleData.value.keys()).sort((a, b) => {
    const numA = parseInt(a.split('-')[3]);
    const numB = parseInt(b.split('-')[3]);
    return numA - numB;
  });
});

watch(selectedEvent, (newEvent) => {
  aicpuScheduleData.value = scheduleGraphData();
});

</script>

<style scoped lang="scss">
@import url("../css/swimGraph/AicpuDetail/aicpuControlDetail.css");
</style>