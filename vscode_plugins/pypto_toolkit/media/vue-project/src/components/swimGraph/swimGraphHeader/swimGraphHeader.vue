<template>
  <div class="zoom-controls">
    <div class="left-container">
      <div class="search-container">
        <d-search
          class="swim-search"
          v-model="searchQuery"
          icon-position="left"
          :placeholder="searchPlaceholder"
          :show-glow-style="false"
          size="sm"
          @search="onSearch"
        />
        <d-tooltip :content="$t('caseSensitive')" v-if="searchQuery" position="bottom">
          <button class="case-sensitive" @click="toggleCaseSensitivity" :class="{'case-dark': isCaseSensitive}"><img class="caseSensitive-icon" :src="caseSensitivePath" alt="case Sensitive"></button>
        </d-tooltip>
      </div>
      <span class="result-count" v-if="isSearchActive"> {{ currentResultIndex }} / {{ searchResultCount }} </span>
      <div class="search-res" v-if="isSearchActive">
        <d-icon name="icon-arrow-left-l" class="pre-button" @click="navigateResults('prev')" style="font-size: 16px;" :disabled="currentResultIndex <= 1"></d-icon>
        <d-icon name="icon-arrow-right-l" class="right-button" @click="navigateResults('next')" style="font-size: 16px;" :disabled="currentResultIndex === searchResultCount"></d-icon>
      </div>
    </div>
    <div class="right-container">
      <div class="slider-container" :class="{'slider-container-border': !isDarkTheme}">
        <d-icon name="icon-zoom-out-2" id="swim-header-decrease" @click="decrease()"></d-icon>
        <div class="slider-wrapper">
          <d-slider id="swimSlider" :min="0" :max="sliderMaxCount" v-model="sliderValue" :tips-renderer="null" @update:modelValue="updataScale()" style="width: 110px"></d-slider>
        </div>
        <d-icon name="icon-enlarge" id="swim-header-increase" @click="increase()"></d-icon>
      </div>
      <d-tooltip :content="$t('Measure')">
        <d-button id= "measure-button" @click="measureModel()" :class="{'dark-model': isMeasureModel}" style="height: 28px; width: 28px; padding: 0 4px;">
          <img class="measure-picture" :src="mPath" alt="measure-picture">
        </d-button>
      </d-tooltip>
      <d-button class="icon-container" @click="showDrawer" style="height: 28px; width: 28px; padding:4px">
        <d-icon name="line-chart" size="15px" color="#b3b3b3"></d-icon>
      </d-button>
      <d-drawer v-model="reportVisible" style="width: 480px">
        <div class="report-title">{{reportTitle}}</div>
        <div class="task-container">
          <div class="task-item-container">
            <div class='task-title'>Task Time</div>
            <div class="task-data">{{taskTime}}</div>
          </div>
          <div class="task-item-container">
            <div class='task-title'>{{icacheHitRateTitle}}</div>
            <div class="task-data">{{icacheHitRate}}</div>
          </div>
        </div>
        <div class="aicore-container">
          <div class="aicore-container-column"> 
            <div class="task-item-container">
              <div class="task-title-container">
                <div class='task-title'>AICore Time</div>
                <d-tooltip :content="$t('AICoreTimeTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="task-data">{{aicoreTime}}</div>
            </div>
            <div class="task-item-container">
              <div class='task-title-container'>
                <div class='task-title'>{{aicoreRateTitle}}</div>
                <d-tooltip :content="$t('AICoreRateTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="task-data">{{aicoreRate}}%</div>
            </div>
          </div>
          <div class="aicore-container-column"> 
            <div class="task-item-container">
              <div class='task-title-container'>
                <div class='task-title'>Cube Cycles</div>
                <d-tooltip :content="$t('cubeTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="cube-rate-cycle">{{cubeRateCycle}}</div>
            </div>
            <div class="task-item-container">
              <div class='task-title-container'>
                <div class='task-title'>Vector Cycles</div>
                <d-tooltip :content="$t('vecTip')">
                  <d-icon name="helping" size="16px"></d-icon>
                </d-tooltip>
              </div>
              <div class="vec-rate-cycle">{{vectorRateCycle}}</div>
            </div>
          </div>
          <div class="cube-data-chart">
            <div class="cube-time-bar" :style="{ width: cubeTimeWidth + 'px' }">
              <div class="cube-time-num">{{cubeTimePercentage}}%</div>
            </div>
            <div class="vector-time-bar" :style="{ width: vectorTimeWidth + 'px' }">
              <div class="vector-time-num">{{vectorTimePercentage}}%</div>
            </div>
          </div>
        </div>
        <div class="occupy-rate-container" v-if="pmuExist">
          <div class="occupy-rate-title">{{occupyRateTitle}}</div>
          <div class="row-coord">
            <div class="row-coord-num">0%</div>
            <div class="row-coord-num">20%</div>
            <div class="row-coord-num">40%</div>
            <div class="row-coord-num">60%</div>
            <div class="row-coord-num">80%</div>
            <div class="row-coord-num">100%</div>
          </div>
          <div class="occupy-rate-chart-container">
            <div class="occupy-rate-chart-col-coord-container">
              <div class="occupy-rate-chart-col-coord">Vector Cycles</div>
              <div class="occupy-rate-chart-col-coord">Cube Cycles</div>
              <div class="occupy-rate-chart-col-coord">Scalar Cycles</div>
              <div class="occupy-rate-chart-col-coord">MTE1 Cycles</div>
              <div class="occupy-rate-chart-col-coord">MTE2 Cycles</div>
              <div class="occupy-rate-chart-col-coord">MTE3 Cycles</div>
            </div>
            <div class="occupy-rate-bar-container">
              <div class="occupy-rate-bar-line occupy-rate-bar-line-twenty"></div>
              <div class="occupy-rate-bar-line occupy-rate-bar-line-forty"></div>
              <div class="occupy-rate-bar-line occupy-rate-bar-line-sixty"></div>
              <div class="occupy-rate-bar-line occupy-rate-bar-line-eighty"></div>
              <div class="occupy-rate-backbar occupy-rate-backbar-cube">
                <div class="occupy-rate-bar vector-occupy-rate-bar" :style="{ width: vectorRateWidth + 'px' }"></div>
                <div class="occupy-rate-cycle">{{vectorRateCycle}}</div>
                <div class="occupy-rate-percentage">{{vectorRatePercentage}}%</div>
              </div>
              <div class="occupy-rate-backbar occupy-rate-backbar-vec">
                <div class="occupy-rate-bar cube-occupy-rate-bar" :style="{ width: cubeRateWidth + 'px' }"></div>
                <div class="occupy-rate-cycle">{{cubeRateCycle}}</div>
                <div class="occupy-rate-percentage">{{cubeRatePercentage}}%</div>
              </div>
              <div class="occupy-rate-backbar occupy-rate-backbar-scalar">
                <div class="occupy-rate-bar scalar-occupy-rate-bar" :style="{ width: scalarRateWidth + 'px' }"></div>
                <div class="occupy-rate-cycle">{{scalarRateCycle}}</div>
                <div class="occupy-rate-percentage">{{scalarRatePercentage}}%</div>
              </div>
              <div class="occupy-rate-backbar occupy-rate-backbar-mte1">
                <div class="occupy-rate-bar mte1-occupy-rate-bar" :style="{ width: mte1RateWidth + 'px' }"></div>
                <div class="occupy-rate-cycle">{{mte1RateCycle}}</div>
                <div class="occupy-rate-percentage">{{mte1RatePercentage}}%</div>
              </div>
              <div class="occupy-rate-backbar occupy-rate-backbar-mte2">
                <div class="occupy-rate-bar mte2-occupy-rate-bar" :style="{ width: mte2RateWidth + 'px' }"></div>
                <div class="occupy-rate-cycle">{{mte2RateCycle}}</div>
                <div class="occupy-rate-percentage">{{mte2RatePercentage}}%</div>
              </div>
              <div class="occupy-rate-backbar occupy-rate-backbar-mte3">
                <div class="occupy-rate-bar mte3-occupy-rate-bar" :style="{ width: mte3RateWidth + 'px' }"></div>
                <div class="occupy-rate-cycle">{{mte3RateCycle}}</div>
                <div class="occupy-rate-percentage">{{mte3RatePercentage}}%</div>
              </div>

            </div>
          </div>
        </div>
      </d-drawer>
      <d-button class="right-container-buttor hidden" @click="toggleDetailsCores()">{{ $t("data") }}</d-button>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { devicePixelRatio } from '../swimGraphUtils';

