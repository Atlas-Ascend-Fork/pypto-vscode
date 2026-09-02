<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<template>
    <d-splitter class="splitter-border" :class="{ 'fullscreen': isFullscreen }" :showCollapseButton="false" orientation="vertical" :disableBarSize="disableBarSize">
      <template v-slot:DSplitterPane>
        <d-splitter-pane 
            :size="size" 
            minSize="50%" 
            :collapsible="false" 
            :resizable="true"
            :maxSize="'80%'"
            @sizeChange="sizeChange"
            ref="splitterPane"
        >
          <div class="pane-content">
            <div class="memory-header">
              <div class="header-left">
                <span class="header-text">{{ $t('simulatedExecutionMemoryAllocation') }}</span>
                <span class="header-size">{{ chipDisplayName }}</span>
              </div>
              <div class="legend-container">
                <div v-for="item in chipConfig.legend" :key="`${item.shape}-${item.label}`" class="legend-item">
                  <svg v-if="item.shape === 'hexagon'" class="legend-hexagon" viewBox="0 0 24 24">
                    <polygon points="12,2 22,8 22,18 12,24 2,18 2,8" fill="var(--ma-legend-hexagon)" />
                  </svg>
                  <span v-else class="legend-color" :class="item.shape"></span>
                  <span class="legend-text">{{ item.label }}</span>
                </div>
                <button class="fullscreen-btn" @click="toggleFullscreen">
                  <d-icon :name="isFullscreen ? 'icon-zoom-screen' : 'icon-full-screen'" size="16px"></d-icon>
                </button>
              </div>
            </div>
            <div class="memory-content">
              <div class="memory-container">
                <ComGraphMemory :events="events" :chipConfig="chipConfig" :graphData="currentGraphData" :animationData="selectedAnimationData" :animationSpeed="animationSpeed || 1" :onlyUpdateSpeed="finalOnlyUpdateSpeed" :disableLoading="isPlayingAll" :GMData="GMData" @initialized="handleGraphMemoryInitialized"></ComGraphMemory>
              </div>
            </div>
          </div>
        </d-splitter-pane>
        <d-splitter-pane>
          <div class="pane-content">
            <div v-if="events.length > 0" class="event-header">
              <span class="header-title">Clock: {{ clockName }} ({{ events.length }})</span>
              <button class="header-play-btn" @click="handlePlayAllEvents">
                <d-icon name="icon-run-o" size="16px"></d-icon>
              </button>
            </div>
            <div v-if="events.length > 0" class="event-list-container">
              <div v-for="event in events" :key="event.id" class="event-item" :class="{ 'playing': playingEventId === event.id }">
                <div class="event-info" @click="openDetailModal(event)">
                  <span class="event-type">{{ event.eventType }}</span>
                  <span class="event-id">#{{ event.id }}</span>
                </div>
                <button class="event-play-btn" @click="handlePlayEvent(event)">
                  <d-icon name="icon-run-o" size="16px"></d-icon>
                </button>
              </div>
            </div>
            <div v-else>
              <div class="transition-overlay">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading...</div>
              </div>
            </div>
          </div>
        </d-splitter-pane>
      </template>
    </d-splitter>

    <Teleport to="body">
      <div v-if="showDetailModal" ref="rootEl" class="detail-modal-container" :style="styles">
        <div ref="dragEl" class="drag-area">
          <em class="icon icon-drag"></em>
          <em class="icon icon-drag"></em>
        </div>
        <div class="content-wrap">
          <div class="header">
            <span class="title">{{ $t('eventDetail') }}</span>
            <em class="icon icon-close" @click="showDetailModal = false"></em>
          </div>
          <div class="json-content">
            <pre>{{ selectedEventJson }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphMemory from './comGraphMemory.vue';
import { mockMemoryGraphData } from './memoryGraph.type'
import { mockAnimationItem } from './memoryGraph.type';
import { useMoveable } from './layerControl/use-moveable';
import { ComGraphContext, ComGraphProvideKey } from './type';
import { useViewServer } from '../../core/use-view-server';
import type { IMemoryTraceViewServer } from 'ext:/view/servers/view-server-interface';
import { mockTimeList } from './memoryGraph.type';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { selectChipConfig } from '../../config/chip-config-loader';
import { buildGraphDataFromBuffers } from './memoryGraphAdapter';

const { t: $t } = useI18n();
const { updateRunningNode } = inject(ComGraphProvideKey, undefined) as ComGraphContext | undefined;

interface Event {
  id: string;
  eventType: string;
  startTime: number;
  endTime: number;
  animationData: any[];
  action: any;
  clock: number;
  filePath: string;
  _index: number;
}

interface FrontendBuffer {
  memoryId: string;
  startLocation: number;
  size: number;
  status: 0 | 1 | 2;
  Address: string;
}

const props = withDefaults(defineProps<{
  events?: Event[]
  graphData?: any
  clock?: number
  animationSpeed?: number
  onlyUpdateSpeed?: boolean
  clockName?: number
}>(), {
  events: () => [],
  onlyUpdateSpeed: false,
  clockName: 0,
});

// 使用 ViewServer 获取后端数据
const { server } = useViewServer<IComViewServer>();

const metadataChipArch = computed(() => {
  const chipArch = (server.Metadata.value as any)?.chipArch;
  return chipArch === undefined || chipArch === null ? undefined : String(chipArch);
});
const selectedChipConfig = computed(() => selectChipConfig(metadataChipArch.value));
const chipConfig = computed(() => selectedChipConfig.value.config);
const chipDisplayName = computed(() => chipConfig.value.chip.displayName);

const emit = defineEmits<{
  (e: 'timeline-change', timeline: any[]): void
  (e: 'play-animation'): void
  (e: 'mem-trace-file-change', data: { existTraceFile: boolean; isComFile: boolean }): void
}>();


const GMData = ref<any>({
  size: 4294967296,
  bufferList: [],
});

const size = ref('60%');
const splitterPane = ref();
const disableBarSize = '2px';
const showDetailModal = ref(false);
const selectedEvent = ref<Event | null>(null);
const selectedEventJson = ref('');
const selectedAnimationData = ref<any>(null);
const isFullscreen = ref(false);

const graphMemoryInitialized = ref(false);
const pendingGraphData = ref<any>(null);
const localOnlyUpdateSpeed = ref(false);
const isPlayingAll = ref(false);

// 存储从 server.getMemTraceFile 获取的值
const existTraceFile = ref(false);
const isComFile = ref(false);
const currentPlayingIndex = ref(0);
let playTimer: ReturnType<typeof setTimeout> | null = null;
const playingEventId = ref<string | null>(null);

const { dragEl, rootEl, styles } = useMoveable({ modelValue: showDetailModal });

watch(() => props.events, (newEvents) => {
  // 切换 clock 事件列表时自动关闭详情弹窗
  showDetailModal.value = false;
  selectedEvent.value = null;
  
  if (newEvents && newEvents.length > 0) {
    const firstEvent = newEvents[0];
    if (firstEvent?.action?.originBufferList) {
      const processedGraphData = dealGraphData(firstEvent.action.originBufferList);
      pendingGraphData.value = processedGraphData;
    }
  }
  selectedAnimationData.value = null;
});

watch(() => props.graphData, (newGraphData) => {
  if (graphMemoryInitialized.value) {
    pendingGraphData.value = newGraphData;
  } else {
    pendingGraphData.value = newGraphData;
  }
});
// 初始化数据
onMounted(async () => {
  server.getInitialMemoryData();
});

// 监听 InitMemoryTraceFlag 变化 - 代表 server 准备好了，可以开始调用接口
watch(server.InitMemoryTraceFlag, (newVal) => {
  if (newVal) {
    // InitMemoryTraceFlag触发前已经调用getMetadata()
    server.getMemTraceFile();
    server.getTimelineEvents();
  }
});

watch(server.Timeline, (newVal) => {
  console.log('[MemoryTrace] Timeline changed, count:', newVal?.length || 0);
  const timelineData = newVal.filter(item => item.clock !== -1);
  const GMClock = newVal.filter(item => item.clock === -1)[0];
  
  if (GMClock) {
    const GMOriginBufferList = [...GMClock.events[GMClock.events.length - 1].action.originBufferList || []];
    const GMTargetBufferList = GMClock.events[GMClock.events.length - 1].action.targetBufferList || [];
    GMTargetBufferList.forEach((item, index) => {
      const targetIndex = GMOriginBufferList.findIndex(originItem => originItem.memId === item.memId);
      if (targetIndex === -1) {
        GMOriginBufferList.push(item);
  
      } else {
        GMOriginBufferList[targetIndex] = item;
      }
    })
    GMData.value.bufferList = GMOriginBufferList;
  }
  emit('timeline-change', timelineData);
});

watch(server.MemTraceFileFlag, (newVal) => {
  if (newVal) {
    // 存储到本地变量
    existTraceFile.value = newVal.existTraceFile ?? false;
    isComFile.value = newVal.isComFile ?? false;

    // 发送给父组件
    emit('mem-trace-file-change', {
      existTraceFile: existTraceFile.value,
      isComFile: isComFile.value
    });
  }
});

watch(server.Metadata, (newVal) => {
  const selection = selectChipConfig((newVal as any)?.chipArch ? String((newVal as any).chipArch) : undefined);
  if (selection.warning) {
    console.warn(`[MemoryTrace] ${selection.warning}`);
  }
  selection.validation.warnings.forEach(warning => console.warn(`[MemoryTrace] ${warning}`));
  selection.validation.errors.forEach(error => console.error(`[MemoryTrace] ${error}`));
});

const dealGraphData = (bufferList: any[]) => {
  return buildGraphDataFromBuffers(chipConfig.value, bufferList || []);
}

const sizeChange = (newSize: number) => {
};

const handleGraphMemoryInitialized = () => {
  graphMemoryInitialized.value = true;
};

const currentGraphData = computed(() => {
  if (!graphMemoryInitialized.value) {
    return null;
  }
  return pendingGraphData.value;
});

const finalOnlyUpdateSpeed = computed(() => {
  return props.onlyUpdateSpeed;
});

const openDetailModal = (event: Event) => {
  selectedEvent.value = event;
  const eventJson = {...event}
  delete eventJson.action;  
  delete eventJson.id;
  delete eventJson.filePath;
  selectedEventJson.value = JSON.stringify(eventJson, null, 2);
  showDetailModal.value = true;
};

const handlePlayEvent = (event: Event) => {
  selectedAnimationData.value = {
    ...event,
    _timestamp: Date.now()
  };
  emit('play-animation');
  if (event.action?.originBufferList) {
    const graphData = dealGraphData(event.action.originBufferList);
    pendingGraphData.value = {
      ...graphData,
      _timestamp: Date.now()
    };
    updateRunningNode(event.opMagic ?? '');
  }
  
  const startTime = event.clock || 0;
  const endTime = event.cycleEnd || startTime + 100;
  let duration = (endTime - startTime) * 10 ;
  if (event.eventType === 'ALLOC_FAIL') {
    duration = 3200;
  }

  playingEventId.value = event.id;
  setTimeout(() => {
    if (playingEventId.value === event.id) {
      playingEventId.value = null;
    }
    updateRunningNode('');
  }, (duration + 1000) / props.animationSpeed);
};

const handlePlayAllEvents = () => {
  if (isPlayingAll.value) {
    stopPlayAll();
    return;
  }
  
  isPlayingAll.value = true;
  currentPlayingIndex.value = 0;
  playNextEvent();
};

const playNextEvent = () => {
  if (!isPlayingAll.value || currentPlayingIndex.value >= props.events.length) {
    stopPlayAll();
    return;
  }
  
  const event = props.events[currentPlayingIndex.value];
  handlePlayEvent(event);

  const startTime = event.clock || 0;
  const endTime = event.cycleEnd || startTime + 100;
  
  const duration = (endTime - startTime) * 10;
  currentPlayingIndex.value++;
  
  playTimer = setTimeout(() => {
    playNextEvent();
  }, duration);
};

const stopPlayAll = () => {
  isPlayingAll.value = false;
  currentPlayingIndex.value = 0;
  if (playTimer) {
    clearTimeout(playTimer);
    playTimer = null;
  }
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

watch(showDetailModal, (val) => {
  if (val) {
    setTimeout(() => {
      const modalWidth = 360;
      const modalHeight = 400;
      const left = Math.max(0, (window.innerWidth - modalWidth) / 2);
      const top = Math.max(0, (window.innerHeight - modalHeight) / 2);
      styles.left = `${left}px`;
      styles.top = `${top}px`;
    }, 0);
  }
});
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;
.splitter-border {
  height:100%;
  background-color: var(--devui-global-bg);

  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: calc(100vh - 40px);
    bottom: 60px;
    z-index: 999;
    background-color: var(--devui-global-bg);
  }
}

.pane-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;

  .transition-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--devui-global-bg);
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .loading-spinner {
      width: 30px;
      height: 30px;
      border: 2px solid var(--pto-border-default);
      border-top-color: #4a9eff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .loading-text {
      margin-top: 16px;
      color: var(--pto-font-color-main);
      font-size: 14px;
      font-family: 'Inter', sans-serif;
    }
  }
}

