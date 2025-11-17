<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="modelValue" ref="drawerEl" :class="['health-report', graphName]">
        <div class="health-report-header">
          <span class="title">{{ t('healthReport') }}{{ graphName && ` - ${GraphMap[graphName]}` }}</span>
          <em class="icon icon-close" @click="() => emits('update:modelValue', false)"></em>
        </div>
        <div :class="['health-report-content', !graphName && 'no-report']">
          <TensorGraph v-if="graphName === 'TensorGraph'" />
          <TileGraph v-if="graphName === 'TileGraph'" />
          <KernelGraph v-if="graphName === 'KernelGraph'" />
          <ExecuteGraph v-if="graphName === 'ExecuteGraph'" />
          <div v-if="!graphName" class="no-data">{{ t('comGraph.noHealthReport') }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, ref, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import { HealthReportProvideKey } from './types';
import TensorGraph from './tensorGraph.vue';
import TileGraph from './tileGraph.vue';
import KernelGraph from './kernelGraph.vue';
import ExecuteGraph from './executeGraph.vue';
import { comGraphStore } from '../../../service/com-graph-store';
import { useClickOutside } from '../hooks/use-click-outside';
import { useViewServer } from '../../../core/use-view-server';
import type { IComViewServer } from '../../../../../../src/core/view/view-server-interface';

const { server } = useViewServer<IComViewServer>();
const { t } = useI18n();
const props = defineProps({
  modelValue: Boolean,
});
const emits = defineEmits(['update:modelValue', 'onLocate', 'open', 'locateSubgraph']);

const { drawerEl } = useClickOutside(props, emits);
const graphName = ref('');
const jsonData = ref();

const GraphMap = {
  TensorGraph: 'Tensor Graph',
  TileGraph: 'Tile Graph',
  ExecuteGraph: 'Execute Graph',
  KernelGraph: 'OoOSchedule',
};
let OpMap: Record<number, string> = {};
let TensorMap: Record<number, string> = {};
let OpSubgraphMap: Record<number, any> = {};
let TensorSubgraphMap: Record<number, any> = {};
watch(server.HealthyReport, (newValue) => {
  Object.keys(newValue.data).forEach((key) => {
    if (newValue.data[key]) {
      graphName.value = key;
      jsonData.value = newValue.data[key];
      emits('open', key);
    }
  });
});


const generateOpMap = (operations: Array<Record<string, any>>) => {
  if (!Array.isArray(operations)) {
    return;
  }
  OpMap = {};
  for (let i = 0; i < operations.length; i++) {
    const item = operations[i];
    const subgraphId = item.subgraphid !== undefined ? item.subgraphid : -1;
    if (!OpSubgraphMap[subgraphId]) {
      OpSubgraphMap[subgraphId] = {};
    }
    OpMap[item.opmagic] = `operation-magic-${item.opmagic}-${subgraphId}`;
    OpSubgraphMap[item.subgraphid][item.opmagic] = item;
  }
};
const generateTensorMap = (jsonData: Record<string, any>) => {
  TensorMap = {};
  if (Array.isArray(jsonData.tensors)) {
    for (let i = 0; i < jsonData.tensors.length; i++) {
      const item = jsonData.tensors[i];
      const subgraphId = item.subgraphid !== undefined ? item.subgraphid : -1;
      if (!TensorSubgraphMap[subgraphId]) {
        TensorSubgraphMap[subgraphId] = {};
      }
      TensorMap[item.magic] = `tensor-${item.magic}-${subgraphId}`;
      TensorSubgraphMap[item.subgraphid][item.magic] = item;
    }
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      server.getHealthyReport();
      const jsonData: any = comGraphStore.data.jsonData;
      generateOpMap(jsonData.operations);
      generateTensorMap(jsonData);
    }
  },
);

const getNodesBySubgraphId = (id: number) => {
  return [
    ...(TensorSubgraphMap[id] ? Object.values(TensorSubgraphMap[id]) : []),
    ...(OpSubgraphMap[id] ? Object.values(OpSubgraphMap[id]) : []),
  ];
};

const locateNode = (nodeId: number, type: 'op' | 'tensor' | 'subgraph') => {
  if (type === 'op') {
    if (OpMap[nodeId]) {
      emits('onLocate', OpMap[nodeId]);
    } else {
      (window as any).ascEventBus.emit('message_notice', t('comGraph.locateNodeError'));
    }
  }
  if (type === 'tensor') {
    if (TensorMap[nodeId]) {
      emits('onLocate', TensorMap[nodeId]);
    } else {
      (window as any).ascEventBus.emit('message_notice', t('comGraph.locateNodeError'));
    }
  }
  if (type === 'subgraph') {
    const nodes = getNodesBySubgraphId(nodeId) as Record<string, any>;
    if (nodes.length) {
      emits(
        'locateSubgraph',
        nodes.map((item) => item.node_id),
      );
    }
  }
};

provide(HealthReportProvideKey, { jsonData, locateNode });
</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.health-report {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1040;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 400px;
  border-radius: 16px;
  background-color: var(--devui-card-bg);
  box-shadow: -1px 0 0 0 var(--devui-split-line);
  box-sizing: border-box;

  &.KernelGraph {
    width: 488px;
  }

  .health-report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 24px;
    padding: 20px 20px 0;
    box-sizing: content-box;

    .title {
      font-size: 16px;
      font-weight: bold;
      color: var(--devui-title-text);
      line-height: 24px;
    }

    .icon-close {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      color: var(--devui-icon);
      border-radius: 8px;
      transition: background-color $devui-animation-duration-base $devui-animation-ease-in-out-smooth,
        color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
      cursor: pointer;

      &:hover {
        color: var(--devui-title-text);
        background-color: var(--devui-input-hover-bg);
      }
    }
  }

  .health-report-content {
    flex: 1;
    padding: 0 20px 20px;
    box-sizing: border-box;
    overflow: auto;

    &.no-report {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .no-data {
      font-size: 14px;
      color: var(--devui-primary-text);
    }
  }

  .devui-alert.devui-alert--danger.health-report-alert {
    padding: 4px;
    margin: 12px 0;
    line-height: 20px;
  }

  .statistic-info-box {
    display: flex;
    gap: 36px;
  }
}
</style>