const { t: $t } = useI18n();

// 注入父组件提供的状态和方法
const {
  viewState,
  sliderValue,
  sliderMax,
  sliderMaxCount,
  timeLineX,
  processExpanded,
  processes,
  detailsPanelExpanded,
  selectedEvent,
  highlightedPaths,
  childContextMap,
  swimlaneContainer,
  layout,
  isMeasureModel,
  measureDragStartX,
  measureDragEndX,
  isDarkTheme,
  mulDetailsExpanded,
} = inject('swimGraphState');

const {
  searchQuery,
  searchResult,
  currentResultIndex,
  isSearchActive,
  isCaseSensitive,
} = inject('swimGraphSearch');

const {
  transform,
  toggleDetailsCores,
  getTimelineCanvas,
  resizeMeasure,
  selectEvent,
} = inject('swimGraphMethods');

const {
  pmuTotal
} = inject('swimGraphPmuTotal');

const mPath = ref(`${window.staticPath}/static-assets/measure.svg`);
const caseSensitivePathNoActive = `${window.staticPath}/static-assets/upper_lower.svg`;
const caseSensitivePathActive = `${window.staticPath}/static-assets/upper_blue.svg`;
const backgroundColor = ref('#606061');

const caseSensitivePath = computed(() => isCaseSensitive.value ? caseSensitivePathActive : caseSensitivePathNoActive);

