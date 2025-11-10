<template>
  <div class="zoom-control" :style="{width: `${width}px`, right: `${offsetRight + 15}px`}">
    <button class="icon-minus" style="width: 16px; height: 16px; left: 32px; color: var(--devui-text);" :title="t('zoomOut')" @click="zoomOut"></button>
    <input type="text" :value="inputValue" class="zoom-value" @blur="commitZoom" @keydown.enter="$event.target.blur()" @input="onInput "/>
    <span class="text-value">%</span>
    <button class="icon-op-add" style="width: 16px; height: 16px; color: var(--devui-text); margin-right: 8px;" :title="t('zoomIn')" @click="zoomIn"></button>
    <div class="empty-rect"> </div>
    <button class="icon-location-new location-icon" :class="{active: isActive}" style="width: 16px; height: 16px; margin-left: 8px;" :title="t('resizeWindow')" @click="fitScreen"></button>
  </div>
  <div ref="minimapContainerEl" class="com-graph-minimap-container" :style="{width: `${width}px`, height: `${height}px`, right: `${offsetRight + 15}px`}" @click="minimapClick">
    <div class="com-graph-minimap" :id="`${type}_minimap`">
    </div>
    <div
      v-if="isRectVisible"
      ref="moveRectEl"
      :style="rectStyle"
      class="move-rect"
      @click.stop
      @mousemove="handleMouseMove" @mousedown="handleMouseDown" @mouseup="handleMouseUp">
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PropType } from 'vue';

const props = defineProps({
  offsetRight: {
    type: Number,
    default: 0
  },
  type: {
    type: String as PropType<'after' | 'before' | ''>,
    default: ''
  },
  width: {
    type: Number,
    default: 260
  },
  height: {
    type: Number,
    default: 160
  }
});
const emits = defineEmits(['mousedown', 'mousemove', 'mouseup']);

const { t } = useI18n();
const rectLeft = ref(0);
const rectTop = ref(0);
const rectWidth = ref(props.width);
const rectHeight = ref(props.height);
const rectIsDragging = ref(false);
const isRectVisible  = ref(false);
const rectScale = ref(1.0);
const mainmapScale = ref(1.0);
const inputValue = ref(10);
const isActive = ref(false);
const minimapContainerEl = ref<HTMLElement>();
const moveRectEl = ref<HTMLElement>();

let minimapWidth = props.width;
let minimapHeight = props.height;
let minimapTop = 0;
let minimapLeft = 0;
let minimapScale = 1.0;
let mainmapIsDragging = false;
let scaleRation = 1.0;
let mainmapInitX = 0.0;
let mainmapInitY = 0.0;
let offsetX = 0.0;
let offsetY = 0.0;
let originalWidth = 0.0;
let originalHeight = 0.0;
let rectInitWidth = 0;
let rectInitHeight = 0;
let minimapSvgWidth = 0;
let minimapSvgHeight = 0;
let rectMinWidth = 24;
let rectMinHeight = 16;

function syncInput(scale: number) {
  inputValue.value = Math.round(scale * 100);
}

syncInput(mainmapScale.value);

watch(mainmapScale, syncInput, {immediate : true});

function onInput(e) {
  let val = e.target.value.replace(/[^0-9]/g, '');
  inputValue.value = val;
}

function commitZoom() {
  const num = inputValue.value;
  if (!isNaN(num) && num >= 1 && num <= 1000) {
    mainmapScale.value = inputValue.value / 100;
    (window as any).ascEventBus.emit(`${props.type}_mainmap_wheel`, mainmapScale.value);
  } else {
    inputValue.value = mainmapScale.value * 100;
  }
}

