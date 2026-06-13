<template>
  <div>
    <div class="content-one-pipe">
      <div class="pipe-content-title">
        <div class="pipe-title">
          <img class="picture" :src="tPath" alt="picture">
        </div>
        <div class="pipe-name">
          <d-tooltip :content="getEventDisplayName(selectedEvent)">
            <div class="pipe-name-key" :class="{ 'centered': aicpuControlDetailsExpanded}">{{ getEventTruncateText(selectedEvent) }}</div>
          </d-tooltip>
          <div v-if="!aicpuControlDetailsExpanded" class="pipe-schedule">
            <span class="schedule-key">Schedule: {{ getScheduleKey(selectedEvent) }}</span>
          </div>
        </div>
      </div>
      <div class="pipe-content-stat">
        <div class="pipe-start">
          <span class="pipe-start-up">
              <span>Start</span><span class="ml5">({{ startTimeUnitInfo }})</span>
              <span class="arrow-right-top"><d-icon name="icon-arrow-right-l" class="right-button"></d-icon></span>
              <span>End</span><span class="ml5">({{ endTimeUnitInfo }})</span>
              <span class="arrow-right-top"><d-icon name="icon-arrow-right-l" class="right-button"></d-icon></span>
              <span>Duration</span><span class="ml5">({{ durationUnitInfo }})</span>
          </span>
          <span class="pipe-start-down">
              <d-tooltip :content=startTipTimeInfo>
                <span class="start-value-key">{{ startTimeInfo }}</span>
              </d-tooltip>
              <span class="arrow-right"><d-icon name="icon-arrow-right-l" class="right-button"></d-icon></span>
              <d-tooltip :content=endTipTimeInfo>
                <span class="start-value-key">{{ endTimeInfo }}</span>
              </d-tooltip>
              <span class="arrow-right"><d-icon name="icon-arrow-right-l" class="right-button"></d-icon></span>
              <d-tooltip :content=durationTipTimeInfo>
                <span class="start-value-key">{{ durationInfo }}</span>
              </d-tooltip>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getEventDisplayName } from '../swimGraphUtils';

const { t } = useI18n();
// 注入父组件提供的状态和方法
const {
    selectedEvent,
    isDarkTheme,
    viewState,
    aicpuControlDetailsExpanded
} = inject('swimGraphState');

const {
    overflowText,
} = inject('swimGraphMethods');

let tPath = isDarkTheme.value ? ref(`${window.staticPath}/static-assets/circle.svg`) : ref(`${window.staticPath}/static-assets/circle_light.svg`);
let startTimeInfo = ref('0');
let startTimeUnitInfo = ref('us');
let endTimeInfo = ref('0');
let endTimeUnitInfo = ref('us');
let durationInfo = ref('0');
let durationUnitInfo = ref('us');
let startTipTimeInfo = ref('μs');
let endTipTimeInfo = ref('μs');
let durationTipTimeInfo = ref('μs');

const getEventTruncateText = (event) => {
  const eventName = getEventDisplayName(event);
  let actualWidth = 210;
  const [truncatedText] = overflowText(actualWidth, eventName);
  return truncatedText;
};

const getScheduleKey = (event) => {
  if (event) {
    const numbers = event.threadName.match(/\d+/);
    const threadid = numbers ? numbers[0] : 0;
    return `SCHED-${threadid}`;
  }
  return '';
};

const TimeWithUsUint = (time) => {
  const nanoseconds = time;
  const microseconds = nanoseconds / 1000;
  const timeWithUint = microseconds.toFixed(1) + 'μs';
  return timeWithUint;
};

const aicpuFormatTimeWithUnit = (timeInNanoseconds) => {
  const nanoseconds = timeInNanoseconds;
  const microseconds = nanoseconds / 1000;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  if (!nanoseconds) {
     return {
      value: '', unit: ''
     };
  }
  if (minutes >= 1) {
    return { value: minutes.toFixed(0), unit: 'min' };
  } else if (seconds >= 1) {
    return { value: seconds.toFixed(0), unit: 's' };
  } else if (milliseconds >= 1) {
    return { value: milliseconds.toFixed(0), unit: 'ms' };
  } else if (microseconds >= 1) {
    return { value: microseconds.toFixed(0), unit: 'μs' };
  } else {
    return { value: nanoseconds.toFixed(0), unit: 'ns' };
  }
};


watch(selectedEvent, (newEvent) => {
  if (newEvent) {
    startTimeInfo.value = aicpuFormatTimeWithUnit(selectedEvent.value.startTime - viewState.minTime).value;
    startTimeUnitInfo.value = aicpuFormatTimeWithUnit(selectedEvent.value.startTime - viewState.minTime).unit;
    endTimeInfo.value = aicpuFormatTimeWithUnit(selectedEvent.value.endTime - viewState.minTime).value;
    endTimeUnitInfo.value = aicpuFormatTimeWithUnit(selectedEvent.value.endTime - viewState.minTime).unit;
    durationInfo.value = aicpuFormatTimeWithUnit(selectedEvent.value.duration).value;
    durationUnitInfo.value = aicpuFormatTimeWithUnit(selectedEvent.value.duration).unit;
    startTipTimeInfo.value = TimeWithUsUint(selectedEvent.value.startTime - viewState.minTime);
    endTipTimeInfo.value = TimeWithUsUint(selectedEvent.value.endTime - viewState.minTime);
    durationTipTimeInfo.value = TimeWithUsUint(selectedEvent.value.duration);
  }
});

</script>

<style scoped lang="scss">
@import url("../css/swimGraph/AicpuDetail/aicpuContent.css");
</style>