const searchPlaceholder = $t("searchKeyword");

const searchResultCount = ref(0);

const reportVisible = ref(false);

const showDrawer = () => {
  reportVisible.value = true;

  taskTime.value = viewState.timeRange;

  let aicTaskTimeSum = 0;
  let totalCnt = 0;
  for (const [processKey, processVal] of processes) {
    for (const [threadKey, threadVal] of processVal.threads) {
      if (threadVal.isCounter == false) {
        totalCnt++;
      }
      if (threadVal.threadName.toLowerCase().startsWith('aic') || threadVal.threadName.toLowerCase().startsWith('aiv')) {
        for (const event of threadVal.events) {
          aicTaskTimeSum += event.duration;
        }
      }
    }
  }

  aicoreTime.value = aicTaskTimeSum;
  aicoreRate.value = Math.round(aicTaskTimeSum / (totalCnt * taskTime.value) * 100);

  if (Object.keys(pmuTotal.value).length === 0) {
    cubeRateCycle.value = '/';
    vectorRateCycle.value = '/';
    cubeTimePercentage.value = '/';
    vectorTimePercentage.value = '/';
    pmuExist.value = false;
    return;
  }

  const cubeTime = Number(pmuTotal.value.cube_busy_cycles);
  const vectorTime = Number(pmuTotal.value.vec_busy_cycles);

  icacheHitRate.value = String(Math.round(pmuTotal.value.icache_hit * 100)) + '%';

  const barWidth = 406;

  cubeTimePercentage.value = Math.floor(cubeTime / (cubeTime + vectorTime) * 100);
  vectorTimePercentage.value = 100 - cubeTimePercentage.value;
  cubeTimeWidth.value = barWidth * cubeTime / (cubeTime + vectorTime);
  vectorTimeWidth.value = barWidth * vectorTime / (cubeTime + vectorTime);

  vectorRateCycle.value = pmuTotal.value.vec_busy_cycles;
  cubeRateCycle.value = pmuTotal.value.cube_busy_cycles;
  scalarRateCycle.value = pmuTotal.value.scalar_busy_cycles;
  mte1RateCycle.value = pmuTotal.value.mte1_busy_cycles;
  mte2RateCycle.value = pmuTotal.value.mte2_busy_cycles;
  mte3RateCycle.value = pmuTotal.value.mte3_busy_cycles;

  vectorRatePercentage.value = Math.round(pmuTotal.value.vec_ratio * 100);
  cubeRatePercentage.value = Math.round(pmuTotal.value.cube_ratio * 100);
  scalarRatePercentage.value = Math.round(pmuTotal.value.scalar_ratio * 100);
  mte1RatePercentage.value = Math.round(pmuTotal.value.mte1_ratio * 100);
  mte2RatePercentage.value = Math.round(pmuTotal.value.mte2_ratio * 100);
  mte3RatePercentage.value = Math.round(pmuTotal.value.mte3_ratio * 100);

  vectorRateWidth.value = pmuTotal.value.vec_ratio * barWidth;
  cubeRateWidth.value = pmuTotal.value.cube_ratio * barWidth;
  scalarRateWidth.value = pmuTotal.value.scalar_ratio * barWidth;
  mte1RateWidth.value = pmuTotal.value.mte1_ratio * barWidth;
  mte2RateWidth.value = pmuTotal.value.mte2_ratio * barWidth;
  mte3RateWidth.value = pmuTotal.value.mte3_ratio * barWidth;
};

