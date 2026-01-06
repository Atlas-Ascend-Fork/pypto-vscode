<template>
  <div class="zoom-controls" :id=zoomControl :class="{ 'zoom-controls-threeColumn': isThreeColumn}" @click.stop>
    <div class="left-container" :class="{ 'left-container-search': isSearchActive}" v-if="threeColumnHeaderVisible">
      <div class="search-container-res" v-if="threeColumnSearchVisible">
        <div class="search-container">
          <d-tooltip :content="getTooltipContent()" position="right" v-if="isLockStatus || isPathLockStatus">
            <d-search class="swim-search" :disabled="isLockStatus || isPathLockStatus"  v-model="searchQuery" icon-position="left" :placeholder="searchPlaceholder"
              :show-glow-style="false" size="sm" is-keyup-search :delay="200" @search="onSearch" />
          </d-tooltip>
          <d-category-search v-else 
            ref="searchEl"
            class="swim-search"
            :category="category" 
            :extend-config="{show:true, clear: {show : isSearchActive}, save: { show: false }, more: {show : false} }"
            :placeholder="searchPlaceholder"
            :text-config="textConfig"
            :show-search-category="searchConfig"
            @search="onSearch"
            @selectedTagsChange="onSelectChange"
            @searchKeyChange="onSearchKeyChange"
            @clearAll="onClearAll">
          </d-category-search>
          <d-tooltip :content="$t('caseSensitive')" v-if="searchedKey" position="bottom">
            <button class="case-sensitive" @click="toggleCaseSensitivity" :class="{'case-dark': isCaseSensitive}">
              <svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor">
                <path d="M339.62496 186.78272H249.8816L4.26496 834.56H97.3824l62.75584-177.46432h269.90592L496.84992 834.56h93.11744L339.62496 186.78272z m-155.19744 396.76416L292.39296 269.1072h1.35168l107.96032 314.43968H184.42752zM927.21664 584.35584c-4.32128 8.09984-17.67424 15.25248-40.07936 21.45792-22.4 6.20544-54.38464 10.65984-95.9488 13.35808-42.6496 4.85376-74.22464 14.84288-94.74048 29.96224s-29.96224 34.816-28.3392 59.1104c3.23584 46.41792 38.05696 69.63712 104.448 69.63712 93.93152-6.4768 145.4848-50.74432 154.65984-132.79744v-60.72832z m-315.79136-97.97632c21.59104-93.93152 90.14272-139.27424 205.66528-136.03328 62.08512-1.61792 107.96544 12.416 137.65632 42.10688 29.69088 29.69088 43.72992 74.76736 42.10688 135.22432v187.04896c-1.61792 25.36448-0.13312 46.82752 4.4544 64.36864 4.58752 17.54112 11.4688 31.70816 20.64896 42.51136h-66.40128c-7.55712-7.55712-13.09184-16.8704-16.59904-27.93472-3.5072-11.06944-5.25824-22.8096-5.25824-35.2256-37.79584 50.74432-97.97632 76.11392-180.57216 76.11392-96.62464-3.24096-148.17792-43.1872-154.65984-119.8336 1.62304-44.80512 16.06144-79.62624 43.32544-104.45824 27.25888-24.832 68.68992-39.67488 124.288-44.53376 44.26752-4.85376 79.89248-9.85088 106.88512-14.976 26.98752-5.13536 45.07648-11.74528 54.25152-19.84 3.24096-42.64448-4.58752-73.68704-23.48032-93.12256-18.88768-19.4304-48.85504-28.3392-89.8816-26.72128-39.94624-1.61792-71.53152 5.39648-94.73536 21.05344-23.2192 15.65696-36.98176 40.21248-41.29792 73.68192l-66.39616-19.4304z" p-id="5425"></path>
              </svg>
            </button>
          </d-tooltip>
        </div>
        <span class="result-count" v-if="isSearchActive"> {{ currentResultIndex }} / {{ searchResultCount }} </span>
        <div class="search-res" v-if="isSearchActive">
          <d-icon name="icon-arrow-left-l" class="pre-button" @click="navigateResults('prev')" style="font-size: 16px;" ></d-icon>
          <d-icon name="icon-arrow-right-l" class="right-button" @click="navigateResults('next')" style="font-size: 16px;"></d-icon>
        </div>
      </div>
    </div>
    <div class="right-container" v-if="threeColumnHeaderVisible">
      <d-button class="icon-container" @click="isThreeColumnSearchActive()" style="height: 28px; width: 28px; padding:4px;" v-if="!threeColumnSearchVisible">
          <d-icon name="icon-search" size="16px" color="var(--devui-overlay-icon)"></d-icon>
      </d-button>
      <div class="slider-container" :class="{'slider-container-border': !isDarkTheme}">
        <d-icon name="icon-zoom-out-2" id="swim-header-decrease" @click="decrease()"></d-icon>
        <div class="slider-wrapper">
          <d-slider id="swimSlider" :min="0" :max="sliderMaxCount" v-model="sliderValue" :tips-renderer="null" @update:modelValue="updataScale()" style="width: 110px"></d-slider>
        </div>
        <d-icon name="icon-enlarge" id="swim-header-increase" @click="increase()"></d-icon>
      </div>
      <d-tooltip position="bottom" :content="$t('ShortcutKeyDescription')">
        <d-button class="shortcut-keys-button" @click="ShortcutKeyShow()" style="height: 28px; width: 28px; padding: 0 4px;">
          <KeyboradIcon :active="isShortcutKeyShow"/>
        </d-button>
      </d-tooltip>
      <d-tooltip :content="$t('exportSwimGraph')" position="bottom" v-if="!isThreeColumn">
        <d-button class="icon-container" :disabled="isExporting" @click="exportSwimGraph" style="height: 28px; width: 28px; padding:4px">
          <d-icon name="icon-download" size="15px" color="var(--devui-overlay-icon)"></d-icon>
        </d-button>
      </d-tooltip>
      <d-tooltip :content="isCfgDisabled ? $t('configButtonDisTip') : $t('configButtonTip')" :mouse-enter-delay="100" overlay-class="corner-tips">
        <d-button class="cfg-button" @click="showSwimCfg()" style="height: 28px; width: 28px; padding: 0 4px;" :disabled="isCfgDisabled">
          <LayerControlIcon :active="isCfgEditing"/>
        </d-button>
      </d-tooltip>
      <d-tooltip :content="$t('Measure')">
        <d-button id="measure-button" @click="measureModel()" :class="{'dark-model': isMeasureModel}" style="height: 28px; width: 28px; padding: 0 4px;">
          <MeasureIcon :active="isMeasureModel"/>
        </d-button>
      </d-tooltip>
      <d-tooltip :content="$t('PerformanceStatus')" position="bottom">
        <d-button class="icon-container" @click="showDrawer" style="height: 28px; width: 28px; padding:4px">
          <d-icon name="line-chart" size="15px" color="var(--devui-overlay-icon)"></d-icon>
        </d-button>
      </d-tooltip>
      <d-button class="icon-container" @click="onToggleSwimFullscreenFunction()" style="height: 28px; width: 28px; padding:4px;" v-if="isThreeColumn">
          <i :class="[isSwimFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']"></i>
      </d-button>
      <d-drawer v-model="reportVisible" style="width: 480px; background-color: #292929;" id="pmu-report">
        <div class="close-container">
          <d-icon name="close" operable @click="closeDrawer"></d-icon>
        </div>
        <div class="report-title">{{reportTitle}}</div>
        <div class="task-container">
          <div class="task-item-container">
            <div class='task-title'>Task Time (μs)</div>
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
                <div class='task-title'>AICore Time (μs)</div>
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
          <div class="aicore-container-column" style="height: 46px; margin-top: 8px"> 
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
              <div class="cube-time-num">{{cubeTimePercentage}}</div>
            </div>
            <div class="vector-time-bar" :style="{ width: vectorTimeWidth + 'px' }">
              <div class="vector-time-num">{{vectorTimePercentage}}</div>
            </div>
          </div>
        </div>
        <swim-graph-bar-chart ref="swimGraphBarChartComponent" v-if="pmuExist"/>
      </d-drawer>
      <d-button class="right-container-buttor hidden" @click="toggleDetailsCores()">{{ $t("data") }}</d-button>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted, provide } from 'vue';
