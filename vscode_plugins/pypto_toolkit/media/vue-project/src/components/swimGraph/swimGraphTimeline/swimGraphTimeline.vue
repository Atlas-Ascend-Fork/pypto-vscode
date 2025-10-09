<template>
  <div class="timeline" 
  @mousedown="timelineMouseDown($event)" @mousemove="timelineMouseMove($event)" @mouseup="timelineMouseUp($event)"
  @mouseleave="timelineMouseOut($event)">
    <!-- 一段时间轴区域 -->
    <div class="fixed-timeline-area" v-if="!loading">
      <canvas class="fixed-timeline-canvas" ref="fixedtimelineCanvas"></canvas>
    </div>

    <!-- 二段时间轴区域 -->
    <div class="timeline-area" v-if="!loading">
      <canvas class="timeline-canvas" ref="timelineCanvas" @wheel="handleWheel"></canvas>
      <canvas class="hover-flags-canvas" ref="hoverFlagsCanvas"></canvas>
      <canvas class="flags-canvas" ref="flagsCanvas" @mouseover="flagMouseOver" @mouseleave="flagMouseOut" @mousemove="flagMouseMove"
      @click="flagMouseClick"></canvas>
    </div>
    <div class="flagtooltip" ref="flagtooltip" :style="flagtooltipStyle">
      <d-button icon="icon-delete" class="deletebotton" style="font-size: 16px;" @click.stop="deleteFlag"></d-button>
      <d-button icon="icon-edit" class="editbotton" style="font-size: 16px;" @click.stop="editFlag"></d-button>
    </div>
    <div v-if="isEditing" class="edit-model" :style="editmodelStyle">
      <div class="model-content">
        <div class="edit-head">
          <div class="edit-title">{{ $t('editTitle') }}</div>
          <div class="edit-close-button">
            <d-button icon="icon-close" style="border:none; background-color: transparent" @click="toggleEditModel"></d-button>
          </div>
        </div>
        <div class="edit-time">
          <span class="time-title">{{ $t('editTime') }}</span>
          <span class="time-edit"> {{ editTime }} </span>
        </div>
        <div class="edit-color">
          <span class="color-title">{{ $t('editColor') }}</span>
          <d-slider class="flagcolor" v-model="colorValue" :min="0" :max="360" :interval="1" :tooltip="'always'" @update:modelValue="onColorChange"></d-slider>
          <d-slider class="saturation" v-model="saturationValue" :min="0" :max="100" :interval="1" :tooltip="'always'" @update:modelValue="onSaturationChange"></d-slider>
        </div>
        <div class="edit-label">
          <span class="laebl-edit">{{ $t('editLabel') }}</span>
          <d-input class="label-input" v-model="refLabel" size="sm" :placeholder="$t('editInput')" show-count :maxlength="16" clearable @clear="handleClear" @update:modelValue="onInputChange"></d-input>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted, onUnmounted, nextTick, reactive} from 'vue';
import { devicePixelRatio, setupHighDPICanvas, getCanvasCSSWidth } from '../swimGraphUtils';
import { useI18n } from 'vue-i18n';
import { throttle } from 'lodash-es';
import { getTextWidth } from '../../../utils';

const { t: $t } = useI18n();

// 注入父组件提供的状态和方法
const {
  viewState,
  layout,
  timeLineX,
  sliderValue,
  sliderMax,
  initialScale,
  loading,
  timelineState,
  childContextMap
} = inject('swimGraphState');

const {
  render,
  renderFixedTimeline,
  renderTimeline,
  calculateGridInterval,
  timeToX,
  xToTime,
  transform,
} = inject('swimGraphMethods');

let isTimelineDragging = false;
let timelineInitX = 0;
let timelineInitStartX = 0;
let timelineInitEndX = 0
let lastPostion = 0;
let wheelDebounceTimer;
const fixedtimelineCanvas = ref(null);
const fixedtimelineCtx = ref(null);
const timelineCanvas = ref(null);
const timelineCtx = ref(null);
const flagsCanvas = ref(null);
const flagsCtx = ref(null);
const hoverFlagsCanvas = ref(null);
const hoverFlagsCtx = ref(null);
const isTimelineMove = ref(false);
const hoverCurFlag = ref(null);
const flags = ref([]);
const currentFlag = ref(null);
const colorValue = ref(0);
const saturationValue = ref(100);
const refColor = ref("rgba(94, 124, 224, 1)");
const refLabel = ref("");
const isShowTooltip = ref(false);
const flagtooltip = ref(null);
const flagtooltipStyle = reactive({
  display: 'none',
  left: '0px',
  top: '0px'
})
const isEditing = ref(false);
const editTime = ref('00:00:00.123456789');
const editmodelStyle = reactive({
  display: 'none',
  left: '0px',
  top: '0px'
})


