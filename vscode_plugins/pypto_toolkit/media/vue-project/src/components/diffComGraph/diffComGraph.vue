<template>
  <div class="diff-com-graph">
    <div class="diff-com-graph-header">
      <d-checkbox v-model="syncOperate" :label="t('syncOperate')" :is-show-title="false" @change="onSyncOperateChange" />
      <DiffLayout :layout="currentLayout" @layout-change="onLayoutChange" />
    </div>
    <div class="diff-container" style="height: calc(100% - 40px)">
      <DiffList v-if="showDiffList" :list="diffList" @click="onDiffItemClick" @expand-change="onExpandChange" />
      <div :class="['diff-wrap', `diff-layout-${currentLayout}`]">
        <div class="diff-before-wrap" :style="{ backgroundImage: 'url(' + svgPath + ')' }">
          <DiffHeader :file-name="beforeFileName" />
          <div id="sprotty-before"></div>
          <MiniMap
            ref="beforeMinimapEl"
            type="before"
            @mousedown="() => (isDragging = true)"
            @mousemove="(e) => onMinimapMove(e, 'before')"
            @mouseup="() => (isDragging = false)"
          />
        </div>
        <div class="diff-after-wrap" :style="{ backgroundImage: 'url(' + svgPath + ')' }">
          <DiffHeader :file-name="realAfterFileName" />
          <SelectFile v-if="showSelectFile && !isLoading" @change="renderGraph" />
          <div id="sprotty-after"></div>
          <MiniMap
            ref="afterMinimapEl"
            type="after"
            @mousedown="() => (isDragging = true)"
            @mousemove="(e) => onMinimapMove(e, 'after')"
            @mouseup="() => (isDragging = false)"
          />
        </div>
        <Loading v-if="isLoading" :loadingText="loadingText" />
      </div>
    </div>
    <ShowTip></ShowTip>
    <DiffModal :diff-detail="diffDetail" />
  </div>
</template>

<script setup lang="ts">
import { watch, computed, inject, ref, onBeforeMount, onMounted, Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSprottyLoad } from '../../sprotty-graph/main';
import DiffHeader from './diffHeader.vue';
import DiffLayout from './diffLayout.vue';
import SelectFile from './select-file.vue';
import Loading from '../comGraph/loading.vue';
import type { SelectFileChangeEventParam, TDiffLayout } from './type';
import { compareJsonData } from '../../utils';
import MiniMap from '../comGraph/comGraphMinimap.vue';
import DiffList from './diffList.vue';
import type { DiffListItem } from './type';
import { Message } from 'vue-devui/message';
import ShowTip from '../util/showTip.vue';
import { useViewServer } from '../../core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import DiffModal from './diffModal.vue';

