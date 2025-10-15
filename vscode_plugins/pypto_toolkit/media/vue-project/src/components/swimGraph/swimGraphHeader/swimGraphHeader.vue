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

const mPath = ref(`${window.staticPath}/static-assets/measure.svg`);
const caseSensitivePathNoActive = `${window.staticPath}/static-assets/upper_lower.svg`;
const caseSensitivePathActive = `${window.staticPath}/static-assets/upper_blue.svg`;
const backgroundColor = ref('#606061');

const caseSensitivePath = computed(() => isCaseSensitive.value ? caseSensitivePathActive : caseSensitivePathNoActive);

const searchPlaceholder = $t("searchKeyword");

const searchResultCount = ref(0);

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