const toggleEditModel = () => {
  isEditing.value = false;
  refLabel.value = '';
  hideTooltip();
}
const handleClear = () => {
  refLabel.value = '';
};

const fixedXToTime = (x) => {
  if (!fixedtimelineCanvas.value) return 0;

  const canvasWidth = viewState.canvasCssWidth;
  const normalizedTime = (x - layout.processLabelWidth) / canvasWidth;
  return viewState.minTime + (normalizedTime * viewState.timeRange);
};

const timelineMouseDown = (e) => {
  hoverLineErase();
  if (!fixedtimelineCtx.value || !fixedtimelineCanvas.value) return;
  const rect = fixedtimelineCanvas.value.getBoundingClientRect();
  
  const mouseX = e.clientX - rect.left;
  timelineInitX = mouseX;
  lastPostion = mouseX;
  timelineInitStartX = timelineState.startTimeX;
  timelineInitEndX = timelineState.endTimeX;

  if (Math.abs(mouseX - timelineInitStartX) < 5){
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'ew-resize';
    timelineCanvas.value.style.cursor = 'ew-resize';
    timelineState.isInLeftTag = true;
    return;
  }

  if (Math.abs(mouseX - timelineInitEndX) < 5){
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'ew-resize';
    timelineCanvas.value.style.cursor = 'ew-resize';
    timelineState.isInRightTag = true;
    return;
  }

  if (mouseX > timelineInitStartX && mouseX < timelineInitEndX) {
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'move';
    timelineCanvas.value.style.cursor = 'move';
    timelineState.isOnTag = true;
    return;
  }

  if (mouseX < timelineInitStartX || mouseX > timelineInitEndX) {
    isTimelineDragging = true;
    fixedtimelineCanvas.value.style.cursor = 'crosshair';
    timelineCanvas.value.style.cursor = 'crosshair';
    timelineState.isOutTag = true;
    return;
  }
}

const timelineMouseMove = (e) => {
  if (!isTimelineDragging) return;
  isTimelineMove.value = true;
  const rect = fixedtimelineCanvas.value.getBoundingClientRect();
  const canvasWidth = viewState.canvasCssWidth;
  const mouseX = e.clientX - rect.left;
  const timelineOffsetX = mouseX - timelineInitX;
  let startTime = 0;

  if (timelineState.isInLeftTag === true) {
    if (timelineInitEndX - mouseX === 0) {
      return;
    }
    viewState.scale = canvasWidth / Math.abs(timelineInitEndX - mouseX);
    startTime = fixedXToTime(mouseX + layout.processLabelWidth);
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    // 同步范围滑块变化
    const sliderCount = Math.round(Math.log(viewState.scale) / Math.log(1.25));
    sliderValue.value =parseInt(sliderCount, 10); 
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
    return;
  }

  if (timelineState.isInRightTag === true) {
    if (mouseX - timelineInitStartX === 0) {
      return;
    }
    viewState.scale = canvasWidth / Math.abs(mouseX - timelineInitStartX);
    startTime = fixedXToTime(timelineInitStartX + layout.processLabelWidth);
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    // 同步范围滑块变化
    const sliderCount = Math.round(Math.log(viewState.scale) / Math.log(1.25));
    sliderValue.value = parseInt(sliderCount, 10);
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
    return;
  }

  if (timelineState.isOnTag === true) {
    const onTagTimerange = mouseX - timelineInitX;
    startTime = fixedXToTime(timelineInitStartX + onTagTimerange + layout.processLabelWidth);
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    if (viewState.offsetX > 0) {
      viewState.offsetX = 0;
      viewState.pixelOffsetX = 0;
      transform();
      return;
    }
    if (timelineInitEndX + onTagTimerange > canvasWidth) {
      return;
    }
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
    return;
  }

  if (timelineState.isOutTag === true) {
    if (Math.abs(timelineOffsetX) < 10) {
      return;
    }
    viewState.scale = canvasWidth / Math.abs(timelineOffsetX);
    startTime = fixedXToTime(timelineInitX + layout.processLabelWidth);
    if (timelineOffsetX < 0){
      startTime = fixedXToTime(mouseX + layout.processLabelWidth);
    }
    const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
    viewState.offsetX = (viewState.minTime - startTime) / timelinePerPixel;
    // 同步范围滑块变化
    const sliderCount = Math.round(Math.log(viewState.scale) / Math.log(1.25));
    sliderValue.value = parseInt(sliderCount, 10); 
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
    return;
  }
}

