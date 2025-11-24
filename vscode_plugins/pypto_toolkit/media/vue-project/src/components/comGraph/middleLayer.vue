<script setup lang="ts">
import { onMounted, ref, watch, toRef, computed, shallowRef } from 'vue';
import ComGraph from '../../components/comGraph/comGraph.vue';
import DiffComGraph from '../../components/diffComGraph/diffComGraph.vue';
import ErrorView from '../../components/comGraph/error.vue';
import SearchEntry from '../../components/comGraph/searchEntry.vue';
import SearchMode from '../../components/comGraph/searchMode.vue';
import SimpleComGraph from '../../components/comGraph/simpleComGraph.vue';
import ThreeColumn from '../../components/threeColumn/threeColumn.vue';
import { comGraphStore } from '../../service/com-graph-store';
import { useTheme } from '../../theme/use-theme';
import { useViewServer } from '../../core/use-view-server';
import SwimGraph from '../../components/swimGraph/swimGraphComplete.vue';
import { pushState } from '../../core/state';

import { ICommonViewServer } from 'ext:/view/servers/view-server-interface';
const jsonContent = ref({});
const errorMessage = ref('');
const loadingStep = ref('');
const searchMode = ref(0);
const subGraphType = ref('');
const outputDirPath = ref('');
const passIndex = ref('');
const pathName = ref('');
const fileName = ref('');
const diffInfo = ref({});
const openMode = ref('all');
const nodeMagic = ref(0);
const { updateTheme } = useTheme();
const comLoadFlag = ref(false);
const swimLoadFlag = ref(false);
const disabledSearchMode = computed(() => !(Object.keys(jsonContent.value).length));
let inThreeColumnMode = false;

//
const props = defineProps({
  graphType: {
    type: String,
  },
});
const graphType = toRef(props, 'graphType');
const { server } = useViewServer<ICommonViewServer>();

// 控制需要哪些监听器
if (graphType.value === 'computeGraph' || graphType.value === 'diffGraph' || graphType.value === 'threeColumnGraph') {
  setupComWatchers(server);
}
if (graphType.value === 'threeColumnGraph') {
  setupThreeWatchers(server);
}

if (graphType.value === 'swimGraph') {
  setupSwimWatchers(server);
}

function setupComWatchers(server: any) {
  watch(server.IDETheme, (newValue) => {
    updateTheme(newValue.data);
  });
  watch(server.ErrorMessage, (newValue) => {
    errorMessage.value = newValue.data;
  });
  watch(server.ReadJsonWarning, (newValue) => {
    if (!inThreeColumnMode) {
      loadingStep.value = 'readJsonWarning';
      searchMode.value = 1;
    }
  });

  watch(server.ComData, (newValue) => {

    jsonContent.value = newValue.data;
    loadingStep.value = newValue.step;
    outputDirPath.value = newValue.outputDirPath;
    passIndex.value = newValue.passIndex;
    pathName.value = newValue.pathName;
    fileName.value = newValue.fileName;
  });
  watch(server.DiffComData, (newValue) => {
    diffInfo.value = newValue.diffInfo;
    loadingStep.value = newValue.step;
  });

  watch(server.InitComGraph, (newValue) => {
    loadingStep.value = newValue.step;
    dealConfig(newValue.configration);
  });

  watch(server.InitDiffComGraph, (newValue) => {
    comGraphStore.setData('isDiffGraph', true);
    loadingStep.value = newValue.step;
  });

  watch(server.CalleeMap, (newValue) => {
    comGraphStore.setData('calleeMap', newValue.data);
  });

  watch(server.CalleeOpAttrMap, (newValue) => {
    comGraphStore.setData('CalleeOpAttrMap', newValue.data);
  });

  watch(server.PathNodesSet, (newValue) => {
    const nodesSet = new Set(newValue.data);
    comGraphStore.setData('pathNodesSet', nodesSet);
  });

  watch(server.SetThreeColumnMode, () => {
    inThreeColumnMode = true;
  });
  watch(server.JsonContent, (newValue) => {
    jsonContent.value = newValue.data;
  });
  watch(server.InitData, (newValue) => {
    pushState({
      fsPath: newValue.fsPath,
      funcHash: newValue.funcHash,
      magicName: newValue.magicName,
      outputDirPath: newValue.outputDirPath,
      pathName: newValue.pathName,
    });
  });
}

