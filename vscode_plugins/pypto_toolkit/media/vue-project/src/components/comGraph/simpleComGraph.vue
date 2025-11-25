<template>
  <div :class="['simple-com-graph-container', isComGraphActive && 'show-sticky-block']">
    <div class="sticky-block">
      <d-select
        ref="rootHashEl"
        v-model="rootHash"
        :options="rootHashList"
        :placeholder="t('comGraph.pleaseSelect')"
        :position="['bottom-start']"
        :class="['simple-com-root-hash-list', isLoading && 'not-allow-expand']"
        :menu-class="`simple-com-root-hash-list-menu ${!isComGraphActive ? 'hide-root-hash-list' : ''}`"
        @value-change="onHashChange"
        @toggle-change="onHashMenuToggleChange"
      >
        <template #empty>
          <div class="simple-com-root-hash-empty">{{ t('comGraph.noData') }}</div>
        </template>
      </d-select>

      <DragIcon />

      <div class="sticky-block-right">
        <i v-show="!isExpandSearch" class="icon-search-new" @click="() => (isExpandSearch = true)"></i>
        <ComGraphHeader
          ref="comGraphHeaderEl"
          v-show="isExpandSearch"
          :class="[comGraphStore.data.comGraphConfig.showExtendBtn && 'with-extend-btn']"
          @onLocate="onLocate"
          :openMode="props.openMode"
        ></ComGraphHeader>
        <i :class="[isComGraphFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']" @click="() => onToggleComGraphFullscreen()"></i>
      </div>
    </div>
    <div
      :style="{
        backgroundImage: 'url(' + svgPath + ')',
        backgroundRepeat: 'repeat',
        height: '100%',
      }"
    >
      <div id="sprotty"></div>
    </div>
    <NodeDetail v-model="showNodeDetail" :node-id="nodeId" :json-content="props.jsonContent" :height="containerHeight" />
    <ComGraphMinimap ref="minimapEl" v-if="!isLoading" :width="200" :height="124"></ComGraphMinimap>
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, defineProps, ref, inject, computed, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphHeader from './comGraphHeader.vue';
import ComGraphMinimap from './comGraphMinimap.vue';
import Loading from './loading.vue';
import { comGraphStore } from '../../service/com-graph-store';
import NodeDetail from './nodeDetail/nodeDetail.vue';
import { debounce } from 'lodash-es';
import { ThreeColumnProvideKey, type IThreeColumnCtx } from '../threeColumn/types';
import DragIcon from '../threeColumn/drag-icon.vue';
import { useViewServer } from '../../core/use-view-server';
import type { IComViewServer } from '../../../../../src/core/view/view-server-interface';

const { t } = useI18n();
const props = defineProps({
  jsonContent: {
    type: Object,
    default: {},
  },
  loadingStep: {
    type: String,
    default: '',
  },
  openMode: {
    type: String,
    default: 'all',
  },
  nodeMagic: {
    type: Number,
    default: -1,
  },
});

const { isDarkTheme } = inject('root');
const { isComGraphFullscreen, currentActiveBlock, BlockToGraphMap, onToggleComGraphFullscreen } = inject(
  ThreeColumnProvideKey,
) as IThreeColumnCtx;
const { server } = useViewServer<IComViewServer>();
const isLoading = ref(false);
const loadingText = ref('');
const warningText = ref('');
const graphType = ref('');
const rootHash = ref('');
const rootHashList = ref<Record<'name' | 'value', string>[]>([]);
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
let centerNodeAction;
let selectAction;
let hoverFeedbackAction;
let createSelectNodesRect;
let removeSelectNodesRect;
let initComDocText;
let resetModelSource;
let fitToScreenAction;
const showNodeDetail = ref(false);
const nodeId = ref('');
const containerHeight = ref(0);
const isExpandSearch = ref(false);
const comGraphHeaderEl = ref();
const rootHashEl = ref();
const isComGraphActive = ref(false);
const minimapEl = ref();

watch(currentActiveBlock, (val) => {
  if (val) {
    isComGraphActive.value = BlockToGraphMap[val] === 'comGraph';
    if (!isComGraphActive.value) {
      isExpandSearch.value = false;
      comGraphHeaderEl.value.hideDropdown();
      rootHashEl.value.toggleChange(false);
    }
  }
});

window.addEventListener('message', (event) => {
  if (event.data.type === 'postLayoutResult') {
    isLoading.value = false;
    loadingText.value = '';
  }
});

(window as any).ascEventBus.on('returnSemanticLabelFromCode', (args) => {
  if (!args.label) {
    removeSelectNodesRect?.();
  }
});

