<template>
  <div ref="flowContainer" style="width: 100%; height: 100%; background: #1a1a1a; position: relative;">
    <div v-if="isTransitioning" class="transition-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading...</div>
    </div>
    <VueFlow
      :key="flowKey"
      v-model="updatedNodes"
      class="flow-canvas"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :pan-on-drag="true"
      :pan-on-scroll="false"
      :selection-on-drag="false"
      :zoom-on-scroll="true"
      :zoom-on-double-click="false"
      :no-pan-on-node-drag="true"
      :fit-view-on-init="true"
      :min-zoom="0.001"
      :max-zoom="100"
      :node-types="nodeTypes"
      :elevate-edges-on-select="true"
      @dblclick.prevent
    >
      <template #edge-labeled="props">
        <LabelEdge v-bind="props" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw, watch, onMounted, nextTick, onBeforeUnmount, computed } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import LabelEdge from './memoryNodes/LabelEdge.vue';
import GridNodeComponent from './memoryNodes/GridNode.vue';
import VectorNodeComponent from './memoryNodes/VectorNode.vue';
import GmNodeComponent from './memoryNodes/GmNode.vue';
import L2NodeComponent from './memoryNodes/L2Node.vue';
import { mockAnimationItem } from './memoryGraph.type';

const nodeTypes = {
  gridNode: markRaw(GridNodeComponent),
  vectorNode: markRaw(VectorNodeComponent),
  gmNode: markRaw(GmNodeComponent),
  l2Node: markRaw(L2NodeComponent),
};

interface Props {
  graphData?: any;
  animationData?: Animation;
  animationSpeed?: number;
  onlyUpdateSpeed?: boolean;
  disableLoading?: boolean;
  GMData?: any;
}

const props = withDefaults(defineProps<Props>(), {
  animationSpeed: 1,
  onlyUpdateSpeed: false,
  disableLoading: false,
  GMData: () => ({ size: 4294967296, bufferList: [] }),
});

const emit = defineEmits<{
  (e: 'initialized'): void
}>();

const { fitView } = useVueFlow();
const flowContainer = ref(null);
let resizeObserver: ResizeObserver | null = null;

const flowKey = ref(0);
const isTransitioning = ref(false);
const transitionStartTime = ref(0);

watch(() => props.graphData, () => {
  if (!props.disableLoading) {
    isTransitioning.value = true;
    transitionStartTime.value = Date.now();
  }
  flowKey.value++;
}, { deep: true });

watch(flowKey, () => {
  setTimeout(() => {
    fitView({ padding: 0.05, duration: 0 });
    if (!props.disableLoading) {
      const elapsed = Date.now() - transitionStartTime.value;
      const remaining = Math.max(0, 1000 - elapsed);
      setTimeout(() => {
        isTransitioning.value = false;
      }, remaining);
    }
  }, 100);
});

const HEXAGON_SIZE = 8192;
const CIRCULAR_SIEE = 128;
const QUADRATE_SIZE = 1;

const blueMould = ['aic-l1', 'aic-l0a', 'aic-l0b', 'aic-bt', 'aic-fp', 'aic-l0c', 'aiv2t-ub', 'aiv2t-simt', 'aiv2t-simd', 'aiv2b-ub', 'aiv2b-simt', 'aiv2b-simd'];

const X_GM = -405;
const X_L2 = -130;
const X_COL1 = 180;
const X_COL2 = 500;
const X_COL3 = 970;
const X_COL4 = 1300;

const Y_T_DCACHE = 30;
const Y_T_NDNA = 148.5;
const Y_T_SCALAR = 32;
const Y_T_UB = 107;
const Y_T_SIMT = 72;
const Y_T_SIMD = 155;
const Y_T_VECTOR = 63;

const Y_AIC_L1 = 225 - 155;
const Y_AIC_L0A = 251 - 225;
const Y_AIC_L0B = 341 - 208.8;
const Y_AIC_BT = 478 - 241.5;
const Y_AIC_FP = 581 - 225;
const Y_AIC_CUBE = 261 - 225;
const Y_AIC_L0C = 261 - 186;
const Y_AIC_DCACHE = 671 - 155;
const Y_AIC_SCALAR = 673 - 155;
const Y_AIC_SS = 671 - 155;

const B = 831 - 755;
const Y_B_DCACHE = B + 65; // center = B+35
const Y_B_NDNA = B + 65; // center = B+134
const Y_B_SCALAR = B + 70; // center = B+35 ✓
const Y_B_UB = B - 70; // center = B+134 ✓
const Y_B_SIMT = B + -15;
const Y_B_SIMD = B + 73;
const Y_B_VECTOR = B + 20;

const FIX_PIP_HIDDEN_X = 573;
const FIX_PIP_HIDDEN_Y = 601.2 - 110;

