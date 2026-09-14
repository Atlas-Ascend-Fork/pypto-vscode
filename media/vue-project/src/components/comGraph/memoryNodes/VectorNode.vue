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
  <div class="vector-node" :style="containerStyle">
    <Handle
      v-for="h in data.handles || []"
      :key="h.id"
      :id="h.id"
      :type="h.type || 'target'"
      :position="getHandlePosition(h.edge)"
      :style="getHandleStyle(h)"
    />

    <span class="vector-label" :style="labelStyle">{{ data.label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';

interface HandleConfig {
  id: string;
  type?: 'source' | 'target';
  edge: 'top' | 'bottom' | 'left' | 'right';
  pct: number;
}

interface NodeData {
  label?: string;
  width?: number;
  height?: number;
  bgColor?: string;
  glowColor?: string;
  borderColor?: string;
  textColor?: string;
  fontSize?: number;
  labelX?: number | string;
  labelY?: number | string;
  handles?: HandleConfig[];
  containerStyle?: Object;
  labelStyle?: Object;
}

const props = defineProps<{ id: string; data: NodeData }>();

const containerStyle = computed(() => {
  const bg = props.data.bgColor || '#22c55e';
  const glow = props.data.glowColor || 'var(--ma-cube-border)';
  const border = props.data.borderColor || 'var(--ma-cube-bg)';
  const borderStyle = props.data.borderStyle || 'solid';
  return {
    width: `${props.data.width || 96}px`,
    height: `${props.data.height || 120}px`,
    background: bg,
    border: `2px ${borderStyle} ${border}`,
    boxShadow: `0 0 0 2px rgba(0, 0, 0, 0.0), 0 0 0 4px ${glow}`,
    ...props.data.containerStyle,
  };
});

const labelStyle = computed(() => {
  const styles: any = {
    color: props.data.textColor || '#ffffff',
    fontSize: `${props.data.fontSize || 26}px`,
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    ...props.data.labelStyle,
  };

  if (props.data.labelX !== undefined) {
    styles.left = typeof props.data.labelX === 'number' ? `${props.data.labelX}px` : props.data.labelX;
    styles.transform = styles.transform.replace('translate(', 'translate(0, ');
    if (props.data.labelY === undefined) styles.transform = 'translateY(-50%)';
  }

  if (props.data.labelY !== undefined) {
    styles.top = typeof props.data.labelY === 'number' ? `${props.data.labelY}px` : props.data.labelY;
    if (props.data.labelX !== undefined) {
      styles.transform = 'none';
    } else {
      styles.transform = 'translateX(-50%)';
    }
  }

  return styles;
});

function getHandlePosition(edge: HandleConfig['edge']): Position {
  return (
    {
      top: Position.Top,
      bottom: Position.Bottom,
      left: Position.Left,
      right: Position.Right,
    }[edge] || Position.Left
  );
}

function getHandleStyle(h: HandleConfig): Record<string, string | undefined> {
  if (h.edge === 'top' || h.edge === 'bottom') {
    return {
      position: 'absolute',
      left: `${h.pct}%`,
      top: h.edge === 'top' ? '0%' : undefined,
      bottom: h.edge === 'bottom' ? '0%' : undefined,
      transform: 'translate(-50%, -50%)',
    };
  }
  return {
    position: 'absolute',
    top: `${h.pct}%`,
    left: h.edge === 'left' ? '0%' : undefined,
    right: h.edge === 'right' ? '0%' : undefined,
    transform: 'translate(-50%, -50%)',
  };
}
</script>

<style scoped>
.vector-node {
  position: relative;
  box-sizing: border-box;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', sans-serif;
  user-select: none;
}

.vector-label {
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}
</style>