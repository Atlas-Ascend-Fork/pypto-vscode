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
<template>
  <div class="limit-info">
    <img :src="iconPath" alt="" />
    <span class="label">{{ label }}：</span>
    <span class="value">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { limitInfoProps } from './types';

const props = defineProps(limitInfoProps);

const iconPath = computed(() => `${(window as any).staticPath}/static-assets/com-graph/${props.type}.svg`);
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.limit-info {
  display: flex;
  align-items: center;
  gap: 4px;

  .label,
  .value {
    font-size: 14px;
    line-height: 22px;
  }

  .label {
    color: var(--devui-placeholder-text);
  }

  .value {
    color: var(--devui-secondary-text);
    margin-left: -4px;
  }
}
</style>
