<template>
  <div class="playback-progress-container">
    <div class="progress-left-controls">
      <button class="control-btn" :title="$t('previous')" @click="prevClock">
        <d-icon name="icon-run-o" :rotate="180" size="16px"></d-icon>
      </button>
      <button class="control-btn" :title="$t('next')" @click="nextClock">
        <d-icon name="icon-run-o" size="16px"></d-icon>
      </button>
    </div>

    <div class="track-line"></div>
    <div ref="progressBarWrapper" class="progress-bar-wrapper">
      <div class="progress-track-container">
        <div class="progress-track" :style="{ width: trackTotalWidth + 'px' }">
        <div
          v-for="(clockBox, index) in clockBoxes"
          :key="'box-' + index"
          class="clock-selection-box"
          :class="{ 'selected': selectedClockIndex === index }"
          :style="{ 
            left: clockBox.left + '%', 
            width: clockBox.width + '%' 
          }"
          @click="handleDotClick(index)"
        ></div>
        <d-tooltip v-for="(dot, index) in dots" :key="index" :content="`Clock: ${dot.clock}`" position="top">
          <div
            class="progress-dot"
            :class="{
              'large-dot': dot.isLarge,
              'selected': dot.isLarge && selectedClockIndex === dot.clockIndex,
              'in-selected-clock': selectedClockIndex === dot.clockIndex
            }"
            :style="{ left: dot.position + '%' }"
            @click="handleDotClick(dot.clockIndex)"
          ></div>
        </d-tooltip>
        </div>
      </div>
    </div>
    <div class="track-line"></div>

    <div class="progress-right-controls">
      <div class="speed-selector">
        <span class="speed-label">Speed:</span>
        <button 
          class="speed-btn" 
          :class="{ active: selectedSpeed === 0.5 }"
          @click="handleSpeedChange(0.5)"
        >0.5x</button>
        <button 
          class="speed-btn" 
          :class="{ active: selectedSpeed === 1 }"
          @click="handleSpeedChange(1)"
        >1x</button>
        <button 
          class="speed-btn" 
          :class="{ active: selectedSpeed === 2 }"
          @click="handleSpeedChange(2)"
        >2x</button>
        <button 
          class="speed-btn" 
          :class="{ active: selectedSpeed === 4 }"
          @click="handleSpeedChange(4)"
        >4x</button>
        <!-- <div class="speed-more">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div> -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { mockMemoryGraphData1, mockMemoryGraphData2, mockMemoryGraphData3 } from './memoryGraph.type'
import { mockAnimationItem, mockErrorAnimationItem, mockTidyAnimationItem } from './memoryGraph.type'
import { MemoryGraphData } from './memoryGraph.type'

const { t: $t } = useI18n()

interface Event {
  id: string
  eventType: string
  startTime: number
  endTime: number
  animationData: any[]
  graphData: MemoryGraphData
}

interface Clock {
  clock: number;
  events: Event[]
}

interface Dot {
  isLarge: boolean
  position: number
  clockIndex: number
  clock: number
}

const emit = defineEmits<{
  (e: 'clock-select', events: Event[], graphData: MemoryGraphData | null, speed: number, onlyUpdateSpeed: boolean): void
  (e: 'speed-change', speed: number, onlyUpdateSpeed: boolean): void
}>()

const selectedClockIndex = ref<number>(0)
const selectedSpeed = ref<number>(1)
const containerWidth = ref<number>(0)
const progressBarWrapper = ref<HTMLElement | null>(null)

const minDistance = 12
const trackPadding = 16
const wrapperPadding = 8

const totalDotCount = computed(() => {
  if (!props.clocks || props.clocks.length === 0) {
    return 0
  }
  let count = props.clocks.length
  props.clocks.forEach(clock => {
    count += clock.events.length
  })
  return count
})

const minRequiredWidth = computed(() => {
  if (totalDotCount.value === 0) {
    return 0
  }
  return trackPadding * 2 + (totalDotCount.value - 1) * minDistance
})

const availableWidth = computed(() => {
  if (containerWidth.value <= 0) {
    return 0
  }
  return containerWidth.value - wrapperPadding * 2
})

const needScroll = computed(() => {
  return minRequiredWidth.value > availableWidth.value && availableWidth.value > 0
})

const trackTotalWidth = computed(() => {
  if (totalDotCount.value === 0) {
    return 0
  }
  return needScroll.value ? minRequiredWidth.value : (availableWidth.value || minRequiredWidth.value)
})