const timelineMouseUp = (e) => {
  const rect = fixedtimelineCanvas.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  if (Math.abs(mouseX - timelineInitX) < 10) {
    isTimelineMove.value = false;
  }
  clearTimeout(dragTimeout);
  timelineMouseEventReset();
}

const timelineMouseOut = (e) => {
  timelineMouseEventReset();
}

const timelineMouseEventReset = () => {
  fixedtimelineCanvas.value.style.cursor = 'default';
  timelineCanvas.value.style.cursor = 'default';
  isTimelineDragging = false;
  timelineState.isInLeftTag = false;
  timelineState.isInRightTag = false;
  timelineState.isOnTag = false;
  timelineState.isOutTag = false;
  timelineInitX = 0;
  timelineInitStartX = timelineState.startTimeX;
  timelineInitEndX = timelineState.endTimeX;
}

// 防抖的渲染函数，避免频繁重绘
const throttledRender = throttle(() => {
  transform();
}, 16); // 约60fps

const handleWheel = (e) => {
  clearTimeout(wheelDebounceTimer);
  const isZooming = e.ctrlKey;

  if (!timelineCanvas.value) return;

  const rect = timelineCanvas.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  // 如果没有按住 ctrl 键，则允许默认滚动行为（不阻止事件）
  if (!isZooming) {
    return;
  }
  if(viewState.scale * 10 >= sliderMax.value && e.deltaY < 0) {
    wheelDebounceTimer = setTimeout(() => {
      postMessage($t('scaleMaxInfo'));
    }, 100);
    return;
  }
  if(viewState.scale === 1 && e.deltaY > 0) {
    wheelDebounceTimer = setTimeout(() => {
      postMessage($t('scaleMinInfo'));
    }, 100);
    return;
  }
  const zoomFactor = e.deltaY >  0 ? 0.8 : 1.25;
  const oldScale = viewState.scale;
  const oldOffsetX = viewState.offsetX;

  if (e.deltaY > 0 && oldScale === initialScale.value && oldOffsetX >= 0) {
    return;
  }
  
  if (e.deltaY > 0 && viewState.scale * zoomFactor < initialScale.value) {
    viewState.scale = initialScale.value;
  } else {
    viewState.scale = Math.max(initialScale.value, Math.min(sliderMax.value / 10, viewState.scale * zoomFactor));
  }

  const sliderCount = Math.round(Math.log(viewState.scale) / Math.log(1.25));
  sliderValue.value = parseInt(sliderCount, 10); 

  viewState.scaleChange = viewState.scale / oldScale;
  viewState.offsetX = mouseX - (mouseX - oldOffsetX) * viewState.scaleChange;
  const timeLineEndX = Math.abs(timeLineX.value);
  if(timelineCanvas.value && getCanvasCSSWidth(timelineCanvas.value) > timeLineEndX){
    const tempOffsetX = getCanvasCSSWidth(timelineCanvas.value) - timeLineEndX;
    viewState.offsetX += tempOffsetX;
  }
  if (viewState.offsetX > 0) {
    viewState.offsetX = 0;
  }
  viewState.pixelScale = viewState.scale * devicePixelRatio;
  viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
  viewState.minWidth = 1 / viewState.scale;

  throttledRender();
};
const postMessage = (message) => {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'showMessage' , paramObj: { text: message}});
  }
};
const checkIfInInterval = (x) => {
  if(flags.value.length === 0) {
    return null;
  }
  for (const flag of flags.value) {
    const flagX = flag.x;
    let start = flagX - 6;
    let end = flagX + 6;
    if (x >= start && x <= end) {
      return flag;
    }
  }
  return null;
};

