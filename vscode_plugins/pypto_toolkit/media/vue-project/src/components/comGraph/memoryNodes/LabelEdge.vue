<template>
  <g>
    <defs>
      <marker :id="markerId" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path :d="'M 0 0 L 10 5 L 0 10 z'" :fill="endMarkerColor" class="edge-arrow-head" />
      </marker>
      <marker :id="markerStartId" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" :fill="startMarkerColor" class="edge-arrow-head" />
      </marker>

      <linearGradient
        v-if="data.gradientStart && data.gradientEnd"
        :id="`grad-${id}`"
        spreadMethod="pad"
        gradientUnits="userSpaceOnUse"
        :x1="sourceX" :y1="sourceY" :x2="targetX" :y2="targetY"
        x="-100%" y="-100%" width="300%" height="300%"
      >
        <template v-if="data.animate && isWithinTimeRange">
          <stop offset="0%" :stop-color="data.gradientStart">
            <animate attributeName="offset" values="-0.3; 1" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="0%" :stop-color="data.gradientEnd" stop-opacity="1">
            <animate attributeName="offset" values="-0.15; 1.15" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="0%" :stop-color="data.gradientEnd" stop-opacity="1">
            <animate attributeName="offset" values="0; 1.3" dur="1.5s" repeatCount="indefinite" />
          </stop>
          <stop offset="0%" :stop-color="data.gradientStart">
            <animate attributeName="offset" values="0.3; 1.6" dur="1.5s" repeatCount="indefinite" />
          </stop>
        </template>
        <template v-else>
          <stop offset="0%" :stop-color="data.gradientStart" />
          <stop offset="100%" :stop-color="data.gradientEnd" />
        </template>
      </linearGradient>

      <linearGradient v-else :id="pulseGradientId" gradientUnits="userSpaceOnUse" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" :stop-color="glowColor" stop-opacity="0" />
        <stop offset="40%" :stop-color="glowColor" stop-opacity="0" />
        <stop offset="50%" :stop-color="glowColor" stop-opacity="1" />
        <stop offset="60%" :stop-color="glowColor" stop-opacity="0" />
        <stop offset="100%" :stop-color="glowColor" stop-opacity="0" />
      </linearGradient>
    </defs>

    <BaseEdge
      :id="id"
      :path="edgePath"
      :marker-end="`url(#${markerId})`"
      :marker-start="data.doubleArrow ? `url(#${markerStartId})` : undefined"
      :class="{ 'animated-dash': data.animate && data.dashed }"
      :style="edgeStyle"
    />
    
    <path :id="motionPathId" :d="edgePath" fill="none" stroke="none" />

    <circle
      v-if="isActive && isWithinTimeRange"
      :r="pulseRadius"
      class="edge-flow-dot"
      style="fill: #ffffff !important; stroke: none; filter: drop-shadow(0 0 4px #ffffff) drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))"
    >
      <animateMotion :dur="`${pulseDuration}s`" repeatCount="indefinite" rotate="auto">
        <mpath :href="`#${motionPathId}`" />
      </animateMotion>
    </circle>

    <foreignObject v-if="data.label" :x="labelBoxX" :y="labelBoxY" :width="labelBoxWidth" :height="labelBoxHeight" overflow="visible">
      <div xmlns="http://www.w3.org/1999/xhtml" class="label-shell nodrag nopan">
        <div
          class="custom-edge-label"
          :class="{ 'has-circle': data.showCircle, 'first-pass-done': firstPassDone || (isActive && isWithinTimeRange) }"
          :style="{
            backgroundColor: data.labelBgColor || '#b8860b',
            color: data.labelTextColor || 'white',
            border: data.labelBorder || 'none',
            padding: data.labelPadding || '4px 12px',
          }"
        >
          <span class="label-text">{{ data.label }}</span>
          <div v-if="data.showCircle" class="side-circle"></div>
        </div>
      </div>
    </foreignObject>
  </g>
</template>

<script setup>
import { BaseEdge, getSmoothStepPath } from '@vue-flow/core';
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { registerFlowEdge, unregisterFlowEdge, reportFinished, isStageCompleted, getFlowState } from './edgeFlowCoordinator';

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
  data: { type: Object, default: () => ({ doubleArrow: false, startTime: 0, endTime: Infinity }) },
  style: { type: Object },
});


const isWithinTimeRange = ref(false);
let startTimeout = null;
let endTimeout = null;

const setupTimeBounds = () => {
  if (startTimeout) clearTimeout(startTimeout);
  if (endTimeout) clearTimeout(endTimeout);

  const now = Date.now();
  const startTime = props.data.startTime || 0;
  const endTime = props.data.endTime || Infinity;
  if (startTime > 0) {
    isWithinTimeRange.value = false;
    startTimeout = setTimeout(() => {
      isWithinTimeRange.value = true;
    }, startTime);
  } else {
    isWithinTimeRange.value = true;
  }
  if (endTime !== Infinity) {
    endTimeout = setTimeout(() => {
      isWithinTimeRange.value = false;
    }, endTime);
  }
};

const edgePath = computed(() => {
  const waypoints = props.data?.waypoints;
  if (waypoints && waypoints.length > 0) {
    const points = [{ x: props.sourceX, y: props.sourceY }, ...waypoints, { x: props.targetX, y: props.targetY }];
    const radius = props.data?.borderRadius ?? 0;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1], curr = points[i], next = points[i + 1];
      const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
      const r = Math.min(radius, d1 / 2, d2 / 2);
      const t1x = curr.x - (r * (curr.x - prev.x)) / d1, t1y = curr.y - (r * (curr.y - prev.y)) / d1;
      const t2x = curr.x + (r * (next.x - curr.x)) / d2, t2y = curr.y + (r * (next.y - curr.y)) / d2;
      d += ` L ${t1x} ${t1y} Q ${curr.x} ${curr.y} ${t2x} ${t2y}`;
    }
    d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return d;
  }
  return getSmoothStepPath(props)[0];
});