const props = withDefaults(defineProps<{
  clocks?: Clock[]
}>(), {
  clocks: () => [
    // {
    //   clock: 0,
    //   events: [
    //     { id: '8', eventType: 'TypeA', startTime: 0, endTime: 10, animationData: mockAnimationItem, graphData: mockMemoryGraphData1 },
    //     { id: '9', eventType: 'TypeB', startTime: 10, endTime: 20, animationData: mockErrorAnimationItem, graphData: mockMemoryGraphData2 },
    //     { id: '10', eventType: 'TypeA', startTime: 20, endTime: 35, animationData: mockTidyAnimationItem, graphData: mockMemoryGraphData3  },
    //     { id: '11', eventType: 'TypeC', startTime: 35, endTime: 50, animationData: mockAnimationItem, graphData: mockMemoryGraphData2  }
    //   ]
    // },
    // {
    //   clock: 1,
    //   events: [
    //     { id: '12', eventType: 'TypeB', startTime: 50, endTime: 65, animationData: mockAnimationItem, graphData: mockMemoryGraphData2 },
    //     { id: '13', eventType: 'TypeA', startTime: 65, endTime: 80, animationData: mockAnimationItem, graphData: mockMemoryGraphData1 }
    //   ]
    // },
    // { 
    //   clock: 2,
    //   events: [
    //     { id: '14', eventType: 'TypeC', startTime: 80, endTime: 90, animationData: mockAnimationItem, graphData: mockMemoryGraphData1  },
    //     { id: '15', eventType: 'TypeA', startTime: 90, endTime: 100, animationData: mockAnimationItem, graphData: mockMemoryGraphData2  },
    //     { id: '16', eventType: 'TypeB', startTime: 100, endTime: 120, animationData: mockAnimationItem, graphData: mockMemoryGraphData1 }
    //   ]
    // },
    // { 
    //   clock: 3,
    //   events: [
    //     { id: '17', eventType: 'TypeA', startTime: 120, endTime: 140, animationData: mockAnimationItem, graphData: mockMemoryGraphData2 }
    //   ]
    // },
    // { 
    //   clock: 4,
    //   events: [
    //     { id: '18', eventType: 'TypeB', startTime: 140, endTime: 150, animationData: mockAnimationItem, graphData: mockMemoryGraphData1 },
    //     { id: '19', eventType: 'TypeC', startTime: 150, endTime: 165, animationData: mockAnimationItem, graphData: mockMemoryGraphData1  },
    //     { id: '20', eventType: 'TypeA', startTime: 165, endTime: 180, animationData: mockAnimationItem, graphData: mockMemoryGraphData2 },
    //     { id: '21', eventType: 'TypeB', startTime: 180, endTime: 195, animationData: mockAnimationItem, graphData: mockMemoryGraphData1  },
    //     { id: '22', eventType: 'TypeC', startTime: 195, endTime: 200, animationData: mockAnimationItem, graphData: mockMemoryGraphData1  },
    //     { id: '25', eventType: 'TypeB', startTime: 140, endTime: 150, animationData: mockAnimationItem, graphData: mockMemoryGraphData2 },
    //     { id: '25', eventType: 'TypeC', startTime: 150, endTime: 165, animationData: mockAnimationItem, graphData: mockMemoryGraphData1  },
    //     { id: '25', eventType: 'TypeA', startTime: 165, endTime: 180, animationData: mockAnimationItem, graphData: mockMemoryGraphData1 },
    //     { id: '25', eventType: 'TypeB', startTime: 180, endTime: 195, animationData: mockAnimationItem, graphData: mockMemoryGraphData1  },
    //     { id: '25', eventType: 'TypeC', startTime: 195, endTime: 200, animationData: mockAnimationItem, graphData: mockMemoryGraphData1  }
    //   ]
    // },
  ]
})

const dots = computed(() => {
  const result: Dot[] = []

  if (!props.clocks || props.clocks.length === 0 || totalDotCount.value === 0) {
    return result
  }

  let currentPosition = trackPadding
  
  if (needScroll.value) {
    // 需要滚动时，使用最小间距
    props.clocks.forEach((clock, clockIndex) => {
      const position = (currentPosition / trackTotalWidth.value) * 100
      result.push({
        isLarge: true,
        position,
        clockIndex,
        clock: clock.clock
      })

      for (let i = 0; i < clock.events.length; i++) {
        currentPosition += minDistance
        const position = (currentPosition / trackTotalWidth.value) * 100
        result.push({
          isLarge: false,
          position,
          clockIndex,
          clock: clock.clock
        })
      }
      
      // 移动到下一个时钟
      currentPosition += minDistance
    })
  } else {
    // 不需要滚动时，均匀分布
    let currentIndex = 0
    props.clocks.forEach((clock, clockIndex) => {
      const position = 1 + (currentIndex / (totalDotCount.value - 1)) * 98
      result.push({
        isLarge: true,
        position,
        clockIndex,
        clock: clock.clock
      })
      currentIndex++

      for (let i = 0; i < clock.events.length; i++) {
        const position = 1 + (currentIndex / (totalDotCount.value - 1)) * 98
        result.push({
          isLarge: false,
          position,
          clockIndex,
          clock: clock.clock
        })
        currentIndex++
      }
    })
  }

  return result
})