const { server } = useViewServer<IComViewServer>();
const props = defineProps({
  afterJson: Object,
  afterFileName: String,
  beforeJson: Object,
  beforeFileName: String,
  loadingStep: { type: String, default: '' },
});
const { isDarkTheme } = inject('root') as { isDarkTheme: Ref<boolean> };
const { t } = useI18n();
const svgPath = computed(() => `"${(window as any).staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
const syncOperate = ref(true);
const isLoading = ref(false);
const showSelectFile = ref(false);
const loadingText = ref('');
const realAfterFileName = ref('');
const beforeMinimapEl = ref();
const afterMinimapEl = ref();
const diffList = ref<DiffListItem[]>([]);
const showDiffList = ref(false);
const currentLayout = ref<TDiffLayout>('horizontal');
const diffDetail = ref([]);
let beforeIns;
let afterIns;
let expandTimer: ReturnType<typeof setTimeout>;

function onLayoutChange(e) {
  currentLayout.value = e;
  const resizeTimer = setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    beforeMinimapEl.value.updateScaleRation();
    afterMinimapEl.value.updateScaleRation();
    resizeTimer && clearTimeout(resizeTimer);
  });
  const fitTimer = setTimeout(() => {
    beforeIns.fitToScreenAction();
    afterIns.fitToScreenAction();
    fitTimer && clearTimeout(fitTimer);
  });
}

const renderGraph = (e: SelectFileChangeEventParam) => {
  realAfterFileName.value = e.fileName;
  showSelectFile.value = false;
  const { diffList: list, diffDetail: detail, showDiffList: showDiff } = compareJsonData(props.beforeJson!, e.fileContent);
  diffDetail.value = detail;
  diffList.value = list as any;
  showDiffList.value = showDiff;
  const jsonValue = JSON.parse(JSON.stringify(props.beforeJson));
  beforeIns = useSprottyLoad(`sprotty-before`, 'before');
  beforeIns.initComDocText(jsonValue, isDarkTheme.value);
  afterIns = useSprottyLoad(`sprotty-after`, 'after');
  afterIns.initComDocText(e.fileContent, isDarkTheme.value);
};

const onExpandChange = () => {
  expandTimer = setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    clearTimeout(expandTimer);
  }, 300);
};

const onDiffItemClick = (data: DiffListItem) => {
  isBothSelected = data.changeType === 'change';
  if (data.changeType === 'add' || data.changeType === 'change') {
    afterIns.centerNodeAction([data.nodeId]);
    afterIns.selectAction([data.nodeId]);
  }
  if (data.changeType === 'delete' || data.changeType === 'change') {
    beforeIns.centerNodeAction([data.nodeId]);
    beforeIns.selectAction([data.nodeId]);
  }
};

const LoadingStatusMap = {
  readJson: 'comGraph.readJson',
  convertData: 'comGraph.convertData',
  rendering: 'comGraph.rendering',
};
watch(
  () => props.loadingStep,
  (val) => {
    if (val === 'rendering' || val === 'convertData') {
      isLoading.value = true;
    }
    loadingText.value = t(LoadingStatusMap[val]);
  },
);

watch([() => props.afterJson, () => props.beforeJson], () => {
  if (props.beforeJson && props.afterJson) {
    const { diffList: list, diffDetail: detail, showDiffList: showDiff } = compareJsonData(props.beforeJson, props.afterJson);
    diffDetail.value = detail;
    diffList.value = list as any;
    showDiffList.value = showDiff;
  }
  if (props.beforeJson) {
    const jsonValue = JSON.parse(JSON.stringify(props.beforeJson));
    beforeIns = useSprottyLoad(`sprotty-before`, 'before');
    beforeIns.initComDocText(jsonValue, isDarkTheme.value);
  }
  if (props.afterJson) {
    const jsonValue = JSON.parse(JSON.stringify(props.afterJson));
    realAfterFileName.value = props.afterFileName || '';
    afterIns = useSprottyLoad(`sprotty-after`, 'after');
    afterIns.initComDocText(jsonValue, isDarkTheme.value);
  }
  showSelectFile.value = !realAfterFileName.value;
});

let isDragging: boolean = false;
let beforeCurrentX;
let beforeCurrentY;
let afterCurrentX;
let afterCurrentY;
let isBothSelected: boolean = false; // 是否before和after均有节点选中
function onSyncOperateChange(e) {
  if (e) {
    afterIns?.fitToScreenAction();
    beforeIns?.fitToScreenAction();
  }
}
function onMinimapMove(args, type: 'before' | 'after') {
  onMouseMove([args[0], args[1], args[2], type]);
}
function onMouseMove(args) {
  if (syncOperate.value && isDragging) {
    let x = args[0];
    let y = args[1];
    if (isBothSelected) {
      if (args[3] === 'after') {
        x = beforeCurrentX + (args[0] - afterCurrentX);
        y = beforeCurrentY + (args[1] - afterCurrentY);
      }
      if (args[3] === 'before') {
        x = afterCurrentX + (args[0] - beforeCurrentX);
        y = afterCurrentY + (args[1] - beforeCurrentY);
      }
    }
    if (args[3] === 'after') {
      beforeIns?.syncDiffView([x, y, args[2]]);
      beforeMinimapEl.value?.updateRectPosition([x, y]);
    }
    if (args[3] === 'before') {
      afterIns?.syncDiffView([x, y, args[2]]);
      afterMinimapEl.value?.updateRectPosition([x, y]);
    }
  }
}
function onMouseup() {
  isDragging = false;
  beforeIns?.updateDiffViewport();
  afterIns?.updateDiffViewport();
}

function onZoomChange(args) {
  if (syncOperate.value) {
    if (isBothSelected) {
      if (args[4] === 'after') {
        args[1] = beforeCurrentX + (args[1] - afterCurrentX);
        args[2] = beforeCurrentY + (args[2] - afterCurrentY);
      }
      if (args[4] === 'before') {
        args[1] = afterCurrentX + (args[1] - beforeCurrentX);
        args[2] = afterCurrentY + (args[2] - beforeCurrentY);
      }
    }
    if (args[4] === 'after') {
      beforeIns?.syncDiffView([args[1], args[2], args[0]]);
      beforeMinimapEl.value?.syncZoomChange(args);
    }
    if (args[4] === 'before') {
      afterIns?.syncDiffView([args[1], args[2], args[0]]);
      afterMinimapEl.value?.syncZoomChange(args);
    }
  }
}
let preventZoonChange = false; // 点击小地图加减号缩放时，是否阻止xx_view_zoom事件回调
function onMinimapWheel(args) {
  if (syncOperate.value && isBothSelected) {
    preventZoonChange = true;
    if (args[3] === 'after') {
      const offsetX = args[1] - afterCurrentX;
      const offsetY = args[2] - afterCurrentY;
      afterCurrentX = args[1];
      afterCurrentY = args[2];
      args[1] = beforeCurrentX + offsetX;
      args[2] = beforeCurrentY + offsetY;
      beforeCurrentX = args[1];
      beforeCurrentY = args[2];
      beforeIns?.syncDiffView([args[1], args[2], args[0]]);
      beforeMinimapEl.value?.syncZoomChange(args);
    }
    if (args[3] === 'before') {
      const offsetX = args[1] - beforeCurrentX;
      const offsetY = args[2] - beforeCurrentY;
      beforeCurrentX = args[1];
      beforeCurrentY = args[2];
      args[1] = afterCurrentX + offsetX;
      args[2] = afterCurrentY + offsetY;
      afterCurrentX = args[1];
      afterCurrentY = args[2];
      afterIns?.syncDiffView([args[1], args[2], args[0]]);
      afterMinimapEl.value?.syncZoomChange(args);
    }
  }
}
function onAfterMinimapZoomChange(args) {
  if (preventZoonChange) {
    preventZoonChange = false;
    return;
  }
  afterCurrentX = args[1];
  afterCurrentY = args[2];
  if (beforeMinimapEl.value.getCurrentScale() === args[0]) {
    return;
  }
  if (syncOperate.value) {
    beforeIns?.syncDiffView([args[1], args[2], args[0]]);
    beforeMinimapEl.value?.syncZoomChange(args);
  }
}
function onBeforeMinimapZoomChange(args) {
  if (preventZoonChange) {
    preventZoonChange = false;
    return;
  }
  beforeCurrentX = args[1];
  beforeCurrentY = args[2];
  if (afterMinimapEl.value.getCurrentScale() === args[0]) {
    return;
  }
  if (syncOperate.value) {
    afterIns?.syncDiffView([args[1], args[2], args[0]]);
    afterMinimapEl.value?.syncZoomChange(args);
  }
}

function onDocumentMouseUp() {
  isDragging = false;
}
function onMouseleave() {
  if (!isDragging) {
    return;
  }
  document.addEventListener('mouseup', onDocumentMouseUp);
}
function onMouseover() {
  document.removeEventListener('mouseup', onDocumentMouseUp);
}

function onSelectedNodeChange(args) {
  isBothSelected = false;
  if (syncOperate.value) {
    if (args[1] === 'after') {
      beforeIns?.selectAction(args[0] ? [args[0].id] : []);
      if (args[0] && args[0].compareType !== 'add' && args[0].compareType !== 'delete') {
        isBothSelected = true;
        beforeIns?.centerNodeAction([args[0].id], undefined, undefined, beforeMinimapEl.value.getCurrentScale());
      }
    }
    if (args[1] === 'before') {
      afterIns?.selectAction(args[0] ? [args[0].id] : []);
      if (args[0] && args[0].compareType !== 'add' && args[0].compareType !== 'delete') {
        isBothSelected = true;
        args[0] && afterIns?.centerNodeAction([args[0].id], undefined, undefined, afterMinimapEl.value.getCurrentScale());
      }
    }
  }
}

onBeforeMount(() => {
  (window as any).ascEventBus.on('view_mousedown', () => (isDragging = true));
  (window as any).ascEventBus.on('view_mousemove', onMouseMove);
  (window as any).ascEventBus.on('view_mouseup', onMouseup);
  (window as any).ascEventBus.on('view_mouseleave', onMouseleave);
  (window as any).ascEventBus.on('view_mouseover', onMouseover);
  (window as any).ascEventBus.on('view_zoom', onZoomChange);
  (window as any).ascEventBus.on(`after_view_zoom`, onAfterMinimapZoomChange);
  (window as any).ascEventBus.on(`before_view_zoom`, onBeforeMinimapZoomChange);
  (window as any).ascEventBus.on('selected_node_change', onSelectedNodeChange);
  (window as any).ascEventBus.on('minimap-wheel', onMinimapWheel);
  watch(server.LayoutResult, (newValue) => {
    isLoading.value = false;
    loadingText.value = '';
  });

  (window as any).ascEventBus.on('message_notice', (tips) => {
    if (tips === 'compareLargerTips') {
      syncOperate.value = false;
    }
    Message({
      type: 'warning',
      message: t(tips),
    });
  });
  (window as any).ascEventBus.on('layoutEnding', (args) => {
    isLoading.value = false;
    loadingText.value = '';
  });
});
onMounted(() => {
  if (props.loadingStep === 'readJson') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
});
</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.diff-com-graph {
  width: 100%;
  height: 100vh;
  position: relative;

  .diff-com-graph-header {
    display: flex;
    gap: 16px;
    width: 100%;
    height: 40px;
    padding: 6px 16px;
    border-bottom: 1px solid var(--devui-split-line);
    box-sizing: border-box;
  }

  .diff-container {
    display: flex;
  }

  .diff-wrap {
    position: relative;
    display: flex;
    flex: 1;
    height: 100%;

    &.diff-layout-vertical {
      flex-direction: column;

      .diff-before-wrap {
        border-right: none;
        border-bottom: 1px solid var(--devui-split-line);
      }
    }

    .diff-after-wrap,
    .diff-before-wrap {
      flex: 1;
      position: relative;
      height: 100%;
      background-repeat: repeat;
      box-sizing: border-box;
    }

    .diff-before-wrap {
      border-right: 1px solid var(--devui-split-line);
    }

    #sprotty-after,
    #sprotty-before {
      height: 100%;
    }
  }
}
</style>
