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
