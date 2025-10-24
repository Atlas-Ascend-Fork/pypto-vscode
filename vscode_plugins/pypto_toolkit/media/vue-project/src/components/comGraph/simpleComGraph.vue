<template>
  <div class="simple-com-graph-container">
    <ComGraphHeader
      :class="[comGraphStore.data.comGraphConfig.showExtendBtn && 'with-extend-btn']"
      @onLocate="onLocate"
      :graph-type="graphType"
      :openMode="props.openMode"
    ></ComGraphHeader>
    <d-select v-model="rootHash" :options="rootHashList" :placeholder="t('comGraph.pleaseSelect')" class="simple-com-root-hash-list"></d-select>
    <div
      :style="{
        backgroundImage: 'url(' + svgPath + ')',
        backgroundRepeat: 'repeat',
        height: '100%',
      }"
    >
      <div id="sprotty"></div>
    </div>
    <ComGraphMinimap v-if="!isLoading"></ComGraphMinimap>
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, defineProps, ref, inject, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphHeader from './comGraphHeader.vue';
import ComGraphMinimap from './comGraphMinimap.vue';
import Loading from './loading.vue';
import { comGraphStore } from '../../service/com-graph-store';

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
const rootHashList = ref([]);
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
let centerNodeAction;
let selectAction;
let createSelectNodesRect;

window.addEventListener('message', (event) => {
  if (event.data.type === 'postLayoutResult') {
    isLoading.value = false;
    loadingText.value = '';
  }
});

(window as any).ascEventBus.on('returnSematicLabelFromCode', (args) => {
  createSelectNodesRect(args.label);
});
(window as any).ascEventBus.on('returnSematicLabelFromSwim', (args) => {
  createSelectNodesRect(args.label);
  rootHashList.value = args.rootHashList;
  rootHash.value = rootHashList.value[0];
});
(window as any).ascEventBus.on('rect_node_hover', (args) => {
  (window as any).ascEventBus.emit('returnSematicLabelFromCom', { label: args.semanticLabel, rootHash: rootHash.value })
})

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
      const sprottyLoadResult = useSprottyLoad();
      sprottyLoadResult.initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic);
      centerNodeAction = sprottyLoadResult.centerNodeAction;
      selectAction = sprottyLoadResult.selectAction;
      createSelectNodesRect = sprottyLoadResult.createSelectNodesRect;
      comGraphStore.setData('jsonData', jsonValue);
      comGraphStore.setData('comGraphConfig', {
        isSimple: true,
        isHoverHighlightNode: false,
        showExtendBtn: false,
        canLockPath: false,
        canViewNodeDetail: false,
        canViewSubgraph: false,
      });
    }
  },
  { immediate: true },
);

onMounted(() => {
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
    }
  }

  .simple-com-root-hash-list {
    position: absolute;
    left: 16px;
    top: 52px;
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
</style>