.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 34px;
  padding: 12px;
  box-sizing: border-box;

  .header-left {
    display: flex;
    align-items: center;
  }

  .header-text {
    font-size: 14px;
    font-weight: 700;
    font-style: bold;
  }

  .header-size {
    margin-left: 14px;
    font-size: 13px;
    font-weight: 400;
    color: var(--pto-font-color-sub);
  }

  .legend-container {
    display: flex;
    gap: 20px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-color {
    width: 12px;
    height: 12px;

    &.square {
      background-color: var(--ma-legend-square);
      border-radius: 2px;
    }

    &.circle {
      background-color: var(--ma-legend-circle);
      border-radius: 50%;
    }
  }

  .legend-hexagon {
    width: 12px;
    height: 12px;
  }

  .fullscreen-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--pto-font-color-default);
    display: flex;
    border-radius: 4px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--pto-bg-color-hover);
    }

    &:active {
      background-color: var(--pto-bg-color-active);
    }
  }

  .legend-text {
    font-size: 12px;
    color: var(--devui-thread-text);
  }
}

.memory-content {
  flex: 1;
  padding: 12px 4px 4px 4px;
  box-sizing: border-box;
  min-height: 0;

  .memory-container {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 1);
  }
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 8px;
  flex-shrink: 0;

  .header-title {
    font-size: 14px;
    font-weight: 500;
  }

  .header-play-btn {
    width: 28px;
    height: 28px;
    display: flex;
    justify-content: center;
    margin-right: 6px;
    align-items: center;
    flex-direction: row;
    padding: 8px;
    background-color: var(--ma-playbtn-bg);
    border: 1px solid var(--ma-playbtn-border);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s;

  }
}