const flagMouseMove = (e) => {
  if (!hoverFlagsCanvas.value || isTimelineDragging) return;
  const rect = hoverFlagsCanvas.value.getBoundingClientRect();
  const ctx = hoverFlagsCtx.value;
  const color = "rgba(94, 124, 224, 1)";
  const mouseX = e.clientX - rect.left;  

  hoverLineErase();
  childContextMap.threadEvent.eraseEventLine("over");
  childContextMap.processHeaderEvent.eraseProcessHeadLine("over");
  const flag = drawFlag(ctx, mouseX, 1, color, '');
  hoverCurFlag.value = flag;
  childContextMap.threadEvent.drawEventLine(mouseX, color, "over");
  childContextMap.processHeaderEvent.drawProcessHeadLine(mouseX, color, "over");
};

const flagMouseOver = (e) => {
  if (!hoverFlagsCanvas.value || isTimelineDragging) return;
  const rect = hoverFlagsCanvas.value.getBoundingClientRect();
  const ctx = hoverFlagsCtx.value;
  const color = "rgba(94, 124, 224, 1)";
  const mouseX = e.clientX - rect.left;
  const flag = drawFlag(ctx, mouseX, 1, color, '');
  childContextMap.threadEvent.drawEventLine(mouseX, color, 'over');
  childContextMap.processHeaderEvent.drawProcessHeadLine(mouseX, color, "over");
  hoverCurFlag.value = flag;
};

const hoverLineErase = () => {
  if (!hoverCurFlag || isTimelineDragging) {
    return;
  }
  childContextMap.threadEvent.eraseEventLine('over');
  childContextMap.processHeaderEvent.eraseProcessHeadLine('over');
  const ctx = hoverFlagsCtx.value;
  const canvas = hoverFlagsCanvas.value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hoverCurFlag.value = null;
};

const flagMouseOut = (e) => {
  hoverLineErase();
};