// 规避锁定时泳道图发送消息，重新创建框选时，框选消失的问题
let prevent = false;
let currentLockLabel: string = '';
function onMessageFromSwim(args) {
  if (prevent) {
    prevent = false;
    return;
  }
  if (args.label) {
    createSelectNodesRect(args.label, true);
  } else {
    removeSelectNodesRect();
  }
  if (args.rootHashList?.length) {
    if (comGraphStore.data.curPath.length) {
      rootHash.value = comGraphStore.data.curPath[comGraphStore.data.curPath.length - 1];
    }
    if (
      comGraphStore.data.isNodeRectLock &&
      !args.rootHashList.includes(comGraphStore.data.curPath[comGraphStore.data.curPath.length - 1])
    ) {
      onHashChange({ name: comGraphStore.data.calleeMap[rootHash.value].func_magicname, value: rootHash.value });
    }
  }
}
(window as any).ascEventBus.on('returnSemanticLabelFromSwimToCom', debounce(onMessageFromSwim, 100));
(window as any).ascEventBus.on('returnSemanticLabelFromSwim', debounce(onMessageFromSwim, 100));

(window as any).ascEventBus.on('rect_node_hover', (args) => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  if (args.semanticLabel) {
    createSelectNodesRect(args.semanticLabel, false);
    (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label: args.semanticLabel, rootHash: rootHash.value });
  }
});
(window as any).ascEventBus.on('rect_node_leave', () => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  removeSelectNodesRect();
  (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label: '' });
});

(window as any).ascEventBus.on('activeLock', (args) => {
  prevent = true;
  currentLockLabel = args.label;
  comGraphStore.data.isNodeRectLock = true;
  createSelectNodesRect(args.label, true);
  hoverFeedbackAction();
});
(window as any).ascEventBus.on('sendHashList', (args) => {
  generateHashList(args.rootHashList ?? []);
  const currentHash = comGraphStore.data.curPath[comGraphStore.data.curPath.length - 1];
  if (rootHashList.value.every((item) => item.value !== currentHash)) {
    rootHashList.value.unshift({ name: comGraphStore.data.calleeMap[currentHash].func_magicname, value: currentHash });
  }
});
(window as any).ascEventBus.on('deactivateLock', () => {
  prevent = false;
  comGraphStore.data.isNodeRectLock = false;
  hoverFeedbackAction();
  generateHashList();
});
(window as any).ascEventBus.on('threeColumnSizeChange', ({ comGraphVisible }) => {
  if (comGraphVisible) {
    window.dispatchEvent(new Event('resize'));
    minimapEl.value.updateScaleRation();
    const fitTimer = setTimeout(() => {
      fitToScreenAction();
      fitTimer && clearTimeout(fitTimer);
    });
  }
});

function onLockClick() {
  comGraphStore.data.isNodeRectLock = !comGraphStore.data.isNodeRectLock;
  if (comGraphStore.data.isNodeRectLock) {
    (window as any).ascEventBus.emit('activeLock', { label: comGraphStore.data.selectedNodeSemanticLabel });
  } else {
    (window as any).ascEventBus.emit('deactivateLock');
  }
  comGraphStore.data.stableRect = false;
}

function generateHashList(hashList?: string[]) {
  rootHashList.value = [];
  if (hashList) {
    for (const item of hashList) {
      rootHashList.value.push({ name: comGraphStore.data.calleeMap[item].func_magicname, value: item });
    }
  } else {
    const tempHashList = Object.keys(comGraphStore.data.calleeMap);
    for (let i = 0; i < tempHashList.length; i++) {
      const item = tempHashList[i];
      rootHashList.value.push({ name: comGraphStore.data.calleeMap[item].func_magicname, value: item });
    }
  }
}

function onHashMenuToggleChange() {
  nextTick(() => {
    const menuList = document.querySelectorAll('.simple-com-root-hash-list-menu li');
    for (let i = 0; i < menuList.length; i++) {
      const item = menuList[i] as HTMLElement;
      item.setAttribute('title', item.innerText);
    }
  });
}

const onHashChange = (val) => {
  server.innerGetSubgraph({paramObj: { calleehash: val.value, subFuncmagicname: val.name}});
};

const onLocate = (id) => {
  centerNodeAction([id]);
  selectAction([id]);
};

const LoadingStatusMap = {
  readJson: 'comGraph.readJson',
  convertData: 'comGraph.convertData',
  readJsonWarning: 'comGraph.readJsonWarning',
  rendering: 'comGraph.rendering',
};

watch(rootHash, () => {
  nextTick(() => {
    const inputDom = document.querySelector('.simple-com-root-hash-list input') as HTMLInputElement | null;
    if (inputDom) {
      inputDom.setAttribute('title', inputDom.value);
    }
  });
});

watch(
  () => props.loadingStep,
  (val) => {
    if (val === 'readJson' || val === 'rendering' || val === 'convertData') {
      isLoading.value = true;
    }
    if (val === 'readJsonWarning') {
      isLoading.value = true;
      loadingText.value = t(LoadingStatusMap['readJson']);
      warningText.value = t(LoadingStatusMap[val]);
    } else {
      loadingText.value = t(LoadingStatusMap[val]);
    }
  },
);

