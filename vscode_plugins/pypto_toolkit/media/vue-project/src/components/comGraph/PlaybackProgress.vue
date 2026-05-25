<template>
  <div class="playback-progress-container">
    <div class="progress-left-controls">
      <button class="control-btn" title="上一个" @click="prevClock">
        <d-icon name="icon-run-o" :rotate="180" size="16px"></d-icon>
      </button>
      <button class="control-btn" title="下一个" @click="nextClock">
        <d-icon name="icon-run-o" size="16px"></d-icon>
      </button>
      <!-- <button class="control-btn" title="重播" style="width: 80px;">
        <d-icon name="icon-recover" size="16px"></d-icon>
        <span>Replay</span>
      </button> -->
    </div>

    <div class="track-line"></div>
    <div class="progress-bar-wrapper">
      <div class="progress-track">
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
        <div
          v-for="(dot, index) in dots"
          :key="index"
          class="progress-dot"
          :class="{ 
            'large-dot': dot.isLarge, 
            'selected': dot.isLarge && selectedClockIndex === dot.clockIndex,
            'in-selected-clock': selectedClockIndex === dot.clockIndex
          }"
          :style="{ left: dot.position + '%' }"
          @click="handleDotClick(dot.clockIndex)"
        ></div>
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
import { mockMemoryGraphData1, mockMemoryGraphData2, mockMemoryGraphData3 } from './memoryGraph.type'
import { mockAnimationItem, mockErrorAnimationItem, mockTidyAnimationItem } from './memoryGraph.type'
import { MemoryGraphData } from './memoryGraph.type'

interface Event {
  id: string
  eventType: string
  startTime: number
  endTime: number
  animationData: any[]
  graphData: MemoryGraphData
}

interface Clock {
  events: Event[]
}

interface Dot {
  isLarge: boolean
  position: number
  clockIndex: number
}

const emit = defineEmits<{
  (e: 'clock-select', events: Event[], graphData: MemoryGraphData | null, speed: number, onlyUpdateSpeed: boolean): void
  (e: 'speed-change', speed: number, onlyUpdateSpeed: boolean): void
}>()

const selectedClockIndex = ref<number>(0)
const selectedSpeed = ref<number>(1)

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

  if (!props.clocks || props.clocks.length === 0) {
    return result
  }

  let totalDotCount = props.clocks.length
  props.clocks.forEach(clock => {
    totalDotCount += clock.events.length
  })

  if (totalDotCount === 0) {
    return result
  }

  let currentIndex = 0
  props.clocks.forEach((clock, clockIndex) => {
    const position = 1 + (currentIndex / (totalDotCount - 1)) * 98
    result.push({
      isLarge: true,
      position,
      clockIndex
    })
    currentIndex++

    for (let i = 0; i < clock.events.length; i++) {
      const position = 1 + (currentIndex / (totalDotCount - 1)) * 98
      result.push({
        isLarge: false,
        position,
        clockIndex
      })
      currentIndex++
    }
  })

  return result
})

const clockBoxes = computed(() => {
  const result: { left: number; width: number }[] = []

  if (!props.clocks || props.clocks.length === 0) {
    return result
  }

  let totalDotCount = props.clocks.length
  props.clocks.forEach(clock => {
    totalDotCount += clock.events.length
  })

  if (totalDotCount === 0) {
    return result
  }

  let currentIndex = 0
  props.clocks.forEach((clock, clockIndex) => {
    const largeDotPosition = 1 + (currentIndex / (totalDotCount - 1)) * 98
    currentIndex++

    let lastDotPosition = largeDotPosition
    for (let i = 0; i < clock.events.length; i++) {
      lastDotPosition = 1 + (currentIndex / (totalDotCount - 1)) * 98
      currentIndex++
    }

    const width = lastDotPosition - largeDotPosition + 2
    const left = largeDotPosition - 1

    result.push({
      left,
      width
    })
  })

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

onMounted(() => {
  if (props.clocks && props.clocks.length > 0) {
    emitClockSelect(0)
  }
})

watch(() => props.clocks, (newClocks) => {
  if (newClocks && newClocks.length > 0) {
    selectedClockIndex.value = 0
    emitClockSelect(0)
  }
}, { immediate: true, deep: true })
</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.playback-progress-container {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background-color: #1e1e1e;
  border-top: 1px solid #3c3c3c;
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
  background: rgba(51, 51, 51, 1);
  color: rgba(230, 230, 230, 1);
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background-color: #2d2d2d;
    color: #cccccc;
  }

  &:active {
    background-color: #3c3c3c;
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
  padding: 0 8px;
}

.progress-track {
  position: relative;
  height: 16px;
  background-color: rgba(38, 38, 38, 1);
  border-radius: 122px;
  cursor: pointer;
}

.track-line {
  width: 0px;
  height: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.progress-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  background-color: #6e6e6e;
  border: none;
  border-radius: 50%;
  cursor: default;
  transition: all 0.2s;
  z-index: 2;

  &.large-dot {
    width: 8px;
    height: 8px;
    background-color: transparent;
    border: 2px solid #6e6e6e;
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
  color: #858585;
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

  &:last-child {
    border-bottom: none;
  }
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
  color: #858585;
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
  color: #858585;
  font-size: 12px;
  margin-right: 4px;
  margin-bottom: 1px;
}

.speed-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: #858585;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  width: 42px;

  &:hover {
    background-color: #2d2d2d;
    color: #cccccc;
  }

  &.active {
    background-color: #007acc;
    color: white;
  }
}

.speed-more {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: #858585;
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
