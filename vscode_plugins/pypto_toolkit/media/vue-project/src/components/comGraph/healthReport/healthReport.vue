<template>
  <div :class="['health-report-content', !graphName && 'no-report']">
    <TensorGraph v-if="graphName === 'TensorGraph'" />
    <TileGraph v-if="graphName === 'TileGraph'" />
    <BlockGraph v-if="graphName === 'BlockGraph'" />
    <ExecuteGraph v-if="graphName === 'ExecuteGraph'" />
    <div v-if="!graphName" class="no-data">{{ t('comGraph.noHealthReport') }}</div>
  </div>
</template>

<script setup lang="ts">
import { provide, inject, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { HealthReportProvideKey } from './types';
import TensorGraph from './tensorGraph.vue';
import TileGraph from './tileGraph.vue';
import BlockGraph from './blockGraph.vue';
import ExecuteGraph from './executeGraph.vue';
import { comGraphStore } from '../../../service/com-graph-store';
import { ComGraphReportProvideKey } from '../type';
import type { ComGraphReportContext } from '../type';

const { t } = useI18n();
const { graphName, jsonData, rootEmits } = inject(ComGraphReportProvideKey) as ComGraphReportContext;

let OpMap: Record<number, string> = {};
let TensorMap: Record<number, string> = {};
let OpSubgraphMap: Record<number, any> = {};
let TensorSubgraphMap: Record<number, any> = {};

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
    OpSubgraphMap[subgraphId][item.opmagic] = item;
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
      TensorSubgraphMap[subgraphId][item.magic] = item;
    }
  }
};

const getNodesBySubgraphId = (id: number) => {
  return [
    ...(TensorSubgraphMap[id] ? Object.values(TensorSubgraphMap[id]) : []),
    ...(OpSubgraphMap[id] ? Object.values(OpSubgraphMap[id]) : []),
  ];
};

const locateNode = (nodeId: number, type: 'op' | 'tensor' | 'subgraph') => {
  if (type === 'op') {
    if (OpMap[nodeId]) {
      rootEmits('onLocate', OpMap[nodeId]);
    } else {
      (window as any).ascEventBus.emit('message_notice', t('comGraph.locateNodeError'));
    }
  }
  if (type === 'tensor') {
    if (TensorMap[nodeId]) {
      rootEmits('onLocate', TensorMap[nodeId]);
    } else {
      (window as any).ascEventBus.emit('message_notice', t('comGraph.locateNodeError'));
    }
  }
  if (type === 'subgraph') {
    const nodes = getNodesBySubgraphId(nodeId) as Record<string, any>;
    if (nodes.length) {
      rootEmits(
        'locateSubgraph',
        nodes.map((item) => item.node_id),
      );
    }
  }
};

onMounted(() => {
  const jsonData: any = comGraphStore.data.jsonData;
  generateOpMap(jsonData.operations);
  generateTensorMap(jsonData);
});

provide(HealthReportProvideKey, { jsonData, locateNode });
</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.health-report-content {
  flex: 1;
  padding: 0 16px 16px;
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
</style>
