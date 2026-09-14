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
  <div class="com-graph-error-container">
    <div :style="{
      backgroundImage: 'url(' + errorSvgPath + ')',
      backgroundRepeat: 'repeat',
      backgroundSize: '80px 80px',
      height: '80px',
      width: '80px',
    }"> </div>
    <span class="error-text">{{ props.jsonContent }}</span>
    <span v-if="props.errorLog" class="error-text">{{ props.errorLog }}</span>
    <span v-if="props.swimErrorLog" class="error-text">{{ props.swimErrorLog }}</span>
    <d-button variant="solid" v-if="isThreeColumnStage" @click="openSelectedFileWindow" class="mt10">{{ $t('openFile') }}</d-button>
    <d-button v-if="isShowSelectFile" @click="emit('clickSelectFile')">{{ $t('selectFile') }}</d-button>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue';
import { ThreeColumnProvideKey, type IThreeColumnCtx } from '../threeColumn/types';
import { ThreeColumnServer } from '../../../../../src/core/view/three-column-server';
import { useViewServer } from '../../core/use-view-server';
const { server: threeColumnServer } = useViewServer<ThreeColumnServer>();
const { currentActiveBlock, BlockToGraphMap } = inject(
  ThreeColumnProvideKey,
) as IThreeColumnCtx || {};
const { runDataVisible, isHeaderEnter, missGraphType} = inject('runDataList');

const errorSvgPath = ref(`"${window.staticPath}/static-assets/data_error.svg"`);
const isThreeColumnStage = ref(true);

const props = defineProps({
  jsonContent: {
    type: String,
    default: ''
  },
  errorLog: {
    type: String,
    default: ''
  },
  swimErrorLog: {
    type: String,
    default: ''
  },
  isShowSelectFile: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['clickSelectFile'])

onMounted(() => {
  if(currentActiveBlock === undefined) {
    isThreeColumnStage.value = false;
  }
});

const openSelectedFileWindow = () => {
  runDataVisible.value = true;
  isHeaderEnter.value = false;
  missGraphType.value = BlockToGraphMap[currentActiveBlock.value];
  if (BlockToGraphMap[currentActiveBlock.value] === 'comGraph') {
    missGraphType.value = 'computeGraph';
  }
}

</script>

<style lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.com-graph-error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: $devui-base-bg;
  gap: 32px;


  .error-text {
    color: $devui-text;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    letter-spacing: 0px;
    text-align: center;
    white-space: pre-wrap;
  }

  .mt10 {
    margin-top: 10px;
  }

  .devui-button--solid--primary {
    background: var(--devui-primary-button-bg) !important;

    &:hover {
      background: var(--devui-primary-button-hover-bg) !important;
    }
  }
}
</style>