const clockBoxes = computed(() => {
  const result: { left: number; width: number }[] = []

  if (!props.clocks || props.clocks.length === 0 || totalDotCount.value === 0) {
    return result
  }

  if (needScroll.value) {
    // 需要滚动时，使用最小间距
    let currentPosition = trackPadding
    props.clocks.forEach((clock, clockIndex) => {
      // 计算大圆点的位置（像素）
      const largeDotPos = currentPosition
      const largeDotPosition = (largeDotPos / trackTotalWidth.value) * 100
      
      // 计算最后一个事件圆点的位置（像素）
      const lastPos = currentPosition + clock.events.length * minDistance
      
      // 计算选中框宽度（像素）：从大圆点中心到最后一个事件圆点中心，左右各加4px
      let boxWidth = clock.events.length * minDistance + 6 + 8 // 6px覆盖大圆点 + 8px额外宽度（左右各4px）
      
      // 如果没有事件，选中区域只覆盖大圆点本身，左右各加4px
      if (clock.events.length === 0) {
        boxWidth = 6 + 8
      }
      
      // 转换为百分比
      const width = (boxWidth / trackTotalWidth.value) * 100
      const left = ((largeDotPos - 7) / trackTotalWidth.value) * 100 // 向左偏移7px以居中覆盖大圆点（包含额外4px）

      result.push({
        left,
        width
      })
      
      // 更新位置到下一个时钟
      currentPosition = lastPos + minDistance
    })
  } else {
    // 不需要滚动时，均匀分布
    let currentIndex = 0
    props.clocks.forEach((clock, clockIndex) => {
      const largeDotPosition = 1 + (currentIndex / (totalDotCount.value - 1)) * 98
      const startIndex = currentIndex
      currentIndex++

      let lastIndex = currentIndex + clock.events.length - 1
      if (lastIndex >= totalDotCount.value) {
        lastIndex = totalDotCount.value - 1
      }
      
      // 根据事件数量计算宽度（非滚动模式保持原有逻辑）
      let width: number
      if (clock.events.length === 0) {
        // 没有事件时，选中框只覆盖大圆点
        width = 1.5
      } else {
        // 有事件时，覆盖从大圆点到最后一个事件圆点的区域
        const lastDotPosition = 1 + (lastIndex / (totalDotCount.value - 1)) * 98
        width = lastDotPosition - largeDotPosition + 2
      }

      const left = largeDotPosition - 0.75

      result.push({
        left,
        width
      })
      
      // 跳过所有事件索引
      currentIndex += clock.events.length
    })
  }

  return result
})

const handleSpeedChange = (speed: number) => {
  if (selectedSpeed.value !== speed) {
    selectedSpeed.value = speed
    emit('speed-change', speed, true)
  }
}

const handleDotClick = (clockIndex: number) => {
  if (selectedClockIndex.value !== clockIndex) {
    selectedClockIndex.value = clockIndex
    const events = props.clocks[clockIndex]?.events || []
    const graphData = props.clocks[clockIndex]?.events[0]?.graphData || null
    const clockName = props.clocks[clockIndex]?.clock;
    emit('clock-select', events, graphData, selectedSpeed.value, false, clockName)
  }
}

const prevClock = () => {
  if (!props.clocks || props.clocks.length === 0) return
  if (selectedClockIndex.value > 0) {
    selectedClockIndex.value--
    const events = props.clocks[selectedClockIndex.value].events
    const graphData = events[0]?.graphData || null
    const clockName = props.clocks[selectedClockIndex.value]?.clock;
    emit('clock-select', events, graphData, selectedSpeed.value, false, clockName)
  }
}

const nextClock = () => {
  if (!props.clocks || props.clocks.length === 0) return
  if (selectedClockIndex.value < props.clocks.length - 1) {
    selectedClockIndex.value++
    const events = props.clocks[selectedClockIndex.value].events
    const graphData = events[0]?.graphData || null
    const clockName = props.clocks[selectedClockIndex.value]?.clock;
    emit('clock-select', events, graphData, selectedSpeed.value, false, clockName)
  }
}