function minimapClick(event) {
  if (!minimapContainerEl.value) return;
  const minimap = minimapContainerEl.value;
  const rect = minimap.getBoundingClientRect();
  let tempLeft = event.clientX - rect.left - rectWidth.value / 2;
  let tempTop = event.clientY - rect.top - rectHeight.value / 2;

  tempLeft = Math.max(0, Math.min(tempLeft, minimapWidth - rectWidth.value));
  tempTop = Math.max(0, Math.min(tempTop, minimapHeight - rectHeight.value));

  let x = ((tempLeft - minimapLeft) / minimapSvgWidth) * originalWidth;
  let y = ((tempTop - minimapTop) / minimapSvgHeight) * originalHeight;
  (window as any).ascEventBus.emit(`${props.type}_minimap_rect_move`, [x, y, mainmapScale.value]);
  emits('mousedown');
  emits('mousemove', [x, y, mainmapScale.value]);
  emits('mouseup');
  rectLeft.value = tempLeft;
  rectTop.value = tempTop;
}

function zoomIn() {
  mainmapScale.value = Math.min(10, mainmapScale.value + 0.1);
  (window as any).ascEventBus.emit(`${props.type}_mainmap_wheel`, mainmapScale.value);
}

function zoomOut() {
  mainmapScale.value = Math.max(0.02, mainmapScale.value - 0.1);
  (window as any).ascEventBus.emit(`${props.type}_mainmap_wheel`, mainmapScale.value);
}

function fitScreen() {
  isActive.value = true;
  (window as any).ascEventBus.emit(`${props.type}_mainmap_fitscreen`, "current not");
}

function handleMouseDown(event) {
  const rect = moveRectEl.value;
  if (!rect) {
    return;
  }
  emits('mousedown');
  document.addEventListener("mousemove", handleMouseMove, {capture: true});
  document.addEventListener("mouseup", handleMouseUp, {once: true, capture: true});

  offsetX = event.clientX - rect.offsetWidth / 2;
  offsetY = event.clientY - rect.offsetTop;
  rectIsDragging.value = true;
}

function handleMouseUp() {
  rectIsDragging.value = false;
  document.addEventListener("mousemove", handleMouseMove, {capture: true});
  emits('mouseup');
}

function handleMouseMove(event) {
  const minimap = document.getElementById(`${props.type}_minimap`);
  if (!rectIsDragging.value || !minimap) return;
  const minimapRect = minimap.getBoundingClientRect();
  let mouseX = event.clientX - minimapRect.left;
  const newLeft = mouseX - rectWidth.value / 2;
  let mouseY = event.clientY - minimapRect.top;
  const newTop = mouseY - rectHeight.value / 2;

  let tempLeft = Math.max(0, Math.min(newLeft, minimapWidth - rectWidth.value));
  let tempTop = Math.max(0, Math.min(newTop, minimapHeight - rectHeight.value));

  let x = ((tempLeft - minimapLeft) / minimapSvgWidth) * originalWidth;
  let y = ((tempTop - minimapTop) / minimapSvgHeight) * originalHeight;
  (window as any).ascEventBus.emit(`${props.type}_minimap_rect_move`, [x, y, mainmapScale.value]);
  emits('mousemove', [x, y, mainmapScale.value]);
  rectLeft.value = tempLeft;
  rectTop.value = tempTop;
}

const rectStyle = computed(() => ({
  left: `${rectLeft.value}px`,
  top: `${rectTop.value}px`,
  width: `${rectWidth.value}px`,
  height: `${rectHeight.value}px`,
  //transform: `scale(${rectScale.value})`
}));


function getElementScale(element:Element) {
  
  const minimapStyle = window.getComputedStyle(element);
  let scale = 0.0;
  const transform = minimapStyle.transform;
  if (transform === "none") {
    scale = 1.0;
  } else {
    const scaleMatch = transform.match(/scale\((\d+(?:\.\d+)?)\)/);
    if (scaleMatch) {
      scale = parseFloat(scaleMatch[1]);
    }
  }
  return scale;
}

