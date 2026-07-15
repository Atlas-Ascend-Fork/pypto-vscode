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
  <div ref="flowContainer" style="width: 100%; height: 100%; background: var(--ma-memory-container-bg); position: relative;">
    <div v-if="isLoading" class="transition-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading...</div>
    </div>
    <VueFlow
      :nodes="vueFlowNodes"
      :edges="vueFlowEdges"
      class="flow-canvas"
      @nodes-change="onNodesChange"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :pan-on-drag="false"
      :pan-on-scroll="false"
      :selection-on-drag="false"
      :zoom-on-scroll="false"
      :zoom-on-double-click="false"
      :no-pan-on-node-drag="false"
      :fit-view-on-init="true"
      :min-zoom="0.001"
      :max-zoom="100"
      :node-types="nodeTypes"
      :elevate-edges-on-select="true"
      @dblclick.prevent
      @nodes-initialized="onNodesInitialized"
    >
      <template #edge-labeled="props">
        <LabelEdge v-bind="props" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { markRaw, nextTick, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import LabelEdge from './memoryNodes/LabelEdge.vue';
import GridNodeComponent from './memoryNodes/GridNode.vue';
import VectorNodeComponent from './memoryNodes/VectorNode.vue';
import GmNodeComponent from './memoryNodes/GmNode.vue';
import L2NodeComponent from './memoryNodes/L2Node.vue';
import type { ChipConfig } from '../../config/chip-config.types';
import { defaultChipConfig } from '../../config/chip-config-loader';
import { buildMemoryFlow } from './memoryGraphAdapter';

const nodeTypes = {
  gridNode: markRaw(GridNodeComponent),
  vectorNode: markRaw(VectorNodeComponent),
  gmNode: markRaw(GmNodeComponent),
  l2Node: markRaw(L2NodeComponent),
};

interface Props {
  events?: any[];
  graphData?: any;
  animationData?: any;
  animationSpeed?: number;
  onlyUpdateSpeed?: boolean;
  disableLoading?: boolean;
  GMData?: any;
  chipConfig?: ChipConfig;
}

const props = withDefaults(defineProps<Props>(), {
  events: () => [],
  animationSpeed: 1,
  onlyUpdateSpeed: false,
  disableLoading: false,
  GMData: () => ({ size: 4294967296, bufferList: [] }),
});

const emit = defineEmits<{
  (e: 'initialized'): void;
}>();

const { fitView, applyNodeChanges } = useVueFlow();
const flowContainer = ref<HTMLElement | null>(null);
const vueFlowNodes = ref<any[]>([]);
const vueFlowEdges = ref<any[]>([]);
const isLoading = ref(true);
let resizeObserver: ResizeObserver | null = null;

watchEffect(() => {
  if (props.onlyUpdateSpeed) {
    return;
  }

  const flow = buildMemoryFlow(props.chipConfig || defaultChipConfig, props.graphData, props.animationData, props.animationSpeed);
  vueFlowNodes.value = flow.nodes.map(node => ({ ...node }));
  vueFlowEdges.value = flow.edges.map(edge => ({ ...edge }));
});

const onNodesChange = (changes: any[]) => {
  applyNodeChanges(changes);
};

const onNodesInitialized = () => {
  isLoading.value = false;
};

const handleResize = () => {
  fitView({ padding: 0.05, duration: 800 });
};

onMounted(async () => {
  await nextTick();

  setTimeout(() => {
    fitView({
      padding: 0.05,
      duration: 800,
    });
  }, 50);

  if (flowContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(flowContainer.value);
  }

  emit('initialized');
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

<style>
.flow-canvas {
  width: 100%;
  height: 100%;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}
.vue-flow__node {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  cursor: default !important;
  transform-origin: center center;
}
.vue-flow__handle {
  opacity: 0 !important;
}
.vue-flow__edge {
  cursor: default !important;
  vector-effect: non-scaling-stroke;
}
.vue-flow__edge-path {
  cursor: default !important;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.vue-flow__svg {
  shape-rendering: geometricPrecision;
}
.transition-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--devui-global-bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.loading-spinner {
  width: 30px;
  height: 30px;
  border: 2px solid var(--pto-border-default);
  border-top-color: #4a9eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-text {
  margin-top: 16px;
  color: var(--pto-font-color-main);
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