const emitClockSelect = (clockIndex: number) => {
  const events = props.clocks?.[clockIndex]?.events || []
  const graphData = events[0]?.graphData || null
  const clockName = props.clocks?.[clockIndex]?.clock;
  emit('clock-select', events, graphData, selectedSpeed.value, false, clockName)
}

const updateContainerWidth = () => {
  if (progressBarWrapper.value) {
    containerWidth.value = progressBarWrapper.value.offsetWidth
  }
}

onMounted(() => {
  if (props.clocks && props.clocks.length > 0) {
    emitClockSelect(0)
  }
  updateContainerWidth()
  window.addEventListener('resize', updateContainerWidth)
})

watch(() => props.clocks, (newClocks) => {
  if (newClocks && newClocks.length > 0) {
    selectedClockIndex.value = 0
    emitClockSelect(0)
  }
}, { immediate: true, deep: true })
</script>

<style lang="scss" scoped>
@import 'devui-theme/styles-var/devui-var.scss';

.playback-progress-container {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background-color: var(--devui-global-bg);
  border-top: 1px solid var(--pto-border-default);
}

.progress-left-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  gap: 4px;
  border: none;
  background: var(--ma-playbtn-bg);
  color:  var(--pto-font-color-sub);;
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover,
  &:active {
    background-color: var(--pto-background-hover);
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.play-btn {
  width: 36px;
  height: 36px;
  background-color: #007acc;
  color: white;
  border-radius: 50%;

  &:hover {
    background-color: #0066b3;
    color: white;
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.progress-bar-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: clip;
  scrollbar-gutter: stable;
  display: flex;
  align-items: flex-start;
  padding-top: 4px;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
  }
}

.progress-track-container {
  height: 16px;
}

.progress-track {
  position: relative;
  height: 16px;
  background-color: var(--devui-swim-detail-bg);
  border-radius: 122px;
  cursor: pointer;
}

.track-line {
  width: 0px;
  height: 12px;
  border: 1px solid var(--pto-border-default);
}

.progress-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  background-color: var(--ma-progress-dot);
  border: none;
  border-radius: 50%;
  cursor: default;
  transition: all 0.2s;
  z-index: 2;

  &.large-dot {
    width: 8px;
    height: 8px;
    background-color: transparent;
    border: 2px solid var(--ma-progress-dot);
    cursor: pointer;

    &:hover {
      border-color: rgba(49, 122, 247, 1);
      background-color: rgba(49, 122, 247, 0.3);
    }

    &.selected {
      border-color: rgba(49, 122, 247, 1);
      background-color: transparent;
    }
  }

  &.in-selected-clock {
    background-color: rgba(49, 122, 247, 1);

    &.large-dot {
      border-color: rgba(49, 122, 247, 1);
      background-color: transparent;
    }
  }
}

.clock-selection-box {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background-color: transparent;
  transition: all 0.2s;
  z-index: 1;
  cursor: pointer;

  &.selected {
    border-color: rgba(49, 122, 247, 1);
    background-color: rgba(49, 122, 247, 0.12);
  }
}

.event-panel {
  position: absolute;
  width: 200px;
  background-color: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #3c3c3c;
  color: #cccccc;
  font-size: 12px;
  font-weight: 500;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--pto-font-color-sub);
  font-size: 16px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background-color: #4a4a4a;
    color: #cccccc;
  }
}

.event-list {
  max-height: 200px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #3c3c3c;
}

.event-type {
  color: #cccccc;
  font-size: 12px;
}

.event-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 4px 8px;
  border: none;
  background-color: #3c3c3c;
  color: var(--pto-font-color-sub);
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background-color: #4a4a4a;
    color: #cccccc;
  }

  &.play {
    background-color: #007acc;
    color: white;

    &:hover {
      background-color: #0066b3;
    }
  }
}

.progress-right-controls {
  position: relative;
}

.speed-selector {
  display: flex;
  align-items: center;
  gap: 4px;
}

.speed-label {
  color: var(--pto-font-color-sub);
  font-size: 12px;
  margin-right: 4px;
  margin-bottom: 1px;
}

.speed-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--pto-font-color-sub);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  width: 42px;
  background-color: var(--ma-speed-bg);

  &:hover {
    background-color: var(--pto-background);
    color: var(--pto-font-color-main);
  }

  &.active {
    background-color: var(--ma-speed-active-bg);
    border: 1px solid #007acc;
    color: var(--ma-speed-active-text);
  }
}

.speed-more {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--pto-font-color-sub);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background-color: #2d2d2d;
    color: #cccccc;
  }

  svg {
    width: 12px;
    height: 12px;
  }
}
</style>