const randomColor = () => Math.floor(Math.random() * 360);
const formatTime = (str) => {
  let nanoseconds = parseInt(str);
  editTime.value = `${nanoseconds.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const flagMouseClick = (e) => {
  if (!flagsCanvas.value) return;
  if (isShowTooltip.value) {
    hideTooltip();
    isShowTooltip.value = !isShowTooltip.value;
  }
  if (isTimelineMove.value) {
    isTimelineMove.value = false;
    return;
  }
  hoverLineErase();
  const rect = flagsCanvas.value.getBoundingClientRect();
  const ctx = flagsCtx.value;
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const flag = checkIfInInterval(mouseX);
  if (flag === null) {
    colorValue.value = randomColor();
    saturationValue.value = 80;
    refColor.value = `hsl(${colorValue.value}, ${saturationValue.value}%, 50%)`;
    refLabel.value = '';
    const flagTime = xToTime(mouseX + layout.processLabelWidth);
    const currentTime = Math.round((flagTime - viewState.minTime) * 1000);
    formatTime(currentTime);
    const flagId = drawFlag(ctx, mouseX, 1, refColor.value, refLabel.value);
    childContextMap.threadEvent.drawEventLine(mouseX, refColor.value, '');
    childContextMap.processHeaderEvent.drawProcessHeadLine(mouseX, refColor.value, '');
    let labelWidth = getTextWidth((refLabel.value), 12);
    flags.value.push({id: flagId, x: mouseX, y: 1, color: refColor.value, label: refLabel.value, labelW: labelWidth, time: flagTime, overflow: false});
    return ;
  } else {
    currentFlag.value = flag;
    const flagTime = xToTime(mouseX + layout.processLabelWidth);
    const currentTime = Math.round((flagTime - viewState.minTime) * 1000);
    formatTime(currentTime);
    checkFlagHover(mouseX, mouseY);
    return;
  }
}

const checkFlagHover = (x, y) => {
  for (const flag of flags.value) {
    if (x >= flag.x - 6 && x <= flag.x + 6 && y >= flag.y - 1 && y <= flag.y + 12) {
      currentFlag.value = flag;
      showTooltip(flag.x + 10, flag.y);
      isShowTooltip.value = !isShowTooltip.value;
      refLabel.value = flag.label;
      const regex = /hsl\((\d+),\s*(\d+)%/;
      const matchRes = flag.color.match(regex);
      if (matchRes) {
        colorValue.value = matchRes[1];
        saturationValue.value = matchRes[2];
      }
      return flag;
    }
  }
  hideTooltip();
  return null;
}

const flagRender = () => {
  if (!flagsCanvas.value) return;
  const ctx = flagsCtx.value;
  const canvas = flagsCanvas.value;
  childContextMap.threadEvent.eraseEventLine("");
  childContextMap.processHeaderEvent.eraseProcessHeadLine("");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const start = timelineState.startTime;
  const end = timelineState.endTime;
  if (flags.value.length === 0) return;
  for (const flag of flags.value) {
    if (flag.time >= start && flag.time <= end) {
      const x = timeToX(flag.time) - layout.processLabelWidth;
      flag.x = x;
      drawFlag(ctx, flag.x, 1, flag.color, flag.label);
      childContextMap.threadEvent.drawEventLine(flag.x, flag.color, '');
      childContextMap.processHeaderEvent.drawProcessHeadLine(flag.x, flag.color, '');
    }
  }
}

const deleteFlag = () => {
  if (!currentFlag.value) return;
  flags.value = flags.value.filter(flag => flag.x !== currentFlag.value.x);
  flagRender();
  hideTooltip();
}

const drawFlag = (ctx, x, y, color, label) => {
  const flagId = `flag-${Date.now()}-${Math.random()}`;
  const flagHeight = 6;
  const flagWidth = 12;
  const tailLength = 6;
  x = x - 6;
  y = y + 6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + tailLength);
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - flagHeight);
  ctx.lineTo(x + flagWidth / 2, y - flagHeight);
  ctx.lineTo(x + flagWidth / 2, y - flagHeight + 2);
  ctx.lineTo(x + flagWidth, y - flagHeight + 2);
  ctx.lineTo(x + flagWidth, y + 2);
  ctx.lineTo(x + flagWidth / 2, y + 2);
  ctx.lineTo(x + flagWidth / 2, y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.font = '12px Arial';
  ctx.fillStyle = color;
  ctx.fillText(label, x + flagWidth + 2, y + 3);
  ctx.beginPath();
  ctx.moveTo(x + 6, 12);
  ctx.lineTo(x + 6, 40);
  ctx.strokeStyle = color;
  ctx.stroke();
  return flagId;
};

const showTooltip = (x, y) => {
  const rect = flagsCanvas.value.getBoundingClientRect();
  let tooltipLeft = x + currentFlag.value.labelW;
  // 编辑页面184溢出屏幕时，向左展开
  if (tooltipLeft + 184 > rect.width) {
    tooltipLeft = x - 82;
    currentFlag.value.overflow = true;
  } else {
    currentFlag.value.overflow = false;
  }
  flagtooltipStyle.left = `${tooltipLeft}px`;
  flagtooltipStyle.top = `${y + 20}px`; // 加上timeline的高度
  flagtooltipStyle.display = 'flex';
}

const hideTooltip = () => {
  flagtooltipStyle.display = 'none';
}

const renderCurFlag = () => {
  if (!currentFlag.value) return;
  drawFlag(flagsCtx.value, currentFlag.value.x, currentFlag.value.y, currentFlag.value.color, currentFlag.value.label);
  childContextMap.threadEvent.drawEventLine(currentFlag.value.x, currentFlag.value.color, '');
  childContextMap.processHeaderEvent.drawProcessHeadLine(currentFlag.value.x, currentFlag.value.color, '');
  
}

const onColorChange = () => {
  if (!currentFlag.value) return;
  currentFlag.value.color = `hsl(${colorValue.value}, 80%, 50%)`;
  renderCurFlag();
}

const onSaturationChange = () => {
  if (!currentFlag.value) return;
  currentFlag.value.color = `hsl(${colorValue.value}, ${saturationValue.value}%, 50%)`;
  renderCurFlag();
}

const clearLabel = (ctx, x, y, labelW) => {
  let flagWidth = 12;
  ctx.clearRect(x + flagWidth, y - 10, labelW, 20);
}

const onInputChange = () => {
  if (!currentFlag.value) return;
  if (currentFlag.value.label === refLabel.value) return;
  clearLabel(flagsCtx.value, currentFlag.value.x, currentFlag.value.y, currentFlag.value.labelW);
  currentFlag.value.label = refLabel.value;
  currentFlag.value.labelW = getTextWidth((currentFlag.value.label), 12);
  renderCurFlag();
}

const editFlag = (e) => {
  isEditing.value = true;
  const buttonRect = e.target.getBoundingClientRect();
  let editLeft;
  if (currentFlag.value.overflow) {
    // 184为编辑页面的宽度
    editLeft = buttonRect.left + 22 - 184;
  } else {
    editLeft = buttonRect.left - 39;
  }
  editmodelStyle.left = `${editLeft}px`;
  editmodelStyle.top = `${buttonRect.bottom + 12}px`;
  editmodelStyle.display = 'block';
}


const resizeCanvases = () => {
  const containerRect = document.querySelector('.swimlane-container')?.getBoundingClientRect();
  if (!containerRect) return;

  const availableWidth = containerRect.width;
  const canvasWidth = availableWidth;

  // 使用高DPI设置调整时间轴画布大小
  if (fixedtimelineCanvas.value) {
    const ctx = setupHighDPICanvas(fixedtimelineCanvas.value, canvasWidth, 20);
    viewState.canvasCssWidth = canvasWidth;
    viewState.canvasWidth = ctx.canvas.width;
  }
  if (timelineCanvas.value) {
    setupHighDPICanvas(timelineCanvas.value, canvasWidth, 40);
  }
  if (flagsCanvas.value) {
    setupHighDPICanvas(flagsCanvas.value, canvasWidth, 40);
  }
  if (hoverFlagsCanvas.value) {
    setupHighDPICanvas(hoverFlagsCanvas.value, canvasWidth, 40);
  }
};

const initCanvases = () => {
  // 初始化时间轴画布
  if (fixedtimelineCanvas.value) {
    fixedtimelineCtx.value = fixedtimelineCanvas.value.getContext('2d');
  }
  if (timelineCanvas.value) {
    timelineCtx.value = timelineCanvas.value.getContext('2d');
  }

  if (hoverFlagsCanvas.value) {
    hoverFlagsCtx.value = hoverFlagsCanvas.value.getContext('2d');
  }

  if (flagsCanvas.value) {
    flagsCtx.value = flagsCanvas.value.getContext('2d');
  }

  resizeCanvases();
  nextTick(() => {
    renderFixedTimeline();
    renderTimeline();
  });
};

onMounted(() => {
  initCanvases();
});

onUnmounted(() => {
  throttledRender.cancel();
});

// 暴露方法给父组件
defineExpose({
  resizeCanvases,
  initCanvases,
  fixedtimelineCanvas,
  timelineCanvas,
  fixedtimelineCtx,
  timelineCtx,
  handleWheel,
  flagRender,
});
</script>

<style scoped lang="scss">
@import url("../css/swimGraph/Timeline/timeline.css");
.label-input {
  padding-right: 12px;
  :deep() {
    .devui-input__wrapper {
      background: var(--devui-input-bg);
      input:focus {
        outline: none;
      }
    }
  }
}

.flagcolor {
  :deep() {
    .devui-slider__runway {
      background: linear-gradient(270.00deg, rgba(255, 1, 19, 1), rgba(251, 1, 254, 1) 17%, rgba(1, 134, 255, 1) 33%, rgba(0, 164, 255, 1) 47%, rgba(9, 255, 2, 1) 63%, rgba(255, 214, 1, 1) 81%, rgba(255, 50, 1, 1) 100%);
    }
    .devui-slider__button, .devui-slider__bar, .devui-slider__runway:hover .devui-slider__bar:not(.disabled) {
      background-color: transparent;
    } 
  }
}

.saturation {
  :deep() {
    .devui-slider__runway {
      background: linear-gradient(270.00deg, rgba(0, 0, 0, 1), rgba(255, 255, 255, 1) 100%);
    }
    .devui-slider__button, .devui-slider__bar, .devui-slider__runway:hover .devui-slider__bar:not(.disabled) {
      background-color: transparent;
    }
  }
}
</style>
