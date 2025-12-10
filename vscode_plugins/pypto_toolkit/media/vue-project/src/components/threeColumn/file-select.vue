<template>
    <div class="file-select" @click="() => openSelectedFileWindow()">
      <div class="simple-com-file-name">{{ props.fileName }}</div>
      <div class="icon-line-height"><d-icon name="icon-sequence-new" class="simple-com-file-name-icon" size="16px"></d-icon></div>
    </div>
</template>

<script setup lang="ts">
import { ref, inject, defineProps } from 'vue';
import type { IThreeColumnCtx, GraphType } from './types';
import { ThreeColumnProvideKey } from './types';
import { useViewServer } from '../../core/use-view-server';
import { ThreeColumnServer } from '../../../../../src/core/view/three-column-server';
const { server: threeColumnServer } = useViewServer<ThreeColumnServer>();
const { currentActiveBlock, BlockToGraphMap } = inject(
  ThreeColumnProvideKey,
) as IThreeColumnCtx;

const props = defineProps({
  fileName: {
    type: String,
    default: '',
  },
});
function openSelectedFileWindow() {
    threeColumnServer.singleSelectFile({graphType: BlockToGraphMap[currentActiveBlock.value]});
}

</script>

<style scoped lang="scss">

.file-select {
    display: flex;
    align-items: center;
    justify-self: center;
    gap: 8px;
    cursor: pointer;
}

.simple-com-file-name{
    font-size: 14px;
    font-weight: 700;
    color: rgba(230, 230, 230, 1);
    white-space: normal;
    text-align: left;
}

.simple-com-file-name-icon{
    width: 16px;
    height: 16px;
    color: var(--devui-primary-text);
}

</style>