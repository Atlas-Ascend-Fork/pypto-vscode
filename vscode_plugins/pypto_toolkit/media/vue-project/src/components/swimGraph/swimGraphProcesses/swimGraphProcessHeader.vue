<template>
  <div class="process-header" @click="handleToggleProcess" :class="{'process-header-width': resetWidth}">
    <div class="process-header-label" @mouseover.stop="handleMouseOver">
      <div class="label_one">
        <span class="expand-icon" v-if="isExpanded"><img class="collapse" :src="collapse" alt="collapse"/></span>
        <span class="expand-icon" v-else><img class="dropDown" :src="dropDown" alt="dropDown"/></span>
        <span>{{ process.processName }}</span>
      </div>
      <div class="label_two">
        <span :style="{'display':cycleDisplay}"> {{ $t(selectedOption) }}</span>
        <d-tooltip :content="$t('ddTooltip')">
          <span class="expand-icon-mode" :style="{'display':'none'}" @click="toggleDropDown"><img class="dropDownMode" :src="dropDown" alt="dropDown1"/></span>
        </d-tooltip>
        <div v-if="isDropdownVisible" class="dropdownSelect">
          <ul>
            <li @click="selectOption('timeCir')">{{ $t("timeCir") }}</li>
            <li @click="selectOption('throughput')">{{ $t("throughput") }}</li>
            <li @click="selectOption('cacheHit')">{{ $t("cacheHit") }}</li>
            <li @click="selectOption('task')">{{ $t("task") }}</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="process-header-line">
      <canvas class="process-header-canvas" :data-process-header-key="process.key"></canvas>
      <canvas class="process-hover-header-canvas" :data-process-hover-header-key="process.key"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, watch} from 'vue';
import { useI18n } from 'vue-i18n';
const { t: $t } = useI18n();
// 注入父组件提供的状态和方法
const {
  layout,
  processExpanded,
  swimlaneContainer,
  isDarkTheme,
  processes
} = inject('swimGraphState');

const {
  toggleProcess
} = inject('swimGraphMethods');

const { addChildContext } = inject('swimGraphContext');
const { cycleDisplay } = inject('swimCycleDisplay');

let dropDown = ref(`${window.staticPath}/static-assets/swim_dropDown.svg`);
let collapse = ref(`${window.staticPath}/static-assets/swim_collapse.svg`);

const isDropdownVisible = ref(false);
const selectedOption = ref('timeCir');
const isDisabled = ref(true);

// 定义props
const props = defineProps({
  processKey: {
    type: String,
    required: true
  },
  process: {
    type: Object,
    required: true
  }
});

const toggleDropDown = () => {
  if(!isDisabled.value) {
    isDropdownVisible.value = !isDropdownVisible.value;
  }
};

const selectOption = (option) => {
  selectedOption.value = option;
  isDropdownVisible.value = false;
};

const isExpanded = computed(() => {
  return processExpanded.get(props.processKey);
});

const handleToggleProcess = () => {
  toggleProcess(props.processKey);
};
let resetWidth = ref(false);

const curThread = inject('curThread');

const handleMouseOver = (e) => {
  if (curThread != '') {
    curThread.value = '';
  }
};

const processHeadCanvasResize = () => {
  const containerRect = document.querySelector('.process-header-line')?.getBoundingClientRect();
  if (!containerRect) return;

  const availableWidth = containerRect.width;
  const canvasWidth = availableWidth;
  const canvasHeight = 30;

  for (const processx of processes.entries()) {
    const canvasRef = document.querySelector(`[data-process-header-key="${processx[0]}"]`);
    const hoverCanvasRef = document.querySelector(`[data-process-hover-header-key="${processx[0]}"]`);

    canvasRef.style.width = canvasWidth + 'px';
    canvasRef.style.height = canvasHeight + 'px';
    hoverCanvasRef.style.width = canvasWidth + 'px';
    hoverCanvasRef.style.height = canvasHeight + 'px';
  
    canvasRef.width = canvasWidth;
    canvasRef.height = canvasHeight;
    hoverCanvasRef.width = canvasWidth;
    hoverCanvasRef.height = canvasHeight;
  }
}

const drawProcessHeadLine = (x, color, flag) => {
  const canvasRefs = Array.from(processes.entries()).map(([key]) => {
    return document.querySelector(flag === "over" ? `[data-process-hover-header-key="${key}"]` : 
      `[data-process-header-key="${key}"]`)
  });
  canvasRefs.forEach(canvasRef => {
    const ctx = canvasRef.getContext('2d');
    const height = 30;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });
}

const eraseProcessHeadLine = (flag) => {
  const canvasRefs = Array.from(processes.entries()).map(([key]) => {
    return document.querySelector(flag === "over" ? `[data-process-hover-header-key="${key}"]` : 
      `[data-process-header-key="${key}"]`)
  });
  canvasRefs.forEach(canvasRef => {
    const ctx = canvasRef.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  });
}

// 生命周期钩子
onMounted(() => {
  // canvas 初始化
  processHeadCanvasResize();

  const containerEl = swimlaneContainer.value?.parentNode?.querySelector('.swimlane-container');
  if (containerEl) {
    resetWidth.value = containerEl.offsetWidth === containerEl.clientWidth;
  }
  updateTheme();
});

addChildContext('processHeaderEvent', {
  drawProcessHeadLine,
  eraseProcessHeadLine,
});

watch(isDarkTheme, () => {
  updateTheme();
});

const updateTheme = () => {
  dropDown.value =  isDarkTheme.value ? `${window.staticPath}/static-assets/swim_dropDown.svg` : `${window.staticPath}/static-assets/swim_dropDown_light.svg`;
  collapse.value =  isDarkTheme.value ? `${window.staticPath}/static-assets/swim_collapse.svg` : `${window.staticPath}/static-assets/swim_collapse_light.svg`;
}
</script>

<style scoped>
@import url("../css/swimGraph/Processes/header.css");
</style>