watch(
  [() => props.jsonContent, isDarkTheme],
  ([val]) => {
    if (Object.keys(val).length) {
      graphType.value = typeof val.graphtype !== 'undefined' ? String(val.graphtype) : '';
      const jsonValue = JSON.parse(JSON.stringify(props.jsonContent));
      if (initComDocText) {
        initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic);
        comGraphStore.setData('jsonData', jsonValue);
        resetModelSource();
        server.returnFuncTree();
        let shouldListenViewZoom = true;
        if (comGraphStore.data.isNodeRectLock && currentLockLabel) {
          (window as any).ascEventBus.on(`_view_zoom`, () => {
            if (shouldListenViewZoom) {
              comGraphStore.data.selectedNodeSemanticLabel = '';
              createSelectNodesRect(currentLockLabel, true);
              shouldListenViewZoom = false;
            }
          });
        }
        return;
      }
      const sprottyLoadResult = useSprottyLoad();
      initComDocText = sprottyLoadResult.initComDocText;
      initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic);
      centerNodeAction = sprottyLoadResult.centerNodeAction;
      selectAction = sprottyLoadResult.selectAction;
      createSelectNodesRect = sprottyLoadResult.createSelectNodesRect;
      removeSelectNodesRect = sprottyLoadResult.removeSelectNodesRect;
      hoverFeedbackAction = sprottyLoadResult.hoverFeedbackAction;
      resetModelSource = sprottyLoadResult.resetModelSource;
      fitToScreenAction = sprottyLoadResult.fitToScreenAction;
      comGraphStore.setData('jsonData', jsonValue);
      comGraphStore.setData('comGraphConfig', {
        isSimple: true,
        isHoverHighlightNode: false,
        showExtendBtn: false,
        canLockPath: false,
        canViewNodeDetail: true,
        canViewSubgraph: false,
      });
      generateHashList();
      if (comGraphStore.data.curPath.length) {
        rootHash.value = comGraphStore.data.curPath[comGraphStore.data.curPath.length - 1];
      }
    }
  },
  { immediate: true },
);

function onDocumentClick(e: MouseEvent) {
  const composedPath = e.composedPath();
  const index = composedPath.findIndex(
    (item: HTMLElement) =>
      item.classList?.contains('com-graph-header') ||
      item.classList?.contains('dp-category-search-dropdown') ||
      item.classList?.contains('com-graph-header-search-dropdown') ||
      item.classList?.contains('com-graph-global-select') ||
      item.classList?.contains('icon-search-new'),
  );
  if (index !== -1) {
    return;
  }
  isExpandSearch.value = false;
}

onMounted(() => {
  (window as any).ascEventBus.on('view_mouseup', (node) => {
    if (node.type === 'graph' || node.id.startsWith('parent')) {
      showNodeDetail.value = false;
    } else if (node.id.endsWith('label-main')) {
      nodeId.value = node.id;
      const container = document.querySelector('.simple-com-graph-container');
      containerHeight.value = container.getBoundingClientRect().height;
      showNodeDetail.value = true;
    }
  });
  (window as any).ascEventBus.on('layoutEnding', (args) => {
    isLoading.value = false;
    loadingText.value = '';
  });
  if (props.loadingStep === 'readJson' || props.loadingStep === 'convertData') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
  document.addEventListener('click', onDocumentClick);
  (window as any).ascEventBus.on('lockToggleChange', onLockClick)
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  (window as any).ascEventBus.remove('lockToggleChange', onLockClick)
});
</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.simple-com-graph-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--devui-global-bg);

  &.show-sticky-block {
    .sticky-block {
      display: flex;
    }
  }

  .sticky-block {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 15;
    display: none;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 40px;
    padding: 4px 16px;
    border-bottom: 1px solid var(--devui-split-line);
    background-color: var(--devui-card-bg);
    box-sizing: border-box;
  }

  .sticky-block-right {
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      font-size: 14px;
      cursor: pointer;
    }
  }

  .com-graph-header {
    height: 30px;

    &.with-extend-btn {
      height: 150px;
    }

    .toolbar-row {
      left: 0;
    }

    .module-toolbar-container {
      padding: 0;
    }

    .module-row {
      display: none;
    }
  }

  .simple-com-root-hash-list {
    width: 140px;

    .devui-select__input {
      height: 28px;
    }

    &.not-allow-expand {
      pointer-events: none;
    }
  }

  #sprotty {
    height: 100%;
  }
}

.devui-loading {
  .devui-loading__area {
    display: flex;
    align-items: center;
  }
}

.simple-com-root-hash-empty {
  padding: 4px 0;
  text-align: center;
  color: var(--devui-placeholder-text);
}

.simple-com-root-hash-list-menu {
  width: 300px !important;

  &.hide-root-hash-list {
    display: none !important;
  }
}
</style>