const pmuExist = ref(true);
const reportTitle = ref($t('ReportTitle'));
const icacheHitRateTitle = ref($t('ICacheHitRate'));
const aicoreRateTitle = ref($t('aiCoreUtilization'));
const occupyRateTitle = ref($t('occupyRateTitle'));

const taskTime = ref(0);
const aicoreTime = ref(0);
const aicoreRate = ref(0);
const icacheHitRate = ref('/');

const cubeTimeWidth = ref(203);
const vectorTimeWidth = ref(203);
const cubeTimePercentage = ref(50);
const vectorTimePercentage = ref(50);

const vectorRateWidth = ref(0);
const cubeRateWidth = ref(0);
const scalarRateWidth = ref(0);
const mte1RateWidth = ref(0);
const mte2RateWidth = ref(0);
const mte3RateWidth = ref(0);

const vectorRateCycle = ref('/');
const cubeRateCycle = ref('/');
const scalarRateCycle = ref('/');
const mte1RateCycle = ref('/');
const mte2RateCycle = ref('/');
const mte3RateCycle = ref('/');

const vectorRatePercentage = ref(0);
const cubeRatePercentage = ref(0);
const scalarRatePercentage = ref(0);
const mte1RatePercentage = ref(0);
const mte2RatePercentage = ref(0);
const mte3RatePercentage = ref(0);

const onSearch = (term) => {
  searchQuery.value = term;
  let termL = term.toLowerCase();
  searchResult.value = [];
  searchResultCount.value = 0;
  currentResultIndex.value = 0;
  if (term.trim() === '') {
    // 关闭按钮
    searchResultCount.value = 0;
    currentResultIndex.value = 0;
    isSearchActive.value = false;
    detailsPanelExpanded.value = false;
    selectedEvent.value = null;
    clearSearchData();
    return;
  }
  for (const [processkey, process] of processes.entries()) {
    if (!processExpanded.get(processkey)) {
      continue;
    }
    for (const [threadKey, thread] of process.threads.entries()) {
      thread.events.forEach(event => {
        if (isCaseSensitive.value) {
          if (event.name.includes(term)) {
            searchResult.value.push([event, thread.threadName, processkey]);
          }
        } else {
          if (event.name.toLowerCase().includes(termL)) {
            searchResult.value.push([event, thread.threadName, processkey]);
          }
        }
      });
    }
  }
  if (!searchResult.value.length) {
    clearSearchData();
  }
  searchResult.value.sort((a, b) => a[0].startTime - b[0].startTime);
  searchResultCount.value = searchResult.value.length;
  isSearchActive.value = true;
  if(searchResultCount.value > 0) {
    currentResultIndex.value += 1;
  }
  const target = searchResult.value.at(currentResultIndex.value - 1);
  selectEventChild(target.at(0));
  scrollToEvent(target.at(0));
};
const clearSearchData = () => {
  highlightedPaths.clear();
  for (const [processkey, process] of processes.entries()) {
    if (!processExpanded.get(processkey)) {
      continue;
    }
    selectEvent(null, processkey);
    if (detailsPanelExpanded.value) {
      detailsPanelExpanded.value = false;
    }
  }
};

const toggleCaseSensitivity = () => {
  isCaseSensitive.value = !isCaseSensitive.value;
  if (!searchQuery.value) return;
  if (searchQuery.value) {
    onSearch(searchQuery.value);
  }
};
// 导航搜索结果
const navigateResults = (direction) => {
  if (searchResultCount.value === 0) return;
  if (direction === 'prev') {
    currentResultIndex.value = Math.max(1, currentResultIndex.value - 1);
  } else if (direction === "next") {
    currentResultIndex.value = Math.min(searchResultCount.value, currentResultIndex.value + 1);
  }
  const target = searchResult.value.at(currentResultIndex.value - 1);
  selectEventChild(target.at(0));
  scrollToEvent(target.at(0));
};

const selectEventChild = (event) => {
  selectedEvent.value = event;
  highlightedPaths.clear();
  highlightedPaths.add(event.id);
};