import { useI18n } from 'vue-i18n';
import { devicePixelRatio, getThreadHeight, getThreadStartY } from '../swimGraphUtils';
import SwimGraphBarChart from '../swimGraphBarChart/swimGraphBarChart.vue';
import LayerControlIcon from '../../comGraph/layerControl/layerControlIcon.vue';
import KeyboradIcon from '../icon/keyboardIcon.vue';
import MeasureIcon from '../icon/measureIcon.vue';
import BigNumber from 'bignumber.js';
import { toPng } from 'dom-to-image-more';
const swimGraphBarChartComponent = ref(null);

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
  swimlaneContainer,
  isMeasureModel,
  measureDragStartX,
  measureDragEndX,
  isDarkTheme,
  mulDetailsExpanded,
  isLockStatus,
  isCfgEditing,
  isShortcutKeyShow,
  searchedEvent,
  isThreeColumn,
  fileName,
  isSwimGraphActive,
  isSwimFullscreen,
  isPathLockStatus,
  timelineComponent,
  layout,
  lane2line,
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
  getDisplayName,
  onToggleSwimFullscreenFunction
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
const selectedTagsRef = ref([]);
const searchedKey = ref('');
const searchEl = ref();
let category = [
    {
      label: 'Root Func. Hash',
      field: 'Root',
      type: 'textInput',
      group: 'Basic',
      maxLength: 50,
      validateRules:[
        {required: true, message: $t('noNull'), trigger: 'change'},
        {min: 1, max: 100, message: $t('hashInput'), trigger: 'change'},
        ],
    },
    {
      label: 'Leaf Func. Hash',
      field: 'Leaf',
      type: 'textInput',
      group: 'Basic',
      maxLength: 50,
      validateRules:[
        {required: true, message: $t('noNull'), trigger: 'change'},
        {min: 1, max: 100, message: $t('hashInput'), trigger: 'change'},
        ],
    }
  ];

