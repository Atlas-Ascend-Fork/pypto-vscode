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