const labelX = computed(() => {
  if (props.data?.labelX !== undefined) return props.data.labelX;
  return getSmoothStepPath(props)[1];
});
const labelY = computed(() => {
  if (props.data?.labelY !== undefined) return props.data.labelY;
  return getSmoothStepPath(props)[2];
});

const labelBoxWidth = computed(() => {
  const text = String(props.data?.label || '');
  return props.data?.labelWidth || Math.max(84, text.length * 8 + (props.data?.showCircle ? 46 : 28));
});
const labelBoxHeight = computed(() => props.data?.labelHeight || 36);
const labelBoxX = computed(() => labelX.value - labelBoxWidth.value / 2);
const labelBoxY = computed(() => labelY.value - labelBoxHeight.value / 2);

const markerId = computed(() => `marker-end-${props.id}`);
const markerStartId = computed(() => `marker-start-${props.id}`);
const pulseGradientId = computed(() => `pulse-grad-${props.id}`);
const motionPathId = computed(() => `motion-path-${props.id}`);
const startMarkerColor = computed(() => props.data?.gradientStart || props.data.markerColor || props.style?.stroke || '#000000');
const endMarkerColor = computed(() => props.data?.gradientEnd || props.data.markerColor || props.style?.stroke || '#000000');
const glowColor = computed(() => props.data?.glowColor || props.data?.flowColor || '#ffffff');
const pulseRadius = computed(() => props.data?.pulseRadius ?? 4);
const pulseDuration = computed(() => props.data?.pulseDuration ?? 0.9);

const flowStage = computed(() => props.data?.flowStage ?? props.data?.flowOrder);
const flowGroup = computed(() => props.data?.flowGroup ?? 'default');
const inFlow = computed(() => typeof flowStage.value === 'number');
const flowState = getFlowState();

const isActive = computed(() => {
  if (!inFlow.value) return false;
  return flowState[flowGroup.value]?.activeStage === flowStage.value;
});

const stageCompleted = computed(() => {
  if (!inFlow.value) return false;
  return isStageCompleted(flowGroup.value, flowStage.value);
});

const firstPassDone = computed(() => inFlow.value ? stageCompleted.value : localFirstPass.value);
const localFirstPass = ref(false);
let firstPassTimer = null;

const clearTimer = () => {
  if (firstPassTimer) { clearTimeout(firstPassTimer); firstPassTimer = null; }
};

const startFirstPassTimer = () => {
  clearTimer();
  firstPassTimer = setTimeout(() => {
    if (inFlow.value) reportFinished(flowGroup.value, props.id, flowStage.value);
    else localFirstPass.value = true;
  }, pulseDuration.value * 1000);
};

onMounted(() => {
  setupTimeBounds();
  if (inFlow.value) registerFlowEdge(flowGroup.value, props.id, flowStage.value);
  if (isActive.value) startFirstPassTimer();
});

watch(isActive, (active) => {
  if (active) startFirstPassTimer();
  else clearTimer();
});

watch(() => [props.data.startTime, props.data.endTime], () => {
  setupTimeBounds();
  if (inFlow.value) registerFlowEdge(flowGroup.value, props.id, flowStage.value);
}, { deep: true });

onBeforeUnmount(() => {
  clearTimer();
  if (startTimeout) clearTimeout(startTimeout);
  if (endTimeout) clearTimeout(endTimeout);
  if (inFlow.value) unregisterFlowEdge(flowGroup.value, props.id);
});

const edgeStyle = computed(() => {
  const hasGradient = props.data?.gradientStart && props.data?.gradientEnd;
  const strokeColor = hasGradient ? `url(#grad-${props.id})` : props.style?.stroke || '#000000';

  let strokeDasharray = props.style?.strokeDasharray;
  if (props.data?.dashed) {
    strokeDasharray = typeof props.data.dashed === 'string' ? props.data.dashed : '5 5';
  }

  return {
    ...props.style,
    stroke: strokeColor,
    strokeDasharray,
    transition: 'stroke-width 0.3s ease',
  };
});
</script>

<style scoped>
:deep(.vue-flow__edge-path) {
  stroke-linecap: round;
  stroke-linejoin: round;
}
.edge-flow-dot {
  pointer-events: none;
}
.edge-arrow-head {
  animation: arrow-glow 1.4s ease-in-out infinite;
  transform-origin: center;
}
.label-shell {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
@keyframes arrow-glow {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
@keyframes dash-draw {
  from {
    stroke-dashoffset: 2;
  }
}

.animated-dash {
  animation: dash-draw 0.5s linear infinite;
}

.custom-edge-label {
  position: relative;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Inter', sans-serif;
  min-width: 56px;
  z-index: 10;
}
.custom-edge-label.first-pass-done {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35), 0 0 0 2px #ffffff, 0 0 8px rgba(255, 255, 255, 0.7);
  animation: label-border-in 0.35s ease-out;
}
.side-circle {
  position: absolute; right: 0px; top: 50%;
  transform: translateY(-50%);
  width: 14px; height: 100%;
  background-color: #ffffff;
  border-radius: 50%;
}
</style>