const searchConfig = {
  keywordDescription: (key) => $t('swimGraphkeywordDesc', { key }),
  fieldDescription: (label) => $t('swimGraphfieldDesc', { label }),
  categoryDescription: $t('swimGraphcategoryDesc')
};
const textConfig = {
  noCategoriesAvailable: $t('noSearchCondition'),
  tagMenuEmpty: $t('noSearchMeasureDetaildata'),
  keywordName: $t('comGraph.keyword')
};
const searchResultCount = ref(0);

const reportVisible = ref(false);
const isExporting = ref(false);
const threeColumnHeaderVisible = ref(false);
const threeColumnSearchVisible = ref(true);
const zoomControl = ref('');

const showSwimCfg = () => {
  isCfgEditing.value = !isCfgEditing.value;
};

const closeDrawer = () => {
  reportVisible.value = false;
};

const showDrawer = () => {
  reportVisible.value = true;

  if (Number.isInteger(viewState.timeRange)) {
    taskTime.value = viewState.timeRange;
  }else {
    taskTime.value = viewState.timeRange.toFixed(2);
  }

  let aicTaskTimeSum = new BigNumber('0');
  let totalCnt = new BigNumber('0');
  for (const [processKey, processVal] of processes) {
    for (const [threadKey, threadVal] of processVal.threads) {
      if (threadVal.isCounter == false) {
        totalCnt = totalCnt.plus(new BigNumber('1'));
      }
      if (threadVal.threadName.toLowerCase().startsWith('aic') || threadVal.threadName.toLowerCase().startsWith('aiv')) {
        for (const event of threadVal.events) {
          aicTaskTimeSum = aicTaskTimeSum.plus(event.duration ? new BigNumber(event.duration) : new BigNumber(0));
        }
      }
    }
  }

  aicoreTime.value = aicTaskTimeSum.decimalPlaces(2).toString();
  const aicoreRateBigNumber = ((new BigNumber(aicTaskTimeSum)).dividedBy(new BigNumber(totalCnt * taskTime.value)));
  aicoreRate.value = aicoreRateBigNumber.times(100).decimalPlaces(2).toString();

  if (pmuTotal.value == undefined || Object.keys(pmuTotal.value).length == 0) {
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

  cubeTimePercentage.value = Math.floor(cubeTime / (cubeTime + vectorTime) * 100) + '%';
  vectorTimePercentage.value = String(100 - Math.floor(cubeTime / (cubeTime + vectorTime) * 100)) + '%';
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

  pmuRowCoordLoc.value = ['0%', '18%', '36%', '54%', '72%', '88%'];
  pmuBackLineLoc.value = ['20%', '40%', '60%', '80%'];
  pmuRowCoordList.value = ['0%', '20%', '40%', '60%', '80%', '100%'];
  pmuColCoordList.value = ['Vector Cycles', 'Cube Cycles', 'Scalar Cycles', 'MTE1 Cycles', 
                            'MTE2 Cycles', 'MTE3 Cycles'];
  if (isDarkTheme.value) {
    pmuBarColorList.value = ['rgba(135, 52, 0, 1)', 'rgba(181, 78, 4, 1)', 'rgba(3, 97, 66, 1)', 
                            'rgba(70, 94, 184, 1)', 'rgba(158, 63, 0, 1)', 'rgba(72, 142, 32, 1)'];
  } else {
    pmuBarColorList.value = ['rgba(255, 200, 201, 1)', 'rgba(255, 201, 138, 1)', 'rgba(0, 238, 237, 1)', 
                            'rgba(171, 217, 255, 1)', 'rgba(231, 216, 0, 1)', 'rgba(0, 242, 186, 1)'];
  }
  pmuChartDataLeft.value = [vectorRateCycle.value, cubeRateCycle.value, scalarRateCycle.value,
                            mte1RateCycle.value, mte2RateCycle.value, mte3RateCycle.value];
  pmuChartDataRight.value = [vectorRatePercentage.value, cubeRatePercentage.value, scalarRatePercentage.value,
                              mte1RatePercentage.value, mte2RatePercentage.value, mte3RatePercentage.value];
};

const exportSwimGraph = async () => {
  if (!timelineComponent?.value) return;
  isExporting.value = true;
  try {
    const dpr = window.devicePixelRatio || 1;
    const processLabelWidth = layout.processLabelWidth;
    const canvasCssWidth = viewState.canvasCssWidth;
    const totalWidth = processLabelWidth + canvasCssWidth;
    // 计算总高度
    const timelineEl = timelineComponent.value.$el;
    const timelineHeight = timelineEl ? timelineEl.offsetHeight : 40;
    let totalProcessHeight = 0;
    for (const [key, process] of processes) {
      totalProcessHeight += layout.processHeaderHeight;
      if (processExpanded.get(key)) {
        let processContentHeight = 0;
        for (const [threadKey, thread] of process.threads.entries()) {
          const tKey = thread.isCounter ? thread.threadName : thread.tid;
          processContentHeight += getThreadHeight(key, tKey, lane2line, layout, thread.isCounter);
        }
        totalProcessHeight += processContentHeight;
      }
      totalProcessHeight += layout.processMargin;
    }
    const totalHeight = timelineHeight + totalProcessHeight;

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // 背景
    ctx.fillStyle = isDarkTheme.value ? '#1F1F1F' : '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);
    // 绘制时间轴
    const fixedCanvas = timelineComponent.value.fixedtimelineCanvas;
    const scrollCanvas = timelineComponent.value.timelineCanvas;
    const flagsCanvas = timelineComponent.value.flagsCanvas;
    ctx.fillStyle = isDarkTheme.value ? '#2b2b2b' : '#f0f0f0';
    if (fixedCanvas) {
      // 绘制顶部固定时间轴
      ctx.fillRect(0, 0, processLabelWidth, (fixedCanvas.height / dpr) + (scrollCanvas.height / dpr)); 
      ctx.drawImage(fixedCanvas, processLabelWidth, 0, canvasCssWidth, fixedCanvas.height / dpr);
    }
    if (scrollCanvas) {
      const fixedHeight = fixedCanvas.height / dpr;
      // 绘制 fixedCanvas
      ctx.drawImage(fixedCanvas, processLabelWidth, 0, canvasCssWidth, fixedHeight);
      ctx.drawImage(scrollCanvas, processLabelWidth, fixedHeight, canvasCssWidth, scrollCanvas.height / dpr );
      ctx.drawImage(flagsCanvas, processLabelWidth, fixedHeight , canvasCssWidth, scrollCanvas.height / dpr );
    }
    let currentY = timelineHeight;
    const textColor = isDarkTheme.value ? '#e8e8e8' : '#333333';
    const lineColor = isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    ctx.font = '12px Arial';
    ctx.textBaseline = 'middle';
    for (const [key, process] of processes) {
      // 1. Process Header
      ctx.fillStyle = isDarkTheme.value ? '#2b2b2b' : '#f0f0f0';
      ctx.fillRect(0, currentY, totalWidth, layout.processHeaderHeight);
      ctx.fillStyle = textColor;
      ctx.fillText(process.processName, 10, currentY + layout.processHeaderHeight / 2);
      currentY += layout.processHeaderHeight;
      if (processExpanded.get(key)) {
        // 2. Process Body
        const eventCanvas = document.querySelector(`[data-process-key="${key}"]`);
        const bgCanvas = document.querySelector(`[data-background-process-key="${key}"]`);
        const depCanvas = document.querySelector(`[data-dep-process-key="${key}"]`);
        const selectionCanvas = document.querySelector(`[data-selection-process-key="${key}"]`);
        const uiCanvas = document.querySelector(`[data-ui-process-key="${key}"]`);
        const lineCanvas = document.querySelector(`[data-line-process-key="${key}"]`);
        const processHeaderCanvas = document.querySelector(`[data-process-header-key="${key}"]`);
        let processContentHeight = 0;
        for (const [threadKey, thread] of process.threads.entries()) {
          const tKey = thread.isCounter ? thread.threadName : thread.tid;
          processContentHeight += getThreadHeight(key, tKey, lane2line, layout, thread.isCounter);
        }
        // 绘制左侧 Thread Labels
        ctx.save();
        ctx.beginPath();
        // 绘制分割线
        ctx.moveTo(processLabelWidth, currentY);
        ctx.lineTo(processLabelWidth, currentY + processContentHeight);
        ctx.strokeStyle = lineColor;
        ctx.stroke();
        for (const [threadKey, thread] of process.threads.entries()) {
          const tKey = thread.isCounter ? thread.threadName : thread.tid;
          const tHeight = getThreadHeight(key, tKey, lane2line, layout, thread.isCounter);
          const tStartY = getThreadStartY(process, key, tKey, lane2line, layout);
          const labelY = currentY + tStartY;
          ctx.fillStyle = textColor;
          let labelText = thread.threadName || thread.tid;
          if (ctx.measureText(labelText).width > processLabelWidth - 20) {
            const widthPerChar = ctx.measureText(labelText).width / labelText.length;
            const maxChars = Math.floor((processLabelWidth - 20) / widthPerChar);
            labelText = labelText.substring(0, maxChars - 3) + '...';
          }
          ctx.fillText(labelText, 20, labelY + tHeight / 2);
          ctx.beginPath();
          ctx.moveTo(0, labelY + tHeight);
          ctx.lineTo(processLabelWidth, labelY + tHeight);
          ctx.strokeStyle = lineColor;
          ctx.stroke();
        }
        ctx.restore();
        // 绘制右侧 Canvas 内容
        if (bgCanvas) {
          ctx.drawImage(bgCanvas, processLabelWidth, currentY, canvasCssWidth, processContentHeight);
        }
        if (eventCanvas) {
          ctx.drawImage(eventCanvas, processLabelWidth, currentY, canvasCssWidth, processContentHeight);
        }
        if (depCanvas) {
          ctx.drawImage(depCanvas, processLabelWidth, currentY, canvasCssWidth, processContentHeight);
        }
        if(selectionCanvas){
          ctx.drawImage(selectionCanvas, processLabelWidth, currentY, canvasCssWidth, processContentHeight);
        }
        if(uiCanvas){
          ctx.drawImage(uiCanvas, processLabelWidth, currentY, canvasCssWidth, processContentHeight);
        }
        if(lineCanvas){
          ctx.drawImage(lineCanvas, processLabelWidth, currentY, canvasCssWidth, processContentHeight);
        }
        if (processHeaderCanvas) {
          const processHeaderCanvasHeight = processHeaderCanvas.height / dpr;
          ctx.drawImage(processHeaderCanvas, processLabelWidth, processHeaderCanvasHeight, canvasCssWidth, processHeaderCanvasHeight + 30);
        }
        currentY += processContentHeight;
      }
      currentY += layout.processMargin;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${fileName.value}.png` || 'swim-graph-export.png';
    link.href = dataUrl;
    link.click();
  } catch (error) {
    postMessage($t('swimExportErrorInfo'));
    console.error(error);
  } finally {
    isExporting.value = false;
  }
};
const pmuRowCoordList = ref([]);
const pmuColCoordList = ref([]);
const pmuRowCoordLoc = ref([]);
const pmuBarColorList = ref([]);
const pmuChartDataLeft = ref([]);
const pmuChartDataRight = ref([]);
const pmuBackLineLoc = ref([]);

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

provide('swimGraphPmuBarChartInfo', {pmuRowCoordList, pmuColCoordList, pmuRowCoordLoc, pmuBarColorList, pmuChartDataLeft, pmuChartDataRight, reportTitle, pmuBackLineLoc, isDarkTheme});


const onSearch = (e) => {
  if (currentResultIndex.value >= 1 && e.searchKey === searchedKey.value) {
    return;
  }
  e.category = e.selectedTags[0]?.field;
  searchedKey.value = e.searchKey;
  if (!(e.category) || e.category === '') {
    fuzzSearch(e.searchKey);
  } else {
    onSelectChange(e);
  }
};

const onSelectChange = (e) => {
  let { selectedTags } = e;
  selectedTagsRef.value = selectedTags;
  if (selectedTags.length === 0) {
    fuzzSearch(e.currentChangeTag?.value.value);
  } else if (selectedTags.length === 1) {
    const [tag] = selectedTags;
    searchBySingleHash(tag.field, tag.value.value);
  } else {
    const rootTag = selectedTags.find(tag => tag.field === 'Root');
    const leafTag = selectedTags.find(tag => tag.field === 'Leaf');
    if (rootTag && leafTag) {
      searchByComHash(rootTag.value.value, leafTag.value.value);
    }
  }
};

const onSearchKeyChange = (e) => {
  searchedKey.value = e;
};

const onClearAll = (e) => {
  searchedKey.value = '';
  resetsearchState();
};

const performSearch = (filterFn) => {
  searchResult.value = [];
  searchResultCount.value = 0;
  currentResultIndex.value = 0;
  for (const [processKey, process] of processes.entries()) {
    if (!processExpanded.get(processKey)) {
      continue; 
    }
    
    for (const [threadKey, thread] of process.threads.entries()) {
      for (const event of thread.events) {
        if (filterFn(event, thread, processKey)) {
          searchResult.value.push([event, thread.threadName, processKey]);
        }
      }
    }
  }
  if (!searchResult.value.length) {
    clearSearchData();
  }
  if (isMeasureModel.value) {
    measureModel();
  }
  searchResult.value.sort((a, b) => a[0].startTime - b[0].startTime);
  searchResultCount.value = searchResult.value.length;
  isSearchActive.value = true;
  if (searchResultCount.value > 0) {
    currentResultIndex.value += 1;
    const target = searchResult.value.at(currentResultIndex.value - 1);
    if (target) {
      selectEventChild(target.at(0));
      scrollToEvent(target.at(0));
    }
  }
};

const searchByComHash = (rootHash, leafHash) => {
  const rootRegex = new RegExp(`rootHash:(?<hash>\\d+)`);
  const leafRegex = new RegExp(`leafHash:(?<hash>\\d+)`);
  performSearch((event) => {
    const eventHint = event.args['event-hint'];
    if (!eventHint) {
      return false; 
    }
    const rootMatch = eventHint.match(rootRegex);
    const leafMatch = eventHint.match(leafRegex);
    if (!rootMatch || !leafMatch) {
      return false; 
    }
    const eventName = isCaseSensitive.value ? event.name : event.name.toLowerCase();
    const searchKey = searchedKey?.value;
    if (!searchKey) {
      return rootMatch.groups.hash.includes(rootHash) && leafMatch.groups.hash.includes(leafHash);
    }
    const searchKeyLower = searchKey.toLowerCase();
    const isMatch = eventName.includes(isCaseSensitive.value ? searchKey : searchKeyLower);
    return isMatch && rootMatch.groups.hash.includes(rootHash) && leafMatch.groups.hash.includes(leafHash);
  });
};

const searchBySingleHash = (hashCate, hash) => {
  const regex = new RegExp(`${hashCate.toLowerCase()}Hash:(?<hash>\\d+)`);
  performSearch((event) => {
    const eventHint = event.args['event-hint'];
    if (!eventHint) { 
      return false; 
    }
    const match = eventHint.match(regex);
    if (!match?.groups.hash) { 
      return false; 
    }
    const eventName = isCaseSensitive.value ? event.name : event.name.toLowerCase();
    const searchKey = searchedKey?.value;
    if (!searchKey) {
      return match.groups.hash.includes(hash);
    }
    const searchKeyLower = searchKey.toLowerCase();
    return eventName.includes(isCaseSensitive.value ? searchKey : searchKeyLower) && match.groups.hash.includes(hash);
  });
};

const fuzzSearch = (e) => {
  let searchKey = e;
  if (!searchKey || searchKey.trim() === '') {
    if (searchedKey.value) {
      searchKey = searchedKey.value;
    } else {
      resetsearchState();
      return;
    }
  }
  const searchKeyL = isCaseSensitive.value ? searchKey : searchKey.toLowerCase();
  performSearch((event) => {
    const eventName = isCaseSensitive.value ? event.name : event.name.toLowerCase();
    return eventName.includes(isCaseSensitive.value ? searchKey : searchKeyL);
  });
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
  currentResultIndex.value = 0;
  const icon = searchEl.value.$el.querySelector('.dp-category-search-icon');
  icon?.click();
};
// 导航搜索结果
const navigateResults = (direction) => {
  if (searchResultCount.value === 0) return;
  if (direction === 'prev') {
    currentResultIndex.value = currentResultIndex.value > 1 ? currentResultIndex.value - 1 : searchResultCount.value;
  } else if (direction === "next") {
    currentResultIndex.value = currentResultIndex.value < searchResultCount.value ? currentResultIndex.value + 1 : 1;
  }
  const target = searchResult.value.at(currentResultIndex.value - 1);
  selectEventChild(target.at(0));
  scrollToEvent(target.at(0));
};

const selectEventChild = (event) => {
  searchedEvent.value = event;
  selectedEvent.value = null;
  detailsPanelExpanded.value = false;
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

const isThreeColumnSearchActive = () => {
  threeColumnSearchVisible.value = !threeColumnSearchVisible.value;
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
const leftmove = (step=30, forceTransform=false) => {
  if (viewState.scale === 1 && !forceTransform) {
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

const rightmove = (step=30, forceTransform=false) => {
  if (viewState.scale === 1 && !forceTransform) {
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

const ShortcutKeyShow = () => {
  isShortcutKeyShow.value = !isShortcutKeyShow.value;
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

const isCfgDisabled = computed(() => {
  for (const process of processes.values()) {
    for (const thread of process.threads.values()) {
        for (const event of thread.events) {
            if (!event.isCounter && !(event.leafIndex)) {
                return true;
            }
        }
    }
  }
  return false;
});

const handleClickOutsize = (event) => {
  if (!event || !event.target) {
    return;
  }
  const container = document.querySelector('.zoom-controls');
  const flagsCanvas = document.querySelector('.flags-canvas');
  const eventsCanvas = document.querySelector('.events-canvas');
  const searchFocus = event.target.innerHTML.includes('Hash') || event.target.className === 'devui-input__inner' || searchedKey.value !== '' || selectedTagsRef.value.length > 0;
  if (!container || !flagsCanvas || !eventsCanvas) {
    return;
  }
  if (isSearchActive.value && (flagsCanvas.contains(event.target) || eventsCanvas.contains(event.target))) {
    resetsearchState();
  }
  if (isSwimGraphActive.value && (!container.contains(event.target) && !searchFocus)) {
    threeColumnSearchVisible.value = false;
  }
};

const resetsearchState = () => {
  searchResultCount.value = 0;
  currentResultIndex.value = 0;
  isSearchActive.value = false;
  detailsPanelExpanded.value = false;
  searchedEvent.value = null;
  clearSearchData();
};

const getTooltipContent = () => {
  if (isLockStatus.value) {
    return $t('interlockModeSearchTip');
  } else {
    return $t('pathwayLockTip');
  }
};

const isThreeColumnHeader =() => {
  if (!isThreeColumn) {
    threeColumnHeaderVisible.value = true;
  } else {
    if (isSwimGraphActive.value) {
      threeColumnHeaderVisible.value = true;
    } else {
      threeColumnHeaderVisible.value = false;
    }
  }
};

watch(isDarkTheme, () => {
  updateTheme();
});
watch(isLockStatus, () => {
  if (!isLockStatus.value && !searchQuery.value) {
    return;
  }
  searchQuery.value = '';
  searchResultCount.value = 0;
  currentResultIndex.value = 0;
  isSearchActive.value = false;
  detailsPanelExpanded.value = false;
  sendMsg('clearSearchEvent');
});
watch(isPathLockStatus, () => {
  if (!isPathLockStatus.value && !searchQuery.value) {
    return;
  }
  searchQuery.value = '';
  searchResultCount.value = 0;
  currentResultIndex.value = 0;
  isSearchActive.value = false;
  searchedEvent.value = null;
  detailsPanelExpanded.value = false;
});
watch(isSwimGraphActive, () => {
  isThreeColumnHeader();
  if (isSwimGraphActive.value) {
    threeColumnSearchVisible.value = false;
  } else {
    threeColumnSearchVisible.value = true;
  }
});
watch(searchEl, () => {
  if (searchEl.value) {
    const inputEl = searchEl.value.$el.querySelector('.dp-category-search-toggle');
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isSearchActive.value) {
          navigateResults('next');
        }
      } else if (e.key === 'Escape') {
        resetsearchState();
      }
    }, true);
  }
});
const updateTheme = () => {
  backgroundColor.value = isDarkTheme.value ? `#606061` : `rgba(0, 0, 0, 0)`;
  document.documentElement.style.setProperty('--backgroundcolor', `${backgroundColor.value}`);
};
const sendMsg = (command, param) => {
  Promise.resolve().then(() => {
    window.ascEventBus.emit(command, param);
  });
};
const postMessage = (message) => {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'showMessage', paramObj: { text: message } });
  }
};
onMounted(() => {
  updateTheme();
  document.addEventListener('click', handleClickOutsize);
  isThreeColumnHeader();
  zoomControl.value = isThreeColumn.value ? 'zoom-controls-three' : 'zoom-controls';
});