function setupThreeWatchers(server: any) {
  watch(server.InitFlag, async () => {
    comLoadFlag.value = true;
    swimLoadFlag.value = true;
    await server.getInitialData();
    server.returnFuncTree();
  });
  watch(server.SetThreeColumnMode, () => {
    inThreeColumnMode = true;
  });
}

function setupSwimWatchers(server: any) {
  watch(server.returnSwim, (newValue) => {
    jsonContent.value = newValue.data;
  });
  watch(server.returnTheme, (newValue) => {
    updateTheme(newValue.data);
  });
}

onMounted(async () => {
  if (graphType.value === 'computeGraph' || graphType.value === 'diffGraph') {
    await server.getInitialData();
  }
  if (graphType.value === 'swimGraph') {
    await server.getInitialData();
  }
  if (graphType.value === 'threeColumnGraph') {
    await server.pageInit();
  }
  (window as any).ascEventBus.on('comGraphRendering', (args) => {
    loadingStep.value = args;
  });
  (window as any).ascEventBus.on('searchNode', searchNodeListener);
});

const searchNodeListener = (args) => {
  openMode.value = 'path';
  nodeMagic.value = args;
  loadingStep.value = 'convertData';
};

function dealConfig(config) {
  if (!config) {
    return;
  }

  if (config.tensorAttr) {
    comGraphStore.setData('tensorAttrFunc', eval(config.tensorAttr));
  }

  if (config.tensorColor) {
    comGraphStore.setData('tensorColorFunc', eval(config.tensorColor));
  }

  if (config.operationAttr) {
    comGraphStore.setData('operationAttrFunc', eval(config.operationAttr));
  }

  if (config.operationColor) {
    comGraphStore.setData('operationColorFunc', eval(config.operationColor));
  }
}

function onFullRender() {
  if (Object.keys(jsonContent.value).length) {
    loadingStep.value = 'convertData';
  } else {
    loadingStep.value = 'readJson';
  }
  graphType.value = 'computeGraph';
  searchMode.value = 0;
}


</script>

<template>
  <template v-if="errorMessage !== ''">
    <ErrorView :jsonContent="errorMessage" />
  </template>
  <template v-else>
    <ThreeColumn v-if="graphType === 'threeColumnGraph'">
      <template #comGraph>
        <d-skeleton v-if="!comLoadFlag">
        </d-skeleton>
        <SimpleComGraph v-if="comLoadFlag" :jsonContent="jsonContent" :loadingStep="loadingStep" />
      </template>
      <template #swimGraph>
        <d-skeleton v-if="!swimLoadFlag">

        </d-skeleton>
        <SwimGraph v-if="swimLoadFlag" style="height: 100%" :is-three-column="true" :graphType="graphType" />
      </template>
    </ThreeColumn>
    <ComGraph v-if="graphType === 'computeGraph' && searchMode == 0" :outputDirPath="outputDirPath"
      :jsonContent="jsonContent" :loadingStep="loadingStep" :openMode="openMode" :nodeMagic="nodeMagic"
      :pass-index="passIndex" :path-name="pathName" :file-name="fileName" />
    <DiffComGraph v-if="graphType === 'diffGraph'" :afterJson="diffInfo.afterJson" :afterFileName="diffInfo.afterFileName"
      :beforeJson="diffInfo.beforeJson" :beforeFileName="diffInfo.beforeFileName" :loadingStep="loadingStep" />
    <SearchEntry v-if="graphType === 'computeGraph' && searchMode === 1" :disabled-search-mode="disabledSearchMode"
      @full-render="onFullRender" @search-mode="() => (searchMode = 2)" />
    <SearchMode v-if="graphType === 'computeGraph' && searchMode === 2" :jsonContent="jsonContent"
      @searchMode="searchMode = 0" />
    <SwimGraph v-if="graphType === 'swimGraph'" :is-three-column="false" />
  </template>
</template>
<style scoped>
.parent-container {
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
}
</style>
<style lang="scss">
header {
  min-width: 960px;

  &.com-graph-with-navbar {
    min-width: 1076px;
  }
}
</style>