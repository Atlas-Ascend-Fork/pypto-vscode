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
  <div class="tips-info">
    <div class="title">{{ title }}</div>
    <div v-if="count !== undefined" class="count">{{ count }}</div>
  </div>
</template>

<script setup lang="ts">
import { tipsInfoProps } from './types';

defineProps(tipsInfoProps);
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.tips-info {
  .title {
    display: inline-block;
    color: var(--devui-secondary-text);
    font-size: 12px;
    font-weight: 500;
    line-height: 18px;
    margin-right: 4px;
  }


  .count {
    color: var(--devui-primary-text);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }
}
</style>
