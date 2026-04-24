<template>
  <div 
    v-if="pinnedThreadsList.length > 0"
    ref="pinnedContainer"
    class="pinned-threads-container"
    :class="{ 'no-shadow': isMixedAicpuKernel || !hasScrolled }"
  >
    <!-- 置顶线程标签区域 -->
    <div class="pinned-threads-labels">
      <pinned-thread-label 
        v-for="(pinnedThread, index) in pinnedThreadsList"
        :key="pinnedThread.id"
        :pinned-thread="pinnedThread"
        :index="index"
      />
    </div>
    
    <!-- 置顶线程事件区域 -->
    <div class="pinned-threads-events">
      <pinned-thread-event ref="pinnedthreadsEventComponent"/>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted, onUnmounted } from 'vue';
import PinnedThreadLabel from './PinnedThreadLabel.vue';
import PinnedThreadEvent from './PinnedThreadEvent.vue';

const pinnedthreadsEventComponent = ref(null);
const pinnedContainer = ref(null);
const hasScrolled = ref(false);
const { pinnedThreadsList } = inject('swimGraphPinnedState', {
  pinnedThreadsList: { value: [] }
});

const {
  childContextMap,
  isMixedAicpuKernel,
  swimlaneContainer
} = inject('swimGraphState');

const handleScroll = () => {
  if (swimlaneContainer && swimlaneContainer.value) {
    hasScrolled.value = swimlaneContainer.value.scrollTop > 0;
  }
};

onMounted(() => {
  if (swimlaneContainer && swimlaneContainer.value) {
    swimlaneContainer.value.addEventListener('scroll', handleScroll);
  }
});

onUnmounted(() => {
  if (swimlaneContainer && swimlaneContainer.value) {
    swimlaneContainer.value.removeEventListener('scroll', handleScroll);
  }
});

const Pinnedtransform = () => {
  pinnedthreadsEventComponent.value.transformPinned();
};

const pinnedDrawLine = (x, color, flag) => {
  pinnedthreadsEventComponent.value.drawPinnedThreadEventline(x, color, flag);
};

const pinnedEraseLine = (flag) => {
  pinnedthreadsEventComponent.value.erasePinnedThreadEventline(flag);
};

const pinnedInitCanvases = () => {
  pinnedthreadsEventComponent.value.pinnedInitCanvases();
};

const pinnedRender = () => {
  pinnedthreadsEventComponent.value.pinnedRender();
};

const changePinnedColor = (isDimmed) => {
  pinnedthreadsEventComponent.value.changePinnedColor(isDimmed);
};

const highlightPinnedEvent = (event, isTemp) => {
  pinnedthreadsEventComponent.value.highlightPinnedEvent(event, true, true, isTemp);
};

const getPinnedHeight = () => {
  if (!pinnedContainer.value) {
    return 0;
  }
  const rect = pinnedContainer.value.getBoundingClientRect();
  return rect.height;
};

defineExpose({
  Pinnedtransform,
  pinnedDrawLine,
  pinnedEraseLine,
  pinnedInitCanvases,
  pinnedRender,
  changePinnedColor,
  highlightPinnedEvent,
  getPinnedHeight,
});
</script>

<style scoped>
.pinned-threads-container {
  display: flex;
  scrollbar-gutter: stable;
  border-bottom: 1px solid var(--devui-swim-split-line);
  box-shadow: 0 8px 8px -2px var(--devui-page-bg);
  z-index: 4;
}

.pinned-threads-container.no-shadow {
  box-shadow: none;
}

.pinned-threads-labels {
  width: 250px;
}

.pinned-threads-events {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
