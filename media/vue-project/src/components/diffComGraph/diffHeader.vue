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
  <div class="diff-header">
    <div class="file-name" :title="fileName">{{ fileName }}</div>
    <d-icon class="change-icon" v-if="isChangeable" name="icon-sequence-new" size="16px"></d-icon>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  fileName: String,
  isChangeable: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped lang="scss">
.diff-header {
  display: flex;
  align-items: center;
  position: absolute;
  top: 0;
  z-index: 10;
  width: 100%;
  height: 52px;
  line-height: 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--devui-primary-text);
  padding: 16px;
  box-sizing: border-box;
  background: var(--devui-header-gradient-bg);
  user-select: none;
  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .change-icon {
    cursor: pointer;
  }
}
</style>
