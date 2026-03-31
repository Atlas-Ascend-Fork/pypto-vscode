<template>
  <div 
    class="pinned-thread-label"
    :style="{ height: getThreadHeight(pinnedThread.processKey, pinnedThread.thread.tid, lane2line, layout, pinnedThread.thread.isCounter) + 'px' }"
  >
    <!-- 左侧常驻的取消置顶图标 -->
    <d-tooltip :content="$t('unpinThread')" position="right">
      <d-icon
        name="icon-pushpin-fill"
        class="unpin-icon"
        @click="handleUnpin"
      >
      </d-icon>
    </d-tooltip>
    
    <!-- 线程名称 -->
    <span class="thread-name">{{ pinnedThread.thread.threadName || pinnedThread.threadKey }}</span>
  </div>
</template>

<script setup>
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { getThreadHeight } from '../swimGraphUtils';

const { t: $t } = useI18n();
const props = defineProps({
  pinnedThread: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  }
});

const { layout, lane2line } = inject('swimGraphState');
const { unpinThread } = inject('swimGraphPinnedState');

const handleUnpin = () => {
  unpinThread(props.pinnedThread.processKey, props.pinnedThread.threadKey);
};
</script>

<style scoped>
.pinned-thread-label {
  padding-left: 36px;
  display: flex;
  align-items: center;
  line-height: 20px;
  position: relative;
  color: var(--devui-thread-text);
  border-bottom: 1px solid var(--devui-swim-split-line);
  border-right: 1px solid var(--devui-swim-split-line);
}

.unpin-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--devui-primary-button-bg);
}

.unpin-icon:hover {
  color: var(--devui-primary-button-hover-bg);
}

.thread-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
</style>
