<template>
    <d-splitter class="splitter-border" :showCollapseButton="false" orientation="vertical" :disableBarSize="disableBarSize">
      <template v-slot:DSplitterPane>
        <d-splitter-pane 
            :size="size" 
            minSize="50%" 
            :collapsible="false" 
            :resizable="true"
            :maxSize="'80%'"
            @sizeChange="sizeChange"
        >
          <div class="pane-content">
            <div class="memory-header">
              <div class="header-left">
                <span class="header-text">模拟执行内存分配</span>
                <span class="header-size">910B</span>
              </div>
              <div class="legend-container">
                <div class="legend-item">
                  <span class="legend-color square"></span>
                  <span class="legend-text">1KB (1024B)</span>
                </div>
                <div class="legend-item">
                  <span class="legend-color circle"></span>
                  <span class="legend-text">128KB</span>
                </div>
                <div class="legend-item">
                  <svg class="legend-hexagon" viewBox="0 0 24 24">
                    <polygon points="12,2 22,8 22,18 12,24 2,18 2,8" fill="#626263"/>
                  </svg>
                  <span class="legend-text">8192KB</span>
                </div>
              </div>
            </div>
            <div class="memory-content">
              <div class="memory-container">
                <ComGraphMemory :events="events" :graphData="currentGraphData" :animationData="selectedAnimationData" :animationSpeed="animationSpeed || 1" :onlyUpdateSpeed="finalOnlyUpdateSpeed" :disableLoading="isPlayingAll" :GMData="GMData" @initialized="handleGraphMemoryInitialized"></ComGraphMemory>
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
            <div v-else class="empty-state">
              <span>请选择时间轴上的Clock查看事件</span>
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
            <span class="title">事件详情</span>
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
import ComGraphMemory from './comGraphMemory.vue';
import { mockMemoryGraphData } from './memoryGraph.type'
import { mockAnimationItem } from './memoryGraph.type';
import { useMoveable } from './layerControl/use-moveable';
import { ComGraphContext, ComGraphProvideKey } from './type';
import { useViewServer } from '../../core/use-view-server';
import type { IMemoryTraceViewServer } from 'ext:/view/servers/view-server-interface';
import { mockTimeList } from './memoryGraph.type';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';

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

const memoryTypeKeyNames = ['MEM_GM', 'MEM_L2', 'MEM_L1', 'MEM_L0A', 'MEM_L0B', 'MEM_BT', 'MEM_FP', 'MEM_L0C', 'MEM_UB'];
const memoryTypeSizeMap = {
  MEM_GM: {
    size: 4194304,
    bufferList: [],
  },
  MEM_L2: {
    size: 32768,
    bufferList: [],
  },
  MEM_L1: {
    size: 512,
    bufferList: [],
  },
  MEM_L0A: {
    size: 68,
    bufferList: [],
  },
  MEM_L0B: {
    size: 68,
    bufferList: [],
  },
  MEM_BT: {
    size: 48,
    bufferList: [],
  },  
  MEM_FP: {
    size: 24,
    bufferList: [],
  },
  MEM_L0C: {
    size: 256,
    bufferList: [],
  },
  MEM_UB: {
    size: 248,
    bufferList: [],
  },
}

// 使用 ViewServer 获取后端数据
const { server } = useViewServer<IComViewServer>();

const emit = defineEmits<{
  (e: 'timeline-change', timeline: any[]): void
  (e: 'play-animation'): void
}>();


const GMData = ref<any>({
  size: 4294967296,
  bufferList: [],
});

const size = ref('60%');
const disableBarSize = '2px';
const showDetailModal = ref(false);
const selectedEvent = ref<Event | null>(null);
const selectedEventJson = ref('');
const selectedAnimationData = ref<null>;

const graphMemoryInitialized = ref(false);
const pendingGraphData = ref<any>(null);
const localOnlyUpdateSpeed = ref(false);
const isPlayingAll = ref(false);
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
  console.log('[MemoryTrace] InitMemoryTraceFlag changed:', newVal);
  if (newVal) {
    console.log('[MemoryTrace] ===== Server ready, 开始调用后端接口 =====');
    server.getMemTraceFile();
    console.log('[MemoryTrace]  调用 getMetadata()');
    // InitMemoryTraceFlag触发前已经调用getMetadata()

    console.log('[MemoryTrace]  调用 getTimelineEvents()');
    server.getTimelineEvents();
    
    // server.getChipConfig({chipArch:"DAV_2201"});  吗，目前感觉前端页面写死好一些 后端读配置文件 还得考虑配置文件打包问题

    console.log('[MemoryTrace] ===== 接口调用完成，等待后端 setRef 触发 =====');
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

  console.log('[MemoryTrace] GMData changed, count:', newVal?.length || 0);
  if (timelineData?.length > 0) {
    console.log('[MemoryTrace] Timeline first item:', JSON.stringify(timelineData[0]));
  }
  emit('timeline-change', timelineData);
});

watch(server.MemTraceFileFlag, (newVal) => {
  if (newVal) {
    console.log('[MemoryTrace] MemTraceFileFlag：' + newVal);
  }
});

watch(server.Metadata, (newVal) => {
  console.log('[MemoryTrace] Metadata changed:', newVal);
});




const dealGraphData = (bufferList: any[]) => {
  const graphData = {};
  Object.keys(memoryTypeSizeMap).forEach(key => {
    graphData[key] = {
      size: memoryTypeSizeMap[key].size,
      bufferList: bufferList.filter(item => item.memType === key).filter(item => item.status !== 0) || [],
    }
  })
  return graphData;
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
  const duration = (endTime - startTime) * 10;
  
  playingEventId.value = event.id;
  setTimeout(() => {
    if (playingEventId.value === event.id) {
      playingEventId.value = null;
    }
  }, duration + 1000);
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
@import 'devui-theme/styles-var/devui-var.scss';
.splitter-border {
  height:100%;
  background-color: var(--devui-global-bg);
}

.pane-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;
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
    color: rgba(153, 153, 153, 1);
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
      background-color: #336EB2;
      border-radius: 2px;
    }

    &.circle {
      background-color: #6E7B8B;
      border-radius: 50%;
    }
  }

  .legend-hexagon {
    width: 12px;
    height: 12px;
  }

  .legend-text {
    font-size: 12px;
    color: rgba(136, 136, 136, 1);
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
    background-color: var(--pto-background-disable);
    border: none;
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

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  color: var(--pto-font-color-disabled);
  font-size: 12px;
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
