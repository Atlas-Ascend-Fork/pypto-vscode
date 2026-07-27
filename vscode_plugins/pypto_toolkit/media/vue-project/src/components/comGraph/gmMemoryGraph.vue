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
  <div class="gm-memory-graph">
    <MemoryUsage
      :is-three-column="false"
      graphType="gmMemoryVisual"
    />
  </div>
</template>

<script setup lang="ts">
import MemoryUsage from '../memoryUsage/memoryUsage.vue';
</script>

<style scoped lang="scss">
.gm-memory-graph {
  width: 100%;
  height: 100%;
}
</style>