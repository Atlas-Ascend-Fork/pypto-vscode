<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 -->
<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 已全部加载 */
    allLoaded: boolean;

    /** 触发加载更多的滚动距离（最小48） */
    distance?: number;
  }>(),
  {
    distance: 200,
  },
);

const emit = defineEmits<{
  (e: 'loadMore'): void;
}>();

/** 加载更多可见高度 */
const VISIBLE_HEIGHT = 48;

// 样式
const height = computed(() => `${Math.max(props.distance, VISIBLE_HEIGHT)}px`);
const marginTop = computed(() => `${VISIBLE_HEIGHT - Math.max(props.distance, VISIBLE_HEIGHT)}px`);

// 监听滚动触底
const triggerRef = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;

const initObserver = () => {
  if (observer) {
    return;
  }
  observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !props.allLoaded) {
      emit('loadMore');
    }
  }, {
    rootMargin: `0px 0px ${props.distance}px 0px`
  });
};

const updateObserver = () => {
  if (!triggerRef.value) {
    return;
  }

  if (props.allLoaded) {
    if(observer) {
      observer.unobserve(triggerRef.value);
    }
  } else {
    if(observer) {
      observer.observe(triggerRef.value);
    }
  }
};

watch(
  [() => props.allLoaded, triggerRef],
  ([isAllLoaded, target]) => {
    if (!target) {
      return;
    }
    updateObserver();
  },
  { immediate: true },
);

// 挂载时初始化
onMounted(() => {
  initObserver();
  updateObserver();
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});

// 暴露reObserver方法给父组件
defineExpose({
  reObserver: () => {
    if (observer && triggerRef.value) {
      observer.unobserve(triggerRef.value);
      nextTick(() => {
        if (observer && triggerRef.value) {
          observer.observe(triggerRef.value);
        }
      });
    }
  }
});

</script>

<template>
  <div ref="triggerRef" class="load-more-trigger" :style="{ height, marginTop }">
    <div class="loading-tip">
      {{ allLoaded ? $t('public.allLoaded') : $t('public.loading') }}
    </div>
  </div>
</template>

<style lang="less" scoped>
.load-more-trigger {
  width: 100%;
  display: flex;
  flex-direction: column-reverse;

  .loading-tip {
    height: 48px;
    line-height: 48px;
    text-align: center;
  }
}
</style>
