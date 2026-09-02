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
  <div class="l2-node" ref="gridRef">
    <Handle
      v-for="h in props.data.handles || []"
      :key="h.id"
      :id="h.id"
      :type="h.type || 'source'"
      :position="getHandlePosition(h.edge)"
      :style="getHandleStyle(h)"
    />

    <div v-for="i in COLS * ROWS" :key="i" class="grid-cell" />
    <div class="node-overlay">
      <span class="badge-label">L2</span>
      <div class="badge-cylinder">
        <span class="badge-value">32MB</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Handle, Position } from '@vue-flow/core';

interface HandleDef {
  id: string;
  type?: string;
  edge: 'top' | 'bottom' | 'left' | 'right';
  pct: number;
}

interface NodeData {
  startFill?: boolean;
  handles?: HandleDef[];
}

const props = defineProps<{ data: NodeData }>();

const COLS = 4;
const ROWS = 57;
const gridRef = ref<HTMLElement | null>(null);

function getHandlePosition(edge: string) {
  return { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right }[edge] || Position.Top;
}

function getHandleStyle(h: HandleDef) {
  if (h.edge === 'top' || h.edge === 'bottom') {
    return { position: 'absolute', left: `${h.pct}%`, [h.edge]: '0px', transform: 'translate(-50%, -50%)' };
  } else {
    return { position: 'absolute', top: `${h.pct}%`, [h.edge]: '0px', transform: 'translate(-50%, -50%)' };
  }
}

function fillCells(): void {
  if (!gridRef.value) return;
  const cells = Array.from(gridRef.value.querySelectorAll<HTMLElement>('.grid-cell'));
  let i = 0;
  const interval = setInterval(() => {
    if (i >= cells.length) return clearInterval(interval);
    cells[i++].style.background = 'green';
  }, 5);
}

watch(
  () => props.data.startFill,
  (val) => {
    if (val) fillCells();
  },
);
</script>

<style scoped>
.l2-node {
  position: relative;
  width: 41.24px;
  height: 1000.38px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.33);
  border-radius: 4px;
  background: rgba(137, 154, 174, 1);
  overflow: hidden;
  display: grid;
  grid-template-columns: repeat(4, 9.06px);
  grid-template-rows: repeat(57, 9.06px);
  gap: 1px;
  align-content: center;
}
.grid-cell {
  width: 9.06px;
  height: 9.06px;
  background: var(--ma-L2-cell);
  border-radius: 50%;
}
.node-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.badge-label {
  font-family: monospace;
  font-size: 18px;
  font-weight: 700;
  color: rgba(220, 220, 220, 1);
  letter-spacing: 0.06em;
  line-height: 1;
}
.badge-cylinder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 30, 30, 0.92);
  border-radius: 999px;
  padding: 2px 6px;
}
.badge-value {
  font-family: monospace;
  font-size: 9px;
  font-weight: 400;
  color: rgba(170, 170, 170, 1);
  letter-spacing: 0.06em;
  line-height: 1;
}
</style>