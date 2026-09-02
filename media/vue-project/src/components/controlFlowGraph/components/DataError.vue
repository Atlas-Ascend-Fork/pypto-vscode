<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<script setup lang="ts">
import { toRef } from 'vue';

import SourceCodeIcon from '@/components/icons/source-code-icon.vue';
import SwimlaneIcon from '@/components/icons/swimlane-icon.vue';
import PtoButton from '@/components/ui/PtoButton.vue';
import { useOutputNav } from '@/hooks/use-output-nav';
import { openSwimlaneGraph } from '@/apis/opener';

const props = defineProps<{
  message: string;
  outputPath: string;
}>();

const { sourceCodeFile, swimlaneFile } = useOutputNav(toRef(props, 'outputPath'));

function openSourceCodeFile() {
  // TODO rundata未包含源代码路径
}

function openSwimlaneFile() {
  openSwimlaneGraph({ swimlaneGraphPath: swimlaneFile.value });
}
</script>

<template>
  <div class="error-message">
    <div>{{ message }}</div>
    <div class="links">
      <PtoButton v-if="sourceCodeFile" :icon="SourceCodeIcon" @click="openSourceCodeFile">{{
        $t('controlFlows.openSourceCode')
      }}</PtoButton>
      <PtoButton v-if="swimlaneFile" :icon="SwimlaneIcon" @click="openSwimlaneFile">{{ $t('controlFlows.openSwimlane') }}</PtoButton>
    </div>
  </div>
</template>

<style lang="less" scoped>
.error-message {
  text-align: center;

  .links {
    margin-top: 12px;
  }
}
</style>
