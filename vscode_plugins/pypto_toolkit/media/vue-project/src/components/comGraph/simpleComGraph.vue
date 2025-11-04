<template>
  <div class="simple-com-graph-container">
    <ComGraphHeader
      :class="[comGraphStore.data.comGraphConfig.showExtendBtn && 'with-extend-btn']"
      @onLocate="onLocate"
      :openMode="props.openMode"
    ></ComGraphHeader>
    <d-select
      v-model="rootHash"
      :options="rootHashList"
      :placeholder="t('comGraph.pleaseSelect')"
      :position="['bottom-start']"
      class="simple-com-root-hash-list"
      menu-class="simple-com-root-hash-list-menu"
      @value-change="onHashChange"
      @toggle-change="onHashMenuToggleChange"
    >
      <template #empty>
        <div class="simple-com-root-hash-empty">{{ t('comGraph.noData') }}</div>
      </template>
    </d-select>
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
    <ComGraphMinimap v-if="!isLoading" :width="200" :height="124"></ComGraphMinimap>
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, defineProps, ref, inject, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphHeader from './comGraphHeader.vue';
import ComGraphMinimap from './comGraphMinimap.vue';
import Loading from './loading.vue';
import { comGraphStore } from '../../service/com-graph-store';
import { vscode } from '../../core/vscode';
import NodeDetail from './nodeDetail/nodeDetail.vue';

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
const showNodeDetail = ref(false);
const nodeId = ref('');
const containerHeight = ref(0);

window.addEventListener('message', (event) => {
  if (event.data.type === 'postLayoutResult') {
    isLoading.value = false;
    loadingText.value = '';
  }
});

(window as any).ascEventBus.on('returnSemanticLabelFromCode', (args) => {
  if (!args.label) {
    removeSelectNodesRect();
    lockIcon?.removeEventListener('click', onLockClick);
  }
});

// 规避锁定时泳道图发送消息，重新创建框选时，框选消失的问题
let prevent = false;
let hashListFromSwim;
function onMessageFromSwim(args) {
  if (prevent) {
    prevent = false;
    return;
  }
  createSelectNodesRect(args.label, false);
  listenLockClick();
  if (args.rootHashList?.length) {
    if (comGraphStore.data.curPath.length) {
      rootHash.value = comGraphStore.data.curPath[comGraphStore.data.curPath.length - 1];
    }
    hashListFromSwim = args.rootHashList;
    generateHashList(false);
    if (
      comGraphStore.data.isNodeRectLock &&
      !args.rootHashList.includes(comGraphStore.data.curPath[comGraphStore.data.curPath.length - 1])
    ) {
      onHashChange({ name: comGraphStore.data.calleeMap[rootHash.value].func_magicname, value: rootHash.value });
    }
  }
}
(window as any).ascEventBus.on('returnSemanticLabelFromSwimToCom', onMessageFromSwim);
(window as any).ascEventBus.on('returnSemanticLabelFromSwim', onMessageFromSwim);

(window as any).ascEventBus.on('rect_node_hover', (args) => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  if (args.semanticLabel) {
    createSelectNodesRect(args.semanticLabel, false);
    listenLockClick();
    (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label: args.semanticLabel, rootHash: rootHash.value });
  }
});
(window as any).ascEventBus.on('rect_node_leave', () => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  removeSelectNodesRect();
  lockIcon?.removeEventListener('click', onLockClick);
  (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label: '' });
});

(window as any).ascEventBus.on('activeLock', (args) => {
  prevent = true;
  comGraphStore.data.isNodeRectLock = true;
  createSelectNodesRect(args.label, true);
  hoverFeedbackAction();
  generateHashList(true);
  const currentHash = comGraphStore.data.curPath[comGraphStore.data.curPath.length - 1];
  if (rootHashList.value.every((item) => item.value !== currentHash)) {
    rootHashList.value.unshift({ name: comGraphStore.data.calleeMap[currentHash].func_magicname, value: currentHash });
  }
});
(window as any).ascEventBus.on('deactivateLock', () => {
  comGraphStore.data.isNodeRectLock = false;
  hoverFeedbackAction();
  generateHashList(false);
});

let timer: ReturnType<typeof setTimeout>;
let lockIcon: HTMLElement | null;
function onLockClick() {
  comGraphStore.data.isNodeRectLock = !comGraphStore.data.isNodeRectLock;
  if (comGraphStore.data.isNodeRectLock) {
    (window as any).ascEventBus.emit('activeLock', { label: comGraphStore.data.selectedNodeSemanticLabel });
  } else {
    (window as any).ascEventBus.emit('deactivateLock');
  }
}
function listenLockClick() {
  timer = setTimeout(() => {
    lockIcon = document.querySelector('#show_node_rect_lock');
    if (lockIcon) {
      lockIcon.addEventListener('click', onLockClick);
    }
    if (timer) {
      clearTimeout(timer);
    }
  }, 50);
}

function generateHashList(isLock: boolean) {
  rootHashList.value = [];
  if (isLock) {
    for (const item of hashListFromSwim) {
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
  vscode.value.postMessage({
    command: 'innerGetSubgraph',
    paramObj: { calleehash: val.value, subFuncmagicname: val.name },
  });
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
    if (val === 'rendering' || val === 'convertData') {
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
        (window as any).vscode.postMessage({
          type: 'getFuncTree',
        });
        let shouldListenViewZoom = true;
        if (comGraphStore.data.isNodeRectLock && comGraphStore.data.selectedNodeSemanticLabel) {
          (window as any).ascEventBus.on(`_view_zoom`, () => {
            if (shouldListenViewZoom) {
              const tempLabel = comGraphStore.data.selectedNodeSemanticLabel;
              comGraphStore.data.selectedNodeSemanticLabel = '';
              createSelectNodesRect(tempLabel);
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
      comGraphStore.setData('jsonData', jsonValue);
      comGraphStore.setData('comGraphConfig', {
        isSimple: true,
        isHoverHighlightNode: false,
        showExtendBtn: false,
        canLockPath: false,
        canViewNodeDetail: true,
        canViewSubgraph: false,
      });
    }
  },
  { immediate: true },
);

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
});
</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.simple-com-graph-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--devui-global-bg);

  .com-graph-header {
    position: absolute;
    height: 82px;
    width: 100%;
    top: 0;
    z-index: 10;

    &.with-extend-btn {
      height: 150px;
    }

    .toolbar-row {
      left: calc(100% - 485px);
      margin-top: 16px;
    }

    .module-row {
      display: none;
    }
  }

  .simple-com-root-hash-list {
    position: absolute;
    left: 16px;
    top: 16px;
    z-index: 12;
    width: 140px;
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
}
</style>