const elements = ref([
  // ── GM & L2 ──────────────────────────────────────────────
  {
    id: 'gm',
    type: 'gridNode',
    position: { x: X_GM, y: 0 },
    memId: 'MEM_GM',
    data: {
      label: 'GM',
      cols: 16,
      rows: 80,
      filledCount: 800,
      showHeader: false,
      layoutStyles: {
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
      },
      gridSectionStyle: { padding: `1px `, border: '1px solid rgba(255, 255, 255, 0.3)' },
      shape: 'hexagon',
      subBadgeLabel: '4 GB',
      subBadgeStyle: {
        backgroundColor: 'rgba(30, 30, 30, 0.92)',
      },
      badgeStyle: {
        backgroundColor: 'transparent',
        flexDirection: 'column',
      },
      bgColor: 'rgba(57, 57, 57, 1)',
      emptyColor: '#626263',
      splitType: 'horizontal',
      splitData: { 
        label: 'L2',
        type: 'gridNode',
        badgeStyle: {
          backgroundColor: 'transparent', 
          flexDirection: 'column',
        },
        cols: 4,
        rows: 64,
        shape: 'circle',
        filledCount: 228,
        loop: false,
        emptyColor: '#626263',
        filledColor: 'rgba(83, 85, 97, 1)',
        bgColor: 'rgb(137, 154, 174)',
        showHeader: false,
        subBadgeLabel: '32M',
        layoutStyles: {
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
        },
        gridSectionStyle: { height: '100%', display: 'flex', alignItems: 'center', border: 'none' },
        subBadgeStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(9.296957015991211px)',
        },
        speed: 1000,
      },
      handles: [
        { id: 'l2-r-55-px', type: 'source', edge: 'right', pct: '55px' },
        { id: 'l2-r-4', type: 'source', edge: 'right', pct: 4.5 },
        { id: 'l2-r-7', type: 'source', edge: 'right', pct: 7 },
        { id: 'l2-r-12', type: 'source', edge: 'right', pct: 12.5 },
        { id: 'l2-r-15', type: 'source', edge: 'right', pct: 15 },
        { id: 'l2-r-17', type: 'source', edge: 'right', pct: 20 },
        { id: 'l2-r-31', type: 'source', edge: 'right', pct: 29},
        { id: 'l2-r-49', type: 'source', edge: 'right', pct: 45 },
        { id: 'l2-r-57', type: 'source', edge: 'right', pct: 52.1 },
        { id: 'l2-r-62', type: 'source', edge: 'right', pct: 56.5 },
        { id: 'l2-r-68', type: 'source', edge: 'right', pct: 63 },
        { id: 'l2-r-75', type: 'source', edge: 'right', pct: 79.5 },
        { id: 'l2-r-88', type: 'source', edge: 'right', pct: 88.14 },
        { id: 'l2-r-91', type: 'source', edge: 'right', pct: 91.5 },
        { id: 'l2-r-92', type: 'source', edge: 'right', pct: 92.5 },
        { id: 'l2-r-95', type: 'source', edge: 'right', pct: 85.65 },
        { id: 'l2-r-96', type: 'source', edge: 'right', pct: 96.15 },
        { id: 'aiv2b-dcache-r-20', type: 'target', edge: 'right', pct: 77.5 },
        { id: 'gm-to-ub-out', type: 'source', edge: 'right', pct: 75 },
      ],
    },
  },

  // AIC

  {
    id: 'aic',
    type: 'vectorNode',
    data: {
      label: 'AIC',
      labelX: 15,
      labelY: 10,
      bgColor: 'rgba(0, 0, 0, 1)',
      borderColor: 'rgba(0, 0, 0, 1)',
      glowColor: 'rgba(0, 0, 0, 1)',
      width: 1570,
      height: 635,
      fontSize: 16,
    },
    position: {
      x: -30,
      y: 0,
    },
  },
  {
    id: 'aic-l1',
    type: 'gridNode',
    position: { x: X_COL1, y: Y_AIC_L1 },
    parentNode: 'aic',
    memId: 'MEM_L1',
    data: {
      label: 'L1',
      detail: {
        name: 'a_10',
        shape: `[16, 1024]`,
        type: 'BF16',
        subType: 'Tensor',
        size: '32',
        sizeType: 'KB',
        addr: '0x000000',
        access: 'prefetch',
      },
      cols: 16,
      rows: 32,
      filledCount: 240,
      speed: 150,
      showHeader: true,
      showStats: true,
      emptyColor: '#626263',
      filledColor: '#5ea3ef',
      bgColor: 'rgb(60,129,209)',
      // animateUntil: 100,
      tiers: [
        { until: 60, color: '#dbe9f7' },
        { until: 120, color: '#1f4d85' },
        { until: 240, color: '#4a90e2' },
      ],
      handles: [
        { id: 'aic-l1-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-l1-r-3', type: 'source', edge: 'right', pct: 3.5 },
        { id: 'aic-l1-r-12', type: 'source', edge: 'right', pct: 15 },
        { id: 'aic-l1-r-25', type: 'source', edge: 'right', pct: 25 },
        { id: 'aic-l1-r-39', type: 'source', edge: 'right', pct: 37 },
        { id: 'aic-l1-r', type: 'source', edge: 'right', pct: 50 },
        { id: 'aic-l1-r-60', type: 'source', edge: 'right', pct: 60 },
        { id: 'aic-l1-r-70', type: 'source', edge: 'right', pct: 70 },
        { id: 'aic-l1-r-75', type: 'source', edge: 'right', pct: 75 },
        { id: 'aic-l1-r-80', type: 'source', edge: 'right', pct: 80 },
        { id: 'aic-l1-r-92', type: 'source', edge: 'right', pct: 92 },
        { id: 'aic-l1-b', type: 'source', edge: 'bottom', pct: 50 },
        { id: 'aic-l1-b-95', type: 'source', edge: 'bottom', pct: 95 },
        { id: 'aic-l1-t-95', type: 'source', edge: 'top', pct: 95 },
      ],
    },
  },
  {
    id: 'aic-l0a',
    type: 'gridNode',
    position: { x: X_COL2, y: Y_AIC_L0A },
    parentNode: 'aic',
    memId: 'MEM_L0A',
    data: {
      label: 'L0A',
      detail: {
        name: 'a_10',
        shape: `[16, 1024]`,
        type: 'BF16',
        subType: 'Tensor',
        size: '32',
        sizeType: 'KB',
        addr: '0x000000',
        access: 'write',
      },
      cols: 16,
      rows: 4,
      filledCount: 8,
      speed: 100,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#5ea3ef',
      showStats: true,
      bgColor: 'rgb(60,129,209)',
      handles: [
        { id: 'aic-l0a-l-15', type: 'target', edge: 'left', pct: 15 },
        { id: 'aic-l0a-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-l0a-l-75', type: 'target', edge: 'left', pct: 75 },
        { id: 'aic-l0a-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-l0b',
    type: 'gridNode',
    position: { x: X_COL2, y: Y_AIC_L0B },
    parentNode: 'aic',
    memId: 'MEM_L0B',
    data: {
      label: 'L0B',
      detail: {
        name: 'a_10',
        shape: `[16, 1024]`,
        type: 'BF16',
        subType: 'Tensor',
        size: '32',
        sizeType: 'KB',
        addr: '0x000000',
        access: 'atomic',
      },
      cols: 16,
      rows: 4,
      filledCount: 3,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#5ea3ef',
      showStats: true,
      bgColor: 'rgb(60,129,209)',
      handles: [
        { id: 'aic-l0b-l-30', type: 'target', edge: 'left', pct: 30 },
        { id: 'aic-l0b-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-l0b-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-bt',
    type: 'gridNode',
    position: { x: X_COL2, y: Y_AIC_BT },
    parentNode: 'aic',
    memId: 'MEM_BT',
    data: {
      label: 'BT',
      detail: {
        name: 'a_10',
        shape: `[16, 1024]`,
        type: 'BF16',
        subType: 'Tensor',
        size: '32',
        sizeType: 'KB',
        addr: '0x000000',
        access: 'read_write',
      },
      cols: 12,
      rows: 4,
      filledCount: 2,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#5ea3ef',
      showStats: true,
      bgColor: 'rgb(60,129,209)',
      gridSectionStyle: {
        marginRight: '3rem',
      },
      handles: [
        { id: 'aic-bt-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-bt-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-fp',
    type: 'gridNode',
    position: { x: X_COL2, y: Y_AIC_FP },
    parentNode: 'aic',
    memId: 'MEM_FP',
    data: {
      label: 'FP',
      detail: {
        name: 'a_10',
        shape: `[16, 1024]`,
        type: 'BF16',
        subType: 'Tensor',
        size: '32',
        sizeType: 'KB',
        addr: '0x000000',
        access: 'prefetch',
      },
      cols: 12,
      rows: 2,
      filledCount: 1,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#5ea3ef',
      showStats: true,
      bgColor: 'rgb(60,129,209)',
      gridSectionStyle: {
        marginRight: '3rem',
      },
      handles: [
        { id: 'aic-fp-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-fp-b', type: 'target', edge: 'bottom', pct: 50 },
        { id: 'aic-fp-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-cube',
    type: 'vectorNode',
    position: { x: X_COL3, y: Y_AIC_CUBE },
    parentNode: 'aic',
    data: {
      label: 'CUBE',
      width: 170,
      height: 300,
      fontSize: 22,
      handles: [
        { id: 'aic-cube-l-12', type: 'target', edge: 'left', pct: 9.4 },
        { id: 'aic-cube-l-10', type: 'target', edge: 'left', pct: 10 },
        { id: 'aic-cube-l-38', type: 'target', edge: 'left', pct: 39.6 },
        { id: 'aic-cube-l-45', type: 'target', edge: 'left', pct: 45 },
        { id: 'aic-cube-l-65', type: 'target', edge: 'left', pct: 65 },
        { id: 'aic-cube-l-80', type: 'target', edge: 'left', pct: 80 },
        { id: 'aic-cube-l-92', type: 'target', edge: 'left', pct: 92 },
        { id: 'aic-cube-r-15', type: 'source', edge: 'right', pct: 15 },
        { id: 'aic-cube-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-hidden-node-fixpipe',
    type: 'vectorNode',
    position: { x: FIX_PIP_HIDDEN_X, y: FIX_PIP_HIDDEN_Y },
    parentNode: 'aic',
    data: {
      label: '',
      width: 60,
      height: 13.5,
      fontSize: 22,
      handles: [
        { id: 'aic-hidden-node-fixpipe-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-hidden-node-fixpipe-l-72', type: 'target', edge: 'left', pct: 72 },
        { id: 'aic-hidden-node-fixpipe-t', type: 'target', edge: 'top', pct: 50 },
      ],
      containerStyle: {
        visibility: 'hidden',
      },
    },
  },
  {
    id: 'aic-l0c',
    type: 'gridNode',
    position: { x: X_COL4, y: Y_AIC_L0C },
    parentNode: 'aic',
    memId: 'MEM_L0C',
    data: {
      label: 'L0C',
      cols: 16,
      rows: 16,
      filledCount: 0,
      speed: 30,
      showHeader: true,
      showStats: true,
      emptyColor: '#626263',
      filledColor: '#5ea3ef',
      bgColor: 'rgb(60,129,209)',
      handles: [
        { id: 'aic-l0c-l-20', type: 'target', edge: 'left', pct: 20.5 },
        { id: 'aic-l0c-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-l0c-b', type: 'source', edge: 'bottom', pct: 50 },
        { id: 'aic-l0c-b-80', type: 'source', edge: 'bottom', pct: 80 },
        { id: 'aic-l0c-t', type: 'source', edge: 'top', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-dcache',
    type: 'gridNode',
    position: { x: X_COL1, y: Y_AIC_DCACHE },
    parentNode: 'aic',
    data: {
      label: 'DCache',
      cols: 12,
      rows: 2,
      filledCount: 20,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#9ca3af',
      bgColor: 'transparent',
      handles: [
        { id: 'aic-dcache-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-dcache-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-icache',
    type: 'gridNode',
    position: { x: X_COL1, y: Y_AIC_DCACHE + 62 },
    parentNode: 'aic',
    data: {
      label: 'ICache',
      cols: 12,
      rows: 2,
      filledCount: 20,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#9ca3af',
      bgColor: 'transparent',
      handles: [
        { id: 'aic-icache-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-icache-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aic-scalar',
    type: 'gridNode',
    position: { x: X_COL2, y: Y_AIC_SCALAR },
    parentNode: 'aic',
    data: {
      label: 'Scalar',
      cols: 16,
      rows: 8,
      filledCount: 24,
      speed: 30,
      showHeader: false,
      centerPill: true,
      centerIcon: '⮚',
      emptyColor: 'rgba(53, 159, 0, 1)',
      filledColor: 'rgba(53, 159, 0, 1)',
      bgColor: 'rgba(53, 159, 0, 1)',
      badgeStyle: {
        backgroundColor: 'transparent',
      },
      handles: [
        { id: 'aic-scalar-l-20', type: 'target', edge: 'left', pct: 22.7 },
        { id: 'aic-scalar-l-80', type: 'target', edge: 'left', pct: 79 },
        { id: 'aic-scalar-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aic-scalar-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },

  // ── AIV2 BOTTOM ──────────────────────────────────────────
  {
    id: 'aiv2b',
    type: 'vectorNode',
    data: {
      label: 'AIV x2',
      labelX: 15,
      labelY: 10,
      bgColor: 'rgba(0, 0, 0, 1)',
      borderColor: 'rgba(0, 0, 0, 1)',
      glowColor: 'rgba(0, 0, 0, 1)',
      width: 1570,
      height: 300,
      fontSize: 16,
    },
    position: {
      x: -30,
      y: 655,
    },
  },
  {
    id: 'aiv2b-dcache',
    type: 'gridNode',
    position: { x: X_COL1, y: Y_B_DCACHE + 24 },
    parentNode: 'aiv2b',
    data: {
      label: 'DCache',
      cols: 12,
      rows: 2,
      filledCount: 20,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#9ca3af',
      bgColor: 'transparent',
      handles: [
        { id: 'aiv2b-dcache-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aiv2b-dcache-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aiv2b-icache',
    type: 'gridNode',
    position: { x: X_COL1, y: Y_B_NDNA + 101 },
    parentNode: 'aiv2b',
    data: {
      label: 'ICache',
      cols: 12,
      rows: 2,
      filledCount: 20,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#9ca3af',
      bgColor: 'transparent',
      handles: [
        { id: 'aiv2b-icache-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aiv2b-icache-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aiv2b-scalar',
    type: 'gridNode',
    position: { x: X_COL2 + 84, y: Y_B_SCALAR + 30 },
    parentNode: 'aiv2b',
    data: {
      label: 'Scalar',
      cols: 18,
      rows: 8,
      filledCount: 24,
      speed: 30,
      showHeader: false,
      centerPill: true,
      centerIcon: '⮚',
      emptyColor: 'rgba(53, 159, 0, 1)',
      filledColor: 'rgba(53, 159, 0, 1)',
      bgColor: 'rgba(53, 159, 0, 1)',
      badgeStyle: {
        backgroundColor: 'transparent',
      },
      handles: [
        { id: 'aiv2b-scalar-l-15', type: 'target', edge: 'left', pct: 15 },
        { id: 'aiv2b-scalar-l', type: 'target', edge: 'left', pct: 50 },
        { id: 'aiv2b-scalar-l-85', type: 'target', edge: 'left', pct: 85 },
        { id: 'aiv2b-scalar-r', type: 'source', edge: 'right', pct: 50 },
        { id: 'aiv2b-scalar-t', type: 'source', edge: 'top', pct: 50 },
      ],
    },
  },
  {
    id: 'aiv2b-ub',
    type: 'gridNode',
    position: { x: X_COL2, y: Y_B_UB },
    parentNode: 'aiv2b',
    memId: 'MEM_UB',
    data: {
      label: 'UB',
      cols: 32,
      rows: 8,
      filledCount: 0,
      speed: 30,
      showHeader: true,
      emptyColor: '#626263',
      filledColor: '#5ea3ef',
      showStats: true,
      bgColor: 'rgb(60,129,209)',
      handles: [
        { id: 'aiv2b-ub-l-in', type: 'target', edge: 'left', pct: 40 }, 
        { id: 'aiv2b-ub-l-70', type: 'source', edge: 'left', pct: 70 },
        { id: 'aiv2b-ub-r', type: 'source', edge: 'right', pct: 50 },
      ],
    },
  },
  {
    id: 'aiv2b-vector',
    type: 'vectorNode',
    position: { x: X_COL4 - 50, y: Y_B_VECTOR - 96.55 },
    parentNode: 'aiv2b',
    data: {
      label: 'Vector',
      width: 276,
      height: 140,
      handles: [
        { id: 'aiv2b-vector-r', type: 'source', edge: 'right', pct: 50 },
        { id: 'aiv2b-vector-l', type: 'source', edge: 'left', pct: 50 },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════
  // EDGES
  // ══════════════════════════════════════════════════════════

  // ── L2 → COL1 ────────────────────────────────────────────

  {
    id: 'e-l2-to-aiv2b-ub',
    source: 'gm',
    target: 'aiv2b-ub',
    sourceHandle: 'gm-to-ub-out', 
    targetHandle: 'aiv2b-ub-l-in', 
    type: 'labeled',
    data: { label: 'MTE_2', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: '#b8860b', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_UB',
  },
  {
    id: 'e-l2-aic-l0a',
    source: 'gm',
    target: 'aic-l0a',
    sourceHandle: 'l2-r-4',
    targetHandle: 'aic-l0a-l-15',
    type: 'labeled',
    data: { label: 'MTE_2', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: '#b8860b', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_L0A',
  },
  {
    id: 'e-l2-aiv2b-ub',
    source: 'aiv2b-ub',
    target: 'gm',
    sourceHandle: 'aiv2b-ub-l-70',
    targetHandle: 'aiv2b-dcache-r-20',
    type: 'labeled',
    data: { label: 'MTE_3', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: '#b8860b', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_UB-MEM_DCACHE',
  },
  {
    id: 'e-l2-aiv2b-dcache',
    source: 'gm',
    target: 'aiv2b-dcache',
    sourceHandle: 'l2-r-88',
    targetHandle: 'aiv2b-dcache-l',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_DCACHE',
  },
  {
    id: 'e-l2-aiv2b-icache',
    source: 'gm',
    target: 'aiv2b-icache',
    sourceHandle: 'l2-r-96',
    targetHandle: 'aiv2b-icache-l',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false, dashed: true, animate: true },
    style: { stroke: '#f07c1d', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_ICACHE',
  },

  // ── AIV2T internal ───────────────────────────────────────

  {
    id: 'e-l2-aic-l1',
    source: 'gm',
    target: 'aic-l1',
    sourceHandle: 'l2-r-31',
    targetHandle: 'aic-l1-l',
    type: 'labeled',
    data: { label: 'MTE_2', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: '#b8860b', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_L1',
  },
  {
    id: 'e-l2-aic-l0b',
    source: 'gm',
    target: 'aic-l0b',
    sourceHandle: 'l2-r-7',
    targetHandle: 'aic-l0b-l-30',
    type: 'labeled',
    data: {
      label: 'MTE_2',
      labelBgColor: '#b8860b',
      labelTextColor: '#ffffff',
      showCircle: false,
      borderRadius: 5,
      labelX: 50,
      labelY: 60,
      waypoints: [
        { x: 452, y: 60 },
        { x: 452, y: 155 },
      ],
    },
    style: { stroke: '#b8860b', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_L0B',
  },
  {
    id: 'e-l2-aic-dcache',
    source: 'gm',
    target: 'aic-dcache',
    sourceHandle: 'l2-r-62',
    targetHandle: 'aic-dcache-l',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_DCACHE',
  },
  {
    id: 'e-l2-aic-icache',
    source: 'gm',
    target: 'aic-icache',
    sourceHandle: 'l2-r-68',
    targetHandle: 'aic-icache-l',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false, dashed: true, animate: true },
    style: { stroke: '#f07c1d', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L2-MEM_ICACHE',
  },
  {
    id: 'e-aic-dcache-aic-scalar',
    source: 'aic-dcache',
    target: 'aic-scalar',
    sourceHandle: 'aic-dcache-r',
    targetHandle: 'aic-scalar-l-20',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_DCACHE-MEM_SCALAR',
  },
  {
    id: 'e-aic-icache-aic-scalar',
    source: 'aic-icache',
    target: 'aic-scalar',
    sourceHandle: 'aic-icache-r',
    targetHandle: 'aic-scalar-l-80',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false, dashed: true, animate: true },
    style: { stroke: '#f07c1d', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_ICACHE-MEM_SCALAR',
  },
  {
    id: 'e-aic-l1-aic-l0a',
    source: 'aic-l1',
    target: 'aic-l0a',
    sourceHandle: 'aic-l1-r-3',
    targetHandle: 'aic-l0a-l-75',
    type: 'labeled',
    data: {
      label: 'MTE_1',
      labelBgColor: '#cc8b00',
      labelTextColor: '#ffffff',
      showCircle: false,
      borderRadius: 5,
      waypoints: [
        { x: 447, y: 84 },
        { x: 449, y: 83 },
        { x: 452, y: 80 },
        { x: 455, y: 83 },
        { x: 457, y: 84 },
      ],
    },
    style: { stroke: '#cc8b00', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L1-MEM_L0A',
  },
  {
    id: 'e-aic-l1-aic-l0b',
    source: 'aic-l1',
    target: 'aic-l0b',
    sourceHandle: 'aic-l1-r-25',
    targetHandle: 'aic-l0b-l',
    type: 'labeled',
    data: { label: 'MTE_1', labelBgColor: '#cc8b00', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: '#cc8b00', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L1-MEM_L0B',
  },
  {
    id: 'e-aic-l1-aic-bt',
    source: 'aic-l1',
    target: 'aic-bt',
    sourceHandle: 'aic-l1-r',
    targetHandle: 'aic-bt-l',
    type: 'labeled',
    data: { label: 'MTE_1', labelBgColor: '#cc8b00', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: '#cc8b00', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L1-MEM_BT',
  },
  {
    id: 'e-aic-l1-aic-fp',
    source: 'aic-l1',
    target: 'aic-fp',
    sourceHandle: 'aic-l1-r-75',
    targetHandle: 'aic-fp-l',
    type: 'labeled',
    data: { label: 'FixPipe', labelBgColor: '#cc8b00', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: '#cc8b00', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L1-MEM_FP',
  },
  {
    id: 'e-aic-l0a-aic-cube',
    source: 'aic-l0a',
    target: 'aic-cube',
    sourceHandle: 'aic-l0a-r',
    targetHandle: 'aic-cube-l-12',
    type: 'labeled',
    data: {},
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_L0A-MEM_CUBE',
  },
  {
    id: 'e-aic-l0b-aic-cube',
    source: 'aic-l0b',
    target: 'aic-cube',
    sourceHandle: 'aic-l0b-r',
    targetHandle: 'aic-cube-l-45',
    type: 'labeled',
    data: {},
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    path: 'E-MEM_L0B-MEM_CUBE',
  },
  {
    id: 'e-aic-bt-aic-cube',
    source: 'aic-bt',
    target: 'aic-cube',
    sourceHandle: 'aic-bt-r',
    targetHandle: 'aic-cube-l-80',
    type: 'labeled',
    data: {},
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    path: 'E-MEM_BT-MEM_CUBE',
  },
  {
    id: 'e-aic-fp-aic-fixpipe',
    source: 'aic-fp',
    target: 'aic-hidden-node-fixpipe',
    sourceHandle: 'aic-fp-b',
    targetHandle: 'aic-hidden-node-fixpipe-t',
    type: 'labeled',
    data: {},
    style: { stroke: '#cc8b00', strokeWidth: 2 },
    path: 'E-MEM_FP-MEM_FIXPIPE',
  },
  {
    id: 'e-aic-l0c-aic-l1',
    target: 'aic-l1',
    source: 'aic-l0c',
    targetHandle: 'aic-l1-b',
    sourceHandle: 'aic-l0c-b',
    type: 'labeled',
    data: {
      label: 'FixPipe',
      labelBgColor: '#cc8b00',
      labelTextColor: '#ffffff',
      showCircle: false,
      labelX: 573,
      labelY: 499,
      borderRadius: 10,
    },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    path: 'E-MEM_L0C-MEM_L1',
  },
  {
    id: 'e-aic-l0c-aic-l2',
    target: 'gm',
    source: 'aic-hidden-node-fixpipe',
    targetHandle: 'l2-r-57',
    sourceHandle: 'aic-hidden-node-fixpipe-l-72',
    type: 'labeled',
    data: {
      labelBgColor: '#cc8b00',
      labelTextColor: '#ffffff',
    },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    path: 'E-MEM_L0C-MEM_L2',
  },
  {
    id: 'e-aic-cube-aic-l0c',
    source: 'aic-cube',
    target: 'aic-l0c',
    sourceHandle: 'aic-cube-r',
    targetHandle: 'aic-l0c-l',
    type: 'labeled',
    data: { label: '', labelBgColor: '#f97316', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_CUBE-MEM_L0C',
  },

  // ── AIV2B internal ───────────────────────────────────────
  {
    id: 'e-aiv2b-icache-aiv2b-scalar',
    source: 'aiv2b-icache',
    target: 'aiv2b-scalar',
    sourceHandle: 'aiv2b-icache-r',
    targetHandle: 'aiv2b-scalar-l-85',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false, dashed: true },
    style: { stroke: '#f07c1d', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_ICACHE-MEM_SCALAR',
  },
  {
    id: 'e-aiv2b-dcache-aiv2b-scalar',
    source: 'aiv2b-dcache',
    target: 'aiv2b-scalar',
    sourceHandle: 'aiv2b-dcache-r',
    targetHandle: 'aiv2b-scalar-l-15',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_DCACHE-MEM_SCALAR',
  },
  {
    id: 'e-aiv2b-ub-aiv2b-scalar',
    source: 'aiv2b-ub',
    target: 'aiv2b-scalar',
    sourceHandle: 'aiv2b-ub-b',
    targetHandle: 'aiv2b-scalar-t',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false, doubleArrow: true },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_UB-MEM_SCALAR',
  },
  {
    id: 'e-aiv2b-ub-aiv2b-vector',
    source: 'aiv2b-ub',
    target: 'aiv2b-vector',
    sourceHandle: 'aiv2b-ub-r',
    targetHandle: 'aiv2b-vector-l',
    type: 'labeled',
    data: { label: '', labelBgColor: '#b8860b', labelTextColor: '#ffffff', showCircle: false, doubleArrow: true },
    style: { stroke: 'rgb(137, 154, 174)', strokeWidth: 2 },
    markerEnd: 'arrowclosed',
    path: 'E-MEM_UB-MEM_VECTOR',
  },
]);

const flattenMemoryData = (mockData) => {
  const flat = {};
  const convertList = {
    'nd-dma cache': 'ndma',
    'nd-dna cache': 'ndna',
  };
  const traverse = (obj, parentName = '') => {
    Object.entries(obj).forEach(([key, value]) => {
      let currentName = key.toLowerCase();
      if (key === 'AIV1') currentName = 'aiv2t';
      if (key === 'AIV2') currentName = 'aiv2b';
      if (convertList[currentName]) currentName = convertList[currentName];

      const fullId = parentName && parentName !== 'graphdata' ? `${parentName}-${currentName}` : currentName;

      if (value && typeof value === 'object' && (value.bufferList || value.size !== undefined)) {
        flat[fullId] = value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        traverse(value, currentName);
      }
    });
  };

  traverse(mockData);
  return flat;
};

const getTargetPathss = (obj, parentKey = "") => {
  let paths = [];
  const parentMap = {
    AIV1: 'aiv2t',
    AIC: 'aic',
    AIV2: 'aiv2b',
  };
  for (const key in obj) {
    const value = obj[key];

    if (typeof value === 'object' && value !== null) {
      const firstSubValue = Object.values(value)[0];

      if (typeof firstSubValue !== 'object') {
        const pathString = parentKey ? `${parentMap[parentKey]}-${key.toLowerCase()}` : key;
        paths.push(pathString);
      } else {
        paths = paths.concat(getTargetPathss(value, key));
      }
    }
  }
  return paths;
};

const getMemIdValue = (memIds, path) => {
  const pathLower = path.toLowerCase();
  
  const sumValues = (obj) => {
    let sum = 0;
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'number') {
        sum += val;
      } else if (typeof val === 'object' && val !== null) {
        sum += sumValues(val);
      }
    }
    return sum;
  };
  
  const findPath = (obj) => {
    for (const key in obj) {
      if (key.toLowerCase() === pathLower) {
        const matched = obj[key];
        if (typeof matched === 'number') {
          return matched;
        } else if (typeof matched === 'object' && matched !== null) {
          return sumValues(matched);
        }
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const result = findPath(obj[key]);
        if (result !== undefined) {
          return result;
        }
      }
    }
    return undefined;
  };
  
  const result = findPath(memIds);
  return result !== undefined ? result : 0;
};


const getTierColor = (status: number, index: number): string => {
  const colorPairs = [
    { light: '#98C6F3', dark: '#2E619C' },
    { light: '#6DD0B6', dark: '#13746F' },
    { light: '#F5D5A0', dark: '#9B6E2D' },
    { light: '#D4A5E8', dark: '#6B3FA0' },
    { light: '#B3E5FC', dark: '#0288D1' },
    { light: '#C8E6C9', dark: '#2E7D32' },
    { light: '#DCEDC8', dark: '#388E3C' },
    { light: '#FFE0B2', dark: '#F57C00' },
    { light: '#E1BEE7', dark: '#7B1FA2' },
    { light: '#CE93D8', dark: '#6A1B9A' },
    { light: '#B39DDB', dark: '#5E35B1' },
    { light: '#9FA8DA', dark: '#4527A0' },
    { light: '#90CAF9', dark: '#1565C0' },
    { light: '#81D4FA', dark: '#0288D1' },
    { light: '#80DEEA', dark: '#00838F' },
    { light: '#80CBC4', dark: '#00695C' },
    { light: '#A5D6A7', dark: '#2E7D32' },
    { light: '#C5E1A5', dark: '#388E3C' },
    { light: '#E6EE9C', dark: '#827717' },
    { light: '#FFF59D', dark: '#F9A825' },
    { light: '#FFE082', dark: '#F57F17' },
    { light: '#FFCC80', dark: '#EF6C00' },
    { light: '#E8F5E9', dark: '#2E7D32' },
    { light: '#E3F2FD', dark: '#1565C0' },
    { light: '#F3E5F5', dark: '#7B1FA2' },
    { light: '#FFF3E0', dark: '#E65100' },
    { light: '#E0F7FA', dark: '#006064' },
    { light: '#FCE4EC', dark: '#880E4F' },
    { light: '#E8EAF6', dark: '#3F51B5' },
    { light: '#F1F8E9', dark: '#33691E' },
  ];
  const pairIndex = index % colorPairs.length;
  const pair = colorPairs[pairIndex];
  return status === 2 ? pair.light : pair.dark;
};

const getUpdateBuffer = (memIds, nodeId, currentName) => {
  const targetName = nodeId.toUpperCase() || currentName?.toUpperCase() || 'L2';
  let memData;
  if (targetName === 'GM') {
    memData = memIds['L2'];
  } else {
    const nameArr = targetName.split('-');
    memData = memIds[nameArr[0]] ? memIds[nameArr[0]][nameArr[1]] : null;
  } 
  return memData?.bufferList || [];
}



const transformAndMapData = (flattenedData, existingNodes, animation) => {

  const myEdges = [];
  const animationMap = new Map();
  const errorMemoType = [];
  let startT = 0;
  let endT = 0;
  let speed = 0;
  let changeBufferList = [];

  if (animation.value) {
    const { eventType, animationData, action } = animation.value;
    const startTime = animation.value.clock || 0;
    const endTime = animation.value.cycleEnd || startTime + 100;
    const { originBufferList, targetBufferList, errorMemType = [] } = action;
    changeBufferList = targetBufferList;
    const inputMenIds = animation.value?.inputMemIds || [];
    const outputMenIds = animation.value?.outputMemIds || [];
    startT = Number(startTime);
    endT = Number(endTime);
    errorMemoType.push(...errorMemType);
    if (eventType !== 'BUFFER_REARRANGE') {

      // 处理边数据
      inputMenIds.forEach(input => {
        outputMenIds.forEach(output => {
          const inputMem = originBufferList.find(buffer => buffer?.memId === input);
          const outputMem = originBufferList.find(buffer => buffer?.memId === output);
          if (inputMem && outputMem) {
            const inputName = inputMem.memType === 'MEM_GM' ? 'MEM_L2' : inputMem.memType;
            const outputName = outputMem.memType === 'MEM_GM' ? 'MEM_L2' : outputMem.memType;
            myEdges.push(`E-${inputName}-${outputName}`);
          }
        })
      })

      // 处理内存块数据
      targetBufferList.forEach(buffer => {
        if (animationMap.has(buffer.memType)) {
          let bufferData = animationMap.get(buffer.memType);
          const targetIndex = bufferData.findIndex((item) => item?.memId === buffer?.memId);
          if (targetIndex === -1) {
            bufferData.push(buffer);  
          } else {
            if (buffer.status === 0) {
              bufferData = bufferData.filter(b => b.status !== 0);
            } else {
              bufferData[targetIndex] = buffer;
            }
          }
          animationMap.set(buffer.memType, bufferData);
        } else {
          let bufferData = [...(flattenedData[buffer.memType]?.bufferList || [])];
          const targetIndex = bufferData.findIndex((item) => item?.memId === buffer?.memId);
          if (targetIndex === -1) {
            bufferData.push(buffer);
          } else {
            if (buffer.status === 0) {
              bufferData = bufferData.filter(b => b.status !== 0);
            } else {
              bufferData[targetIndex] = buffer;
            }
          }
          animationMap.set(buffer.memType, bufferData);
        }
      })

    }

  }



  return existingNodes.map((node) => {
    Object.keys(flattenedData).forEach((key) => {
      if (key === node.memId) {
        if (key === 'MEM_GM') {
          const gmFilled = props.GMData?.bufferList?.reduce((acc, b) => acc + b.size, 0) || 0;
          const l2Filled = flattenedData.MEM_L2?.bufferList?.reduce((acc, b) => acc + b.size, 0) || 0;
          const error = errorMemoType.includes('MEM_L2');
          const animate = animationMap.has('MEM_L2');
          node = {
            ...node,
            data: {
              ...node.data,
              filledCount: Math.ceil(gmFilled / 1024 / HEXAGON_SIZE),
              bufferList: props.GMData?.bufferList || [],
              tiers: props.GMData.bufferList?.map((b, index) => {
                  const color = getTierColor(b.status, index);
                  return {
                    startLocation: (b.addrStart / 1024) / HEXAGON_SIZE,
                    size: (b.size / 1024) / HEXAGON_SIZE,
                    color: color,
                  }
                }) || [],
              splitData: {
                ...node.data.splitData,
                filledCount: Math.ceil(l2Filled / 1024 / CIRCULAR_SIEE),
                bufferList: flattenedData.MEM_L2?.bufferList || [],
                animate,
                speed: getSpeed(endT - startT, 'MEM_L2', changeBufferList, CIRCULAR_SIEE),
                tiers: flattenedData.MEM_L2?.bufferList?.map((b, index) => {
                  const color = getTierColor(b.status, index);
                  return {
                    startLocation: (b.addrStart / 1024) / CIRCULAR_SIEE,
                    size: (b.size / 1024) / CIRCULAR_SIEE,
                    color: color,
                  }
                }) || [],
                animationData: animate ? {
                  stepCount: 1,
                  originTiers: getTiers(flattenedData['MEM_L2']?.bufferList || [], CIRCULAR_SIEE),
                  targetTiers: getTiers(animationMap.get('MEM_L2') || [], CIRCULAR_SIEE),
                  error,
                } : {}
              },
            },
          }
        } else {
          const memoryTypeData = flattenedData[key];
          const filled = memoryTypeData.bufferList?.reduce((acc, b) => acc + b.size, 0) || 0;
          const error = errorMemoType.includes(key);
          const animate = animationMap.has(key);
          node = {
            ...node,
            data: {
              ...node.data,
              animate,
              speed: getSpeed(endT - startT, key, changeBufferList, QUADRATE_SIZE),
              filledCount: Math.ceil(filled / 1024 / QUADRATE_SIZE),
              bufferList: memoryTypeData.bufferList || [],
              tiers: memoryTypeData?.bufferList?.map((b, index) => {
                const color = getTierColor(b.status, index);
                return {
                  startLocation: (b.addrStart / 1024) / QUADRATE_SIZE,
                  size: (b.size / 1024) / QUADRATE_SIZE,
                  color: color,
                }
              }) || [],
              animationData: animate ? {
                stepCount: 1,
                originTiers: getTiers(flattenedData[key]?.bufferList || [], QUADRATE_SIZE),
                targetTiers: getTiers(animationMap.get(key) || [], QUADRATE_SIZE),
                error,
              } : {}
            }
          }
        }
      }
    })
    if (myEdges.includes(node.path)) {
      node = {
        ...node,
        data: { ...node.data, flowStage: 1, startTime: 0, endTime: (Number(endT) / props.animationSpeed - Number(startT) / props.animationSpeed) * 10 }
      };
    }
    return node;
  });
}; 

const getSpeed = (time, key, bufferList, size) => {
  const changeBufferList = bufferList.filter(b => b.memType === key);
  const total = changeBufferList.reduce((acc, b) => acc + b.size, 0) || 0;
  return (time * 10 / props.animationSpeed) / (total / 1024 / size);
}

const getTiers = (bufferList, size) => {
  return bufferList?.map((b, index) => {
    const color = getTierColor(b.status, index);
    return {
      startLocation: (b.addrStart / 1024) / size,
      size: (b.size / 1024) / size,
      color: color,
    }
  }) || []
}



const updatedNodes = computed(() => {
  if (!props.graphData) return elements.value;

  if (props.onlyUpdateSpeed) {
    return;
  };
  // const flattened = flattenMemoryData(props.graphData);
  const _animation = props.animationData; 
  return transformAndMapData(props.graphData, elements.value, _animation);
});
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
}
.vue-flow__node {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  filter: drop-shadow(4px 6px 8px rgba(0, 0, 0, 0.6));
}
.vue-flow__handle {
  opacity: 0 !important;
}
.transition-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(26, 26, 46, 0.95);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.loading-spinner {
  width: 30px;
  height: 30px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4a9eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-text {
  margin-top: 16px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