defineExpose({
  leftmove,
  rightmove,
  closeDrawer
})
</script>

<style lang="scss">
@import url("../css/swimGraph/Header/header.css");
.swim-search {
  height: 28px;
  width: 320px;
  .devui-search__icon {
    width: 20px !important;
    height: 20px !important;
    margin: 4px 4px 4px 8px;
  }

  &.devui-search:not(.devui-search--error):not(.devui-search--disabled):not(.devui-search--glow-style):hover .devui-input {
    border-color: var(--devui-select-hover-border-color);
  }

  &.devui-search.devui-search--focus .devui-input {
    border-color: var(--devui-select-active-border-color);
  }

  &.devui-search.devui-search--focus:not(.devui-search--error):not(.devui-search--disabled)::not(.devui-search--glow-style):hover .devui-input {
    border-color: var(--devui-select-active-border-color);
  }

  .devui-input {
    height: 28px !important;
    padding-left: 32px !important;
    padding-right: 44px !important;
    background: var(--devui-input-bg) !important;
    border-color: transparent;
    .devui-input__wrapper {
      background: none;

      input {
        margin-top: 3px;
        height: 20px;
        font-size: 13px;
        font-weight: 400;
        line-height: 20px;
      }
    }
  }
}

.cfg-button.devui-button {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background-color: var(--devui-secondary-button-bg);
  box-shadow: var(--devui-tips-shadow);
  cursor: pointer;
  .button-content {
    color: var(--devui-overlay-icon);
    top: 3px;
  }
  &.devui-button--outline--secondary:disabled {
    color: var(--devui-disabled-icon);
    border: var(--devui-secondary-button-border);
    background-color: var(--devui-secondary-button-disabled-bg);
    svg {
      path {
        stroke: var(--devui-disabled-icon) !important;
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
  margin-left: 0px  !important;
}
#swim-header-decrease{
  padding: 3px 0 ;
  margin-left: 4px;
}
#swim-header-increase {
  padding: 3px 0 ;
}
</style>
<style scoped lang="scss">
:deep() {
  .swim-search.dp-category-search-container {
    height: 28px;
    width: 420px;
    border: 1px solid transparent;
    background: var(--devui-category-search-bg);
  }

  .swim-search.dp-category-search-container:focus-within {
    border: 1px solid var(--devui-select-active-border-color);
  }

  .swim-search.container-hover {
    border: 1px solid var(--devui-select-hover-border-color);
  }

  .swim-search.dp-category-search-container {
    .dp-category-search-extended-container {
      border-left-color: transparent;
      padding-left: 28px;
      .dp-category-search-icon {
        padding-right: 0px;
      }
    }

    .dp-category-search-line-container {
      height: 26px;
      .dp-category-search-toggle {
        height: 28px;
        font-size: 13px;
        &::placeholder {
          color: var(--devui-category-search-placeholder);
        }
      }
      &:hover {
        overflow-y: hidden;
      }
    }
  }
}
</style>