function initRect() {
  const minimap = document.getElementById(`${props.type}_minimap_root`);
  const children = minimap?.firstElementChild;
  const rect = children?.getBoundingClientRect();
  const minimapRect = minimap.getBoundingClientRect();
  if (!minimap || !children || !rect || !minimapRect) {
    console.error("get mini map rect failed");
    return;
  }
  minimapWidth = minimap.clientWidth;
  minimapHeight = minimap.clientHeight;
  isRectVisible.value = true;
  minimapLeft = rect.left - minimapRect.left;
  minimapTop = rect.top - minimapRect.top;
  minimapSvgWidth = rect.width;
  minimapSvgHeight = rect.height;
  
  originalWidth = rect.width / minimapScale;
  originalHeight = rect.height / minimapScale;

  //calcurrent scale
  const sprottyRoot = document.getElementById(`sprotty${props.type ? '-' + props.type : ''}_root`);
  if (!sprottyRoot) return;
  if (sprottyRoot.clientHeight > sprottyRoot.clientWidth) {
    scaleRation = (sprottyRoot.clientHeight / originalHeight);
    rectInitHeight = rect.height;
    rectInitWidth = Math.min(minimapWidth, (rect.height / sprottyRoot.clientHeight) * sprottyRoot.clientWidth);
  } else {
    scaleRation = (sprottyRoot.clientWidth / originalWidth);
    rectInitWidth = rect.width;
    rectInitHeight = Math.min(minimapHeight, (rect.width / sprottyRoot.clientWidth) * sprottyRoot.clientHeight);
  }

  rectMinHeight = (rectInitHeight / rectInitWidth) * rectMinWidth
  rectWidth.value = Math.max(rectMinWidth, Math.min(minimapWidth, rectInitWidth * (scaleRation / mainmapScale.value)));
  rectHeight.value = Math.max(rectMinHeight, Math.min(minimapHeight, rectInitHeight * (scaleRation / mainmapScale.value)));
  calcRectLeft(mainmapInitX);
  calcRectTop(mainmapInitY);
}

function calcCenter() {
  const minimap = document.getElementById("minimap_root");
  const children = minimap?.firstElementChild;
  const rect = children?.getBoundingClientRect();
  if (!minimap || !children || !rect) {
    console.error("get mini map rect failed");
    return;
  }
  originalWidth = rect.width / minimapScale;
  originalHeight = rect.height / minimapScale;
  let x = minimap.clientWidth / 2;
  x = x - rect.width / 2;
  x = -x / minimapScale;
  (window as any).ascEventBus.emit('minimap_center', [x, minimapTop, minimapScale]);
  setTimeout(initRect, 5);
}

document.addEventListener('mouseup', function() {
  rectIsDragging.value = false;
  mainmapIsDragging = false;
});

function calcRectLeft(minimapX) {
  let tempLeft = (minimapX / originalWidth) * minimapSvgWidth + minimapLeft;
  if ((tempLeft + rectWidth.value) >= minimapWidth) {
    rectLeft.value = minimapWidth - rectWidth.value;
  } else {
    if (tempLeft <= 0) {
      rectLeft.value = 0;
    } else {
      rectLeft.value = tempLeft;
    }
  }
}

function calcRectTop(minimapY) {
  let tempTop = minimapTop + (minimapY / originalHeight) * minimapSvgHeight ;
  if ((tempTop + rectHeight.value) > minimapHeight) {
    rectTop.value = minimapHeight - rectHeight.value;
  } else {
    if (tempTop < 0) {
      rectTop.value = 0;
    } else {
      rectTop.value = tempTop;
    }
  }
}

const zoomListener = (args) => {
  if (args[4] !== undefined && args[4] !== props.type) {
    return;
  }
  mainmapScale.value= args[0];
  let currentScale = scaleRation / mainmapScale.value;
  rectScale.value = currentScale;

  rectWidth.value = Math.min(minimapWidth, Math.max(rectMinWidth, rectInitWidth * currentScale));
  rectHeight.value = Math.min(minimapHeight, Math.max(rectMinHeight, rectInitHeight * currentScale));
  let x = args[1];
  let y = args[2];
  calcRectLeft(x);
  calcRectTop(y);
  let isFitScreen = args[3];
  if (!isFitScreen) {
    isActive.value = false;
  }
}; 

