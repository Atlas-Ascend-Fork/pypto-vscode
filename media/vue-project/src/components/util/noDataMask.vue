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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 -->
<template>
  <div class="no-data-mask">
    <div class="no-data-mask-bg"></div>
    <div class="mask-close" @click="emit('close')">
      <d-icon name="close" operable></d-icon>
    </div>
    <div class="no-data-mask-body">
      <img :src="iconPath" alt="" class="mask-icon" />
      <div class="mask-title">{{ text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// 通用半透明遮罩：绝对定位铺满最近的定位父元素（父元素需 position: relative），
// 背景层半透明显露出下层内容，图片/文本层不透明；文本由调用方传入，
// 右上角关闭按钮触发 close 事件，由调用方控制遮罩的显隐
const props = defineProps({
  /** 提示文本（调用方传翻译后的文案） */
  text: { type: String, required: true },
  /** 深色主题（切换图片深/浅色变体） */
  isDark: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const iconPath = computed(() => `${(window as any).staticPath}/static-assets/noFile${props.isDark ? 'Dark' : ''}.png`);
</script>

<style scoped lang="scss">
.no-data-mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
}

.no-data-mask-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: var(--devui-card-bg);
  opacity: 0.9;
}

.mask-close {
  /* 内容层（no-data-mask-body）在 DOM 后且满高，需提升层级避免按钮被盖住（视觉与点击） */
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  font-size: 16px;
  color: var(--devui-icon);
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    color: var(--devui-title-text);
    background-color: var(--devui-input-hover-bg);
  }
}

.no-data-mask-body {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.mask-icon {
  width: 160px;
  height: 160px;
}

.mask-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--devui-category-search-font-color);
}
</style>