const scrollToEvent = (event) => {
  let needRender = true;
  const eventLeftX = (event.renderInfo.x * viewState.scale) + viewState.offsetX;
  if (eventLeftX < 0) {
    rightmove(0 - eventLeftX);
    needRender = false;
  }
  const eventWidth = event.renderInfo.width * viewState.scale;
  const divElement = document.getElementsByClassName('swimlane-container');
  const scrollWidth = divElement[0].offsetWidth - divElement[0].clientWidth; // 滚动条的宽度
  const eventRightX = eventLeftX + eventWidth;
  
  // 获取canvas的CSS宽度，兼容高DPI和标准DPI
  const canvasCSSWidth = viewState.canvasCssWidth;
  const actualMaxX = canvasCSSWidth - scrollWidth; // 视口最右x坐标
  
  if (eventLeftX < actualMaxX && eventRightX > actualMaxX) {
    // 节点的一半被隐藏在视口之外
    const hiddenWidth = eventRightX - canvasCSSWidth;
    leftmove(hiddenWidth + scrollWidth);
    needRender = false;
  } else if (eventLeftX > actualMaxX) {
    // 节点整个被隐藏在视口之外
    leftmove((eventLeftX - canvasCSSWidth + eventWidth) + scrollWidth);
    needRender = false;
  }
  scrollToEventByDom(event);
  if (needRender) {transform();}
};

const updataScale = () => {
  let scale = Math.pow(1.25, sliderValue.value);
  if (scale * 10 > sliderMax.value) {
    scale = sliderMax.value / 10;
  }
  viewState.scaleChange = scale / viewState.scale;
  viewState.offsetX = viewState.offsetX * viewState.scaleChange;
  const timeLineEndX = Math.abs(timeLineX.value);
  const timelineCanvas = getTimelineCanvas();
  const cssWidth = viewState.canvasCssWidth;
  if(timelineCanvas && cssWidth > timeLineEndX){
    const tempOffsetX = cssWidth - timeLineEndX;
    viewState.offsetX += tempOffsetX;
  }
  if (viewState.offsetX > 0) {
    viewState.offsetX = 0;
  }
  viewState.scale = scale;
  viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
  viewState.pixelScale = viewState.scale * devicePixelRatio;
  viewState.minWidth = 1 / scale;
  transform();
};
const increase = () => {
  if (sliderValue.value < sliderMaxCount.value) {
    sliderValue.value += 1;
    updataScale();
  }
};

const decrease = () => {
  if (sliderValue.value > 0) {
    sliderValue.value -= 1;
    updataScale();
  } 
};
const leftmove = (step=30) => {
  if (viewState.scale === 1) {
    return;
  } else {
    const timeLineEndX = Math.abs(timeLineX.value);
    const canvasWidth = viewState.canvasCssWidth;
    if (canvasWidth > timeLineEndX - step) {
      step = timeLineEndX - canvasWidth;
    }
    viewState.offsetX -= step;
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
  }
};

const rightmove = (step=30) => {
  if (viewState.scale === 1) {
    return;
  } else {
    viewState.offsetX += step;
    if (viewState.offsetX > 0) {
      viewState.offsetX = 0;
    }
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
  }
};

const scrollToEventByDom = (event) => {
  swimlaneContainer.value.scrollTo({
    top: event.renderInfo.y,
    behavior: 'smooth'
  })
};

const measureModel = () => {
  isMeasureModel.value = !isMeasureModel.value;
  if (mPath.value.includes('measure.svg')) {
    mPath.value = `${window.staticPath}/static-assets/measure-active.svg`;
  } else {
    mPath.value = `${window.staticPath}/static-assets/measure.svg`;
  }
  measureDragStartX.value = 0;
  measureDragEndX.value = 0;
  resizeMeasure();
  transform();
  mulDetailsExpanded.value = false;
}

watch(isDarkTheme, () => {
  updateTheme();
});

const updateTheme = () => {
  backgroundColor.value = isDarkTheme.value ? `#606061` : `rgba(0, 0, 0, 0)`;
  document.documentElement.style.setProperty('--backgroundcolor', `${backgroundColor.value}`);
};

onMounted(() => {
  updateTheme();
});

defineExpose({
  leftmove,
  rightmove
})
</script>

<style lang="scss">
@import url("../css/swimGraph/Header/header.css");
.swim-search {
  height: 28px;
  .devui-search__icon {
    width: 28px !important;
    height: 28px;
  }

  .devui-input {
    height: 28px !important;
    padding-left: 26px;
    padding-right: 44px !important;
    background: var(--devui-search-container-bg) !important;
    border: none;
    .devui-input__wrapper {
      background: none;

      input {
        outline: none !important;
      }
    }
  }
}
#swimSlider .devui-slider__runway .devui-slider__bar {
  background-color: var(--devui-slider-bar);
}

#swimSlider .devui-slider__runway {
  background-color: var(--devui-slider-runway);
}

#swimSlider .devui-slider__runway .devui-slider__button {
  background-color: #CED1DB;
  border: none;
}
</style>