const renderListener = (args) => {
  minimapScale = args[0];
  minimapTop = args[2];
  setTimeout(initRect, 10);
};

const masterRenderListener = (args) => {
  mainmapScale.value = args[0];
  mainmapInitX = args[1];
  mainmapInitY = args[2];
  scaleRation = mainmapScale.value;
};

const mouseDownListener = (args) => {
  mainmapIsDragging = true;
}

const mouseMoveListener = (args) => {
  if (mainmapIsDragging && args[3] === props.type) {
    let x = args[0];
    let y = args[1];
    calcRectLeft(x);
    calcRectTop(y);
    isActive.value = false;
  }
}

function updateRectPosition(args) {
  calcRectLeft(args[0]);
  calcRectTop(args[1]);
}
function syncZoomChange(args) {
  mainmapScale.value= args[0];
  let currentScale = scaleRation / mainmapScale.value;

  rectWidth.value = Math.min(minimapWidth, Math.max(rectMinWidth, rectInitWidth * currentScale));
  rectHeight.value = Math.min(minimapHeight, Math.max(rectMinHeight, rectInitHeight * currentScale));
  let x = args[1];
  let y = args[2];
  calcRectLeft(x);
  calcRectTop(y);
  isActive.value = args[3];
}

defineExpose({ updateRectPosition, syncZoomChange, getCurrentScale: () => mainmapScale.value });

onMounted(() => {
  (window as any).ascEventBus.on(`${props.type}_render-over`, renderListener);
  (window as any).ascEventBus.on('view_zoom', zoomListener);
  (window as any).ascEventBus.on(`${props.type}_view_zoom`, zoomListener);
  (window as any).ascEventBus.on('view_mousedown', mouseDownListener);
  (window as any).ascEventBus.on('view_mousemove', mouseMoveListener);
  (window as any).ascEventBus.on(`${props.type}_master_render_over`, masterRenderListener);
})
</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';
.com-graph-minimap-container {
  box-shadow: 0px -1px 6px 0px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(12px);
  background: $devui-base-bg;
  bottom: 48px;
  position: absolute;
  pointer-events: auto;
  border-radius: 12px 12px 0 0;
  transition: right $devui-animation-duration-slow $devui-animation-ease-in-out-smooth;
  cursor: grab;

  .com-graph-minimap {
    height: 100%;
    width: 100%;
    overflow: hidden;
    pointer-events: none;
  }
}

.zoom-control {
  position: absolute;
  display: flex;
  align-items: center;
  height: 32px;
  background: $devui-base-bg;
  flex-direction: row;
  justify-content: center;
  bottom: 15px;
  padding: 4px 12px;
  gap: 32;
  border-radius: 0 0 12px 12px;
  transition: right $devui-animation-duration-slow $devui-animation-ease-in-out-smooth;

  button {
    font-size: 12px;
    border: none;
    background-color: unset;
    cursor: pointer;

    &.location-icon {
      font-size: 14px;
      color: $devui-text;
    }

    &.location-icon.active {
      color: rgba(49, 122, 247, 1);
    }
  }

  .zoom-value {
    width: 42px;
    border: none;
    background: transparent;
    color: $devui-text;
    font-size: 12px;
    text-align: right;
    padding: 0;
    outline:0 !important;
    box-shadow: none !important;
  }


  .text-value {
    color: $devui-text;
    font-size: 12px;
    margin-right: 26px;
  }

  .empty-rect {
    width: 1px;
    height: 16px;
    left: 183px;
    margin-left: 8px;
    margin-right: 32px;
    background-color: rgba(255, 255, 255, 0.05);
  }


}



.move-rect {
  position: absolute;
  overflow: hidden;
  left: 0;
  top: 0;
  width: 260px;
  height: 160px;
  box-sizing:border-box;
  border: 1px solid rgba(49, 122, 247, 1);
  border-radius: 4px;
  cursor: grab;
}
</style>
