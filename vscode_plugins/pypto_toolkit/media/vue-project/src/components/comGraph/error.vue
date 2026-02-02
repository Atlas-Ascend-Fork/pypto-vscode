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
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, inject, onMounted } from 'vue';
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
  }
})

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
@import 'devui-theme/styles-var/devui-var.scss';

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
}
</style>