.event-list-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0 4px;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
  }
}

.event-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--pto-background);
  border-radius: 8px;
  background-color: var(--pto-background-disable);
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--pto-background);
  }
  
  &.playing {
    border-color: #336EB2;
    background-color: rgba(51, 110, 178, 0.15);
  }
  
  &.playing {
    border-color: #336EB2;
    background-color: rgba(51, 110, 178, 0.15);
  }
}

.event-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.event-type {
  font-size: 12px;
  font-weight: 700;
  font-style: bold;
  color: var(--pto-font-color-main);
}

.event-id {
  font-size: 12px;
  font-weight: 400;
  font-style: regular;
  color: var(--pto-font-color-placeholder);
}

.event-play-btn {
  width: 20px;
  height: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px;
  border: none;
  background-color: var(--pto-background-disable);
  font-size: 11px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;

}

.detail-modal-container {
  position: fixed;
  z-index: 1060;
  width: 360px;
  color: var(--devui-primary-text);
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-shadow: 0 0 16px 0 var(--devui-select-shadow);

  .drag-area {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 16px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    background-color: var(--devui-nest-bg);
    cursor: move;

    .icon-drag {
      transform: rotate(90deg);

      &:nth-of-type(2) {
        margin-left: -1px;
      }
    }
  }

  .content-wrap {
    width: 100%;
    padding: 16px;
    box-sizing: border-box;

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .title {
        font-size: 16px;
        font-weight: bold;
        line-height: 24px;
      }

      .icon-close {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;

        &:hover {
          background-color: var(--devui-form-control-bg-hover);
        }
      }
    }

    .json-content {
      max-height: 400px;
      overflow-y: auto;

      pre {
        margin: 0;
        padding: 12px;
        background-color: var(--devui-global-bg);
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        line-height: 1.5;
        color: var(--pto-font-color-main);
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
  }
}
</style>
