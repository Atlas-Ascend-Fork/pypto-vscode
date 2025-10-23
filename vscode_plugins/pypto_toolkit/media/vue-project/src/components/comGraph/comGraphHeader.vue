<template>
  <div class="com-graph-header">
    <div v-if="comGraphStore.data.comGraphConfig.showExtendBtn" class="corner-container">
      <d-tooltip :content="t('healthReport')" :mouse-enter-delay="100" position="left" overlay-class="corner-tips">
        <div class="corner-icon-container" @click="openHealthReport">
          <d-icon name="icon-line-chart" class="corner-icon" size="16px"></d-icon>
        </div>
      </d-tooltip>
      <!-- <d-tooltip :content="t('comGraph.operationLog')" :mouse-enter-delay="100"  position="left" overlay-class="corner-tips">
        <div class="corner-icon-container">
          <d-icon name="icon-operation-log" class="corner-icon" size="16px"></d-icon>
        </div>
      </d-tooltip> -->
      <d-tooltip :content="t('comGraph.layerControl')" :mouse-enter-delay="100"  position="left" overlay-class="corner-tips">
        <div class="corner-icon-container" @click="changeLayer">
          <LayerControlIcon :active="Boolean(comGraphCtx?.showLayerControl)" />
        </div>
      </d-tooltip>
      <d-tooltip :content="t('comGraph.openDiffViewer')" :mouse-enter-delay="100"  position="left" overlay-class="corner-tips">
        <div class="corner-icon-container" @click="openDiffViewer">
          <d-icon name="icon-operation-log" class="corner-icon" size="16px"></d-icon>
        </div>
      </d-tooltip>
    </div>

    <div class="module-row" ref="module_row">
      <div class="arrow-container">
        <d-icon name="icon-arrow-left-l" class="module-icon" size="16px" @click="backwards"></d-icon>
      </div>
      <div class="navigation" ref="navigation">
        <span v-for="(it, index) in curPath.slice(0, -1)" :key="index">{{displayNav(it, index)}}</span>
        <d-dropdown 
        class="navigation-dropdown"
        trigger="manually" 
        :visible="isNavVisible" 
        :position="['bottom-start']" 
        @toggle="(val) => isNavVisible = val"
        >
          <span @click="() => isNavVisible = true" class="layer-cur">{{funcMap[curPath[curPath.length - 1]]?.func_magicname}} </span>
          <template #menu>
            <div v-if="isPathExist" class="layer-list">
              <div v-for="(it, index) in curList" :key="index" 
                class="layer-item"
                :class="{'active': it == curPath[curPath.length - 1]} "
                @click="onJump(it)">
                  {{funcMap[it]?.func_magicname}}
              </div>
            </div>
          </template>
        </d-dropdown>
      </div>
      <div class="module-row-center-container"></div>
      <div v-if="graphType" :class="['module-row-graph-type', GraphType[graphType]]">{{ GraphType[graphType] }}</div>
    </div>

    <div 
      class="toolbar-row"
      :class="{ 'search-focusd': isSearchFocus}"
      :style="{width: 402 + selectWidth + 'px'}"
     >
      <d-select
        menu-class="globalSelect"
        :options="allOptions"
        v-model="currentSelect"
        :placeholder="t('comGraph.currentGraph')"
        class="select-options"
        :style="{width:selectWidth + 'px'}"
        @click="onSelectClick"
        />
      <d-dropdown 
        class="search-dropdown" 
        overlay-class="searchResultDown"
        trigger="manually" 
        :visible="isVisible"
        :position="['bottom-start']"
        @toggle="(val) => isVisible = val"
      >
        <d-category-search
          ref="searchEl"
          :category="category"
          :text-config="textConfig"
          :show-search-category="searchConfig"
          :extend-config="{show:true, clear: { show: false}, save: {show: false}, more: {show: false}}"
          :placeholder="t('comGraph.searchPlaceholder')"
          :class="['category-search', isSearchFocus && 'search-focus']"
          :style="{
            '--hide-icon': showSearchIcon ? 1 : 0,
            'left': selectWidth + 'px'
          }"
          @search="onSearch"
          @click="onCategoryClick"
          @selectedTagsChange="onSelectedChange"
        >
          <template #operation>
            <div
              class="rect-upper-lower has-tooltip"
              :class="{active: upperActive}"
              @mousedown.prevent
              @click="upperSearch"
              v-if="showOperation">
              <svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor">
                <path d="M339.62496 186.78272H249.8816L4.26496 834.56H97.3824l62.75584-177.46432h269.90592L496.84992 834.56h93.11744L339.62496 186.78272z m-155.19744 396.76416L292.39296 269.1072h1.35168l107.96032 314.43968H184.42752zM927.21664 584.35584c-4.32128 8.09984-17.67424 15.25248-40.07936 21.45792-22.4 6.20544-54.38464 10.65984-95.9488 13.35808-42.6496 4.85376-74.22464 14.84288-94.74048 29.96224s-29.96224 34.816-28.3392 59.1104c3.23584 46.41792 38.05696 69.63712 104.448 69.63712 93.93152-6.4768 145.4848-50.74432 154.65984-132.79744v-60.72832z m-315.79136-97.97632c21.59104-93.93152 90.14272-139.27424 205.66528-136.03328 62.08512-1.61792 107.96544 12.416 137.65632 42.10688 29.69088 29.69088 43.72992 74.76736 42.10688 135.22432v187.04896c-1.61792 25.36448-0.13312 46.82752 4.4544 64.36864 4.58752 17.54112 11.4688 31.70816 20.64896 42.51136h-66.40128c-7.55712-7.55712-13.09184-16.8704-16.59904-27.93472-3.5072-11.06944-5.25824-22.8096-5.25824-35.2256-37.79584 50.74432-97.97632 76.11392-180.57216 76.11392-96.62464-3.24096-148.17792-43.1872-154.65984-119.8336 1.62304-44.80512 16.06144-79.62624 43.32544-104.45824 27.25888-24.832 68.68992-39.67488 124.288-44.53376 44.26752-4.85376 79.89248-9.85088 106.88512-14.976 26.98752-5.13536 45.07648-11.74528 54.25152-19.84 3.24096-42.64448-4.58752-73.68704-23.48032-93.12256-18.88768-19.4304-48.85504-28.3392-89.8816-26.72128-39.94624-1.61792-71.53152 5.39648-94.73536 21.05344-23.2192 15.65696-36.98176 40.21248-41.29792 73.68192l-66.39616-19.4304z" p-id="5425"></path>
              </svg>
              <span class="tooltip tooltip-upper">{{ t('comGraph.caseSensitive') }}</span>
            </div>
            <div
              class="rect-reg has-tooltip"
              :class="{active: regActive}"
              @click="regSearch"
              @mousedown.prevent
              v-if="showOperation">
                <svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor">
                  <path d="M136 836.928c0-32.896 25.088-60.608 58.112-60.608 34.304 0 59.392 27.776 59.392 60.608 0 35.712-25.088 59.456-59.392 59.456-36.992-1.344-58.112-26.432-58.112-59.456zM903.808 398.336l-214.912 42.112 150.336 188.032-92.928 64-120.64-207.744L503.68 692.48l-92.992-64 149.568-188.032-216.32-42.112 37.76-104.576 204.8 78.464-19.648-237.44h116.928l-20.352 237.44 204.8-78.464 35.584 104.576z" p-id="6435"></path>
                </svg>
                <span class="tooltip tooltip-reg">{{t('comGraph.useRegExp')}}</span>
            </div>
          </template>
        </d-category-search>
        <template #menu>
          <ul class="search-res-list">
            <div class="res-size">
              <span class="res-size-text">
                {{ t('comGraph.searchResSize', {resSize}) }}
              </span>
            </div>
            <div v-for="(it, index) in res" :key="index" 
              class="res-it"
              @click="onLocate(it)">
              <div class="res-it-text" :title="displayResIt(it)">
                {{displayResIt(it)}}
                <div v-if="it.funcHash && it.funcHash !== currentFuncHash" class="icon-jump-to res-it-icon" />
              </div>
            </div>
          </ul>
        </template>
      </d-dropdown>
    </div>

    <div class="control-flow" v-if="ctrl_flow.hasDynamic">
      <div class="control-flow-itername control-flow-base" :title="`itername: ${ctrl_flow.itername}`">
        itername: {{ctrl_flow.itername}}
      </div>
      <div class="control-flow-begin control-flow-base" :title="`begin: ${ctrl_flow.begin}`">
        begin: {{ctrl_flow.begin}}
      </div>
      <div class="control-flow-end control-flow-base" :title="`end: ${ctrl_flow.end}`">
        end: {{ctrl_flow.end}}
      </div>
      <div class="control-flow-step control-flow-base" :title="`step: ${ctrl_flow.step}`">
        step: {{ctrl_flow.step}}
      </div>
      <div class="control-flow-coretype control-flow-base" :title="`coretype: ${ctrl_flow.coretype}`">
        coretype: {{ctrl_flow.coretype}}
      </div>
      <div class="control-flow-magic-name control-flow-base" :title="`magic_name: ${ctrl_flow.magic_name}`">
        magic_name: {{ctrl_flow.magic_name}}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineEmits, inject, onMounted, reactive, watch} from 'vue';
import { useI18n } from 'vue-i18n';
import { GraphType } from './type';
import type { ComGraphContext } from './type';
import { comGraphStore } from '../../service/com-graph-store';
import { getCurFunctionDynamicAttr } from '../../sprotty-graph/parseSymbolicAttr';
import { getTextWidth } from '../../utils/index';
import { useHeader } from './hooks/use-header';
import LayerControlIcon from './layerControl/layerControlIcon.vue';
import { extractIncasts,
  extractOutcasts,
  extractRawTensors,
  extractTensorNodes,
  extractOperationNodes,
  searchFuzzy,
  extractFuncMap,
  searchByTensorMagic,
  searchByTensorSemanticLabel,
  searchByRawTensorMagic,
  searchBySubgraphid,
  searchByOperationMagic } from '../../utils/search';

const props = defineProps({
  showType: {
    type: String,
    default: 'all'
  },
  openMode: {
    type: String,
    default: 'all'
  },
  graphType: { type: String },
})

let funcTree = {}

const backwards = () => {
  if(curPath.value.length === 1) {
    return;
  }
  const newPath = [...curPath.value.slice(0, -1)];
  const lastHash = newPath[newPath.length - 1];
  jumpSubgraph(lastHash, funcMap.value[lastHash].func_magicname, JSON.stringify(newPath));
}

//Get same layer hash List
function getLayerList(curPath, funcTree) {
  let curNode = funcTree;
  for (let i = 0; i < curPath.length - 1; i++) {
    const key = curPath[i];
    if (curNode[key] === undefined) {
      //not found
      return [];
    }
    curNode = curNode[key];
  }
  return Object.keys(curNode);
}


const { t } = useI18n();
const comGraphCtx = inject('comGraph', undefined) as ComGraphContext | undefined;
const searchEl = ref();
let passName = 'Loading';
let curPath = ref([]);
let curList = ref(getLayerList(curPath.value, funcTree));
let module_row = ref();
let navFlag = ref(0);
let showSearchIcon = ref(1);
let showOperation = ref(false);

 const categoryCurrent = [
      {
        label: 'Rawtensor',
        field: 'Rawtensor',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'magic' }
        ],
      },
      {
        label: 'Tensor',
        field: 'Tensor',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'magic' },
          { Option: 'semantic_label' }
        ],
      },
      {
        label: 'Operation',
        field: 'Operation',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'magic' }
        ],
      },
      {
        label: 'Subgraph',
        field: 'Subgraph',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'id' }
        ],
      },
];

 const categoryGlobal = [
      {
        label: 'Rawtensor',
        field: 'Rawtensor',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'magic' }
        ],
      },
      {
        label: 'Tensor',
        field: 'Tensor',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'magic' },
          { Option: 'semantic_label' }
        ],
      },
      {
        label: 'Operation',
        field: 'Operation',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'magic' }
        ],
      },
      {
        label: 'Subgraph',
        field: 'Subgraph',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'id' }
        ],
      },
      {
        label: 'Function',
        field: 'Function',
        type: 'radio',
        group: 'Basic',
        filterKey: 'Option',
        options: [
          { Option: 'hash' },
          { Option: 'name' },
        ],
      }, 
];

const category = ref(categoryCurrent);

const searchOptions = [
  {name: t('comGraph.currentGraph'), value: 'current'},
  {name: t('comGraph.globalGraph'), value: 'global'},
];

const curSearchOptions = [
  {name: t('comGraph.onlyPath'), value: 'currentPath'},
];

const currentSelect = ref('current');
const allOptions = ref(comGraphStore.data.comGraphConfig.isSimple ? [searchOptions[0]] : searchOptions);
const selectWidth = ref(getTextWidth(allOptions.value[0].name, 13) + 28);
const textConfig = {
  keywordName: t('comGraph.keyword')
}
const searchConfig = {
  keywordDescription: (key: string) => t('comGraph.keywordDesc', { key }),
  fieldDescription: (label: string) => t('comGraph.fieldDesc', { label }),
  categoryDescription: t('comGraph.categoryDesc')
}

const dyn = {};
const ctrl_flow = ref(dyn);

let currentFuncHash = "0";
let isVisible = ref(false);
let isNavVisible = ref(false);
let tensorMap = {};
let opMap = {};
let rawTensorMap = {};
let funcMap = ref({});
let res = ref([]);
let totalSize = ref(0);
let resSize = ref(0);
let entry = ref('0');
let hasSearched = false;
let searchTimer: number | null = null;
let isSelectedMagic = false;
const isSearchFocus = ref(false);
const isPathExist = ref(false);
const upperActive = ref(false);
const regActive = ref(false);

const { onCategoryClick, onSelectedTagsChange, onSelectClick } = useHeader(isVisible);

watch(currentSelect, (newVal) => {
  if (newVal === 'global') {
    category.value = categoryGlobal;
  } else {
    category.value = categoryCurrent;
  }
  onSelectedTagsChange({ selectedTags: [] });
});

const onSelectedChange = (e) => {
  onSelectedTagsChange(e);
  let category = e.selectedTags[0]?.field;
  let option = e.selectedTags[0]?.value?.Option;
  if (category && category != 'Function' && option) {
    isSelectedMagic = true;
    controlOperation(false);
  } else {
    isSelectedMagic = false;
  }
}


function controlOperation(isShow) {
  if (isShow && !isSelectedMagic) {
    showOperation.value = true;
    showSearchIcon.value = 0;
  } else {
    showOperation.value = false;
    showSearchIcon.value = 1;
  }
}

// parse input data
function selfControlSearch(isUpper = false, isReg = false) {
  const input = searchEl.value.$el.querySelector('.dp-category-search-toggle');
  const keyword = input?.value.trim() ?? '';
  const tags = Array.from(
    searchEl.value.$el.querySelectorAll('.devui-tag__item')
  ).map(el => {
    const [c, o] = el.textContent.trim().split(':').map(s => s.trim());
    return {category: c, option: o || null};
  });

  let searchData : any = {};
  if (tags.length >= 1) {
    if (tags[0].category != '关键字') {
      searchData.category = tags[0].category;
      searchData.option = tags[0].option;
    } else {
      searchData.category = undefined;
      searchData.option = undefined;
      searchData.searchKey = tags[0].option;
    }
  }
  if (tags.length == 2) {
    searchData.searchKey = tags[1].option;
  }
  if (keyword) {
    searchData.searchKey = keyword;
  }
  searchData.isUpper = upperActive.value;
  searchData.isReg = regActive.value;
  searchData.isSearchData = true;
  onSearch(searchData);
}

function upperSearch() {
  upperActive.value = !upperActive.value;
  regActive.value = false;
  const icon = searchEl.value.$el.querySelector('.dp-category-search-icon') as HTMLElement;
  icon?.click();
}

function regSearch() {
  regActive.value = !regActive.value;
  upperActive.value = false;
  const icon = searchEl.value.$el.querySelector('.dp-category-search-icon') as HTMLElement;
  icon?.click();
}

const onSearch = (e) => {
  //防抖
  if (hasSearched) return;
  hasSearched = true;
  searchTimer = window.setTimeout(() => {
    hasSearched = false;
  }, 200);
  e.category = e.selectedTags[0]?.field;
  e.option = e.selectedTags[0]?.value?.Option;
  e.isUpper = upperActive.value;
  e.isReg = regActive.value;
  isVisible.value = Boolean(e.searchKey);
  if (isVisible.value) {
    showOperation.value = true;
    showSearchIcon.value = 0;
  }
  if (currentSelect.value === 'global') {
    globalSearch(e);
    return;
  }
  if (!(e.category) || e.category === '') {
    res.value = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap.value, e.searchKey, '', e.isUpper, e.isReg);
  } else {
    let isFuzz = false;
    if (!e.option) {
      isFuzz = true;
    }
    switch (e.category) {
      case "Function":
        res.value = [];
        break;
      case "Tensor":
        if (isFuzz) {
          res.value = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap.value, e.searchKey, 'Tensor', e.isUpper, e.isReg);
        } else if (e.option == 'magic') {
          res.value = searchByTensorMagic(tensorMap, e.searchKey);
        } else if (e.option == 'semantic_label') {
          res.value = searchByTensorSemanticLabel(tensorMap, e.searchKey);
        }
        break;
      case "Rawtensor":
        if (isFuzz) {
          res.value = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap.value, e.searchKey, 'Rawtensor', e.isUpper, e.isReg);
        } else if (e.option == 'magic') {
          res.value = searchByRawTensorMagic(tensorMap, e.searchKey);
        }
        break;
      case "Subgraph":
        if (isFuzz) {
          res.value = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap.value, e.searchKey, 'Subgraph', e.isUpper, e.isReg);
        } else if (e.option == 'id') {
          res.value = searchBySubgraphid(tensorMap, opMap, e.searchKey);
        }
        break;
      case "Operation":
        if (isFuzz) {
          res.value = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap.value, e.searchKey, 'Operation', e.isUpper, e.isReg);
        } else if (e.option == 'magic') {
          res.value = searchByOperationMagic(opMap, e.searchKey);
        }
        break;
    }
  }
  filterSearchResult(res.value);
  resSize.value = res.value.length;
}

function filterSearchResult(result: any) {
  if (props.openMode == 'path' && comGraphStore.data.pathNodesSet.size > 0) {
    for (let i = result.length - 1; i >= 0; i--) {
      const obj = result[i];
      if (obj.node_type == 'operation' && !comGraphStore.data.pathNodesSet.has(obj.opmagic.toString())) {
        result.splice(i, 1);
      }
      if (obj.node_type == 'tensor' && !comGraphStore.data.pathNodesSet.has(obj.magic.toString())) {
        result.splice(i, 1);
      }
    }
    return;
  }
  if (currentSelect.value != 'currentPath') {
    return;
  }
  const traceTensor = comGraphStore.data.traceTensors[1];
  const traceOperations = comGraphStore.data.traceOperations[1];
  for (let i = result.length - 1; i >= 0; i--) {
    const obj = result[i];
    if (obj.node_type == 'operation' && !traceOperations.has(obj.opmagic)) {
      result.splice(i, 1);
    }
    if (obj.node_type == 'tensor' && !traceTensor.has(obj.magic)) {
      result.splice(i, 1);
    }
  }
}

watch(() => comGraphStore.data.inFixedComGraphFlow, (val) => {
  if (val) {
    allOptions.value = curSearchOptions;
    currentSelect.value = 'currentPath';
  } else {
    allOptions.value = searchOptions;
    currentSelect.value = 'current';
  }
});

const displayNav = (it, index) => {
  if (curPath.value.length == 2) {
    return `${funcMap.value[it].func_magicname} / `;
  } 
  if (curPath.value.length >2) {
    if(index === curPath.value.length - 3) {
      return '... / ';
    } else if (index === curPath.value.length - 2){
      return `${funcMap.value[it].func_magicname} / `;
    }
  }
  return '';
}

let ellipsis = false;

const displayNavBackUp = (it, index, navFlag) => {
  const prePath = curPath.value.slice(0, -1);
  if (index === 0) {
    return funcMap.value[it].func_magicname;
  }
  switch (navFlag) {
    case 0:
      return funcMap.value[it].func_magicname;
    case 1:
      //pre 2  after 2
      if (index === 1 || index === prePath.length - 2) {
        return funcMap.value[it].func_magicname;
      } else if (!ellipsis) {
        ellipsis = true;
        return '...';
      } else {
        return '';
      }
    case 2:
      //pre 1 after 2
      if (index === prePath.length -2) {
        return funcMap.value[it].func_magicname;
      } else if (!ellipsis) {
        ellipsis = true;
        return '...';
      } else {
        return '';
      }
  }
}

function genNavFlag(curPath, width) {
  let path = [];
  for (const it of curPath) {
    path.push(funcMap.value[it].func_magicname);
  }
  let len = 0;
  len = getTextWidth(path.join(' / '));

  if (len <= width) {
    return 0;
  }

  if (curPath.length >= 5) {
    let remainPath = [path[0], path[1], path[path.length - 1], path[path.length - 2], '...'];
    len = getTextWidth(remainPath.join(' / '));
    if (len <= width) {
      return 1;
    }
  }

  if (curPath.length >= 4) {
    let remainPath = [path[0], path[curPath.length - 1], path[curPath.length - 2], '...'];
    len = getTextWidth(remainPath.join(' / '));
    if (len <= width) {
      return 2;
    }
  }
  return 0;
}

const displayResIt = (it) => {
  if (it.node_type === 'function') {
    return `${it.node_type} hash:${it.hash} name:${it.func_magicname}`;
  }
  
  let symbol = '';
  let displayMagic = '';
  if (it.node_type === 'tensor') {
    symbol = (it.rawtensor_info.symbol??'') + ' ';
    displayMagic = it.magic;
  } else {
    displayMagic = it.opmagic;
  }
  if (it.funcHash && it.funcHash !== currentFuncHash) {
    return `${it.node_type} SubgraphID:${it.subgraphid} ${symbol}magic:${displayMagic} FuncName:${it.funcName}`;
  }
  return `${it.node_type} SubgraphID:${it.subgraphid} ${symbol}magic:${displayMagic}`;
}

const emit = defineEmits(['onLocate']);

const onLocate = (it) => {
  if (it.node_type === 'function') {
    jumpSearchSubgraph(it.hash, it.func_magicname);
    return;
  }
  if (it.funcHash && it.funcHash !== currentFuncHash) {
    jumpToGraph(it.funcHash);
    return;
  }
  if (props.showType == 'op' && it.node_id.startsWith('tensor-')) {
    (window as any).ascEventBus.emit('message_notice', t('comGraph.notShowTensorReport'));
    return;
  }
  emit('onLocate', it.node_id);
}

const onJump = (it) => {
  const newPath = [...curPath.value];
  newPath.pop();
  newPath.push(it);
  jumpSubgraph(it, funcMap.value[it].func_magicname, JSON.stringify(newPath));
}

const openHealthReport = () => {
  comGraphCtx?.toggleHealthReport(true);
};

const changeLayer = () => {
  if (comGraphCtx) {
    comGraphCtx.showLayerControl.value = true
  }
}

function jumpToGraph(funcHash) {
  const funcMagicName = funcMap.value[funcHash]?.func_magicname;
  jumpSearchSubgraph(funcHash, funcMagicName)
}

function jumpSubgraph(calleehash, funcMagicName, curPath) {
  (window as any).vscode.postMessage({
    command: 'getSubgraph',
    paramObj: { calleehash: calleehash, subFuncmagicname: funcMagicName, curPath: curPath}
    });
}

function openDiffViewer() {
  (window as any).vscode.postMessage({
    type: 'openDiffViewer'
  });
}

function globalSearch(event) {
  (window as any).vscode.postMessage({
    command: 'searchAllFunc',
    paramObj: JSON.parse(JSON.stringify(event))
  })
}

window.addEventListener('message', (event) => {
  if (event.data.command === 'globalSearchResult') {
    res.value = [];
    for (const[k, v] of Object.entries(event.data.data)) {
      v.forEach(item => {
        const newItem = {...item, funcHash: k, funcName: funcMap.value[k]?.func_magicname}
        if (k == currentFuncHash) {
          res.value.unshift(newItem);
        } else {
          res.value.push(newItem);
        }
      });
    }
    resSize.value = res.value.length;
  }
});

function jumpSearchSubgraph(calleehash, funcMagicName) {
  //let shortestPath = generateShortestPath(calleehash, funcTree);
  let newPath = JSON.stringify([calleehash]);
  (window as any).vscode.postMessage({
    command: 'getSubgraph',
    paramObj: { calleehash: calleehash, subFuncmagicname: funcMagicName, curPath: newPath}
    });
}

function generateShortestPath(funchash, funcTree) {
  const queue = [{ path: [], node: funcTree }];
  const visited = new WeakSet();
    
  visited.add(funcTree);
  while (queue.length > 0) {
    const { path, node } = queue.shift();
    for (const key in node) {
      if (!node.hasOwnProperty(key)) continue;           
      const newPath = [...path, key];
      if (key === funchash) {
        return newPath;
      }
            
      const childNode = node[key];
            
      if (typeof childNode === 'object' && childNode !== null) {
        if (visited.has(childNode)) {
          continue;
        }
                
        if (Object.keys(childNode).length > 0) {
          visited.add(childNode);
          queue.push({
            path: newPath,
            node: childNode
          });
        }
      }
    }        
  }  
  return [];
}

window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.command == 'returnFuncTree') {
    funcTree = message.data;
    passName = message.fsPath.split('\\').pop();
    curPath.value = typeof message.curPath === 'string' ? JSON.parse(message.curPath) : message.curPath;
    entry.value = message.entry;
    comGraphStore.setData('curPath', message.curPath);
    curList.value = [curPath.value[curPath.value.length - 1]];
    if (curPath.value[0] == message.entry) {
      curList.value = getLayerList(curPath.value, funcTree);
      isPathExist.value = true;
    }
    //navFlag.value = genNavFlag(curPath.value, module_row.value.offsetWidth - 48);
  }
});

function calcNodeSize(map) {
  let cnt = 0;
  const values = Object.values(map);
  values.forEach(val => {
    cnt += Object.keys(val).length;
  })
  return cnt;
}

watch(
  () => comGraphStore.data.jsonData,
  (val) => {
    if (val) {

      ctrl_flow.value = getCurFunctionDynamicAttr();
      const jsonData = comGraphStore.data.jsonData;
      const incasts = extractIncasts(jsonData);
      const outcasts = extractOutcasts(jsonData);
      currentFuncHash = jsonData.hash;
      rawTensorMap = extractRawTensors(jsonData);
      tensorMap = extractTensorNodes(jsonData, incasts, outcasts, rawTensorMap);
      opMap = extractOperationNodes(jsonData);
      totalSize.value = calcNodeSize(opMap) + calcNodeSize(tensorMap);
    }
  }, { immediate: true }
);

watch(() => comGraphStore.data.calleeMap, (val) => {
  if (Object.keys(val).length === 0) {
    return;
  }
  funcMap.value = extractFuncMap(val);
}, { immediate: true });

onMounted(() => {
  const inputEl = searchEl.value.$el.querySelector('.dp-category-search-toggle');
  let blurTimer:number | null = null;
  inputEl.addEventListener('focus', () => {
    clearTimeout(blurTimer);
    blurTimer = null;
    isSearchFocus.value = true;
    controlOperation(true);
  });
  inputEl.addEventListener('blur', () => {
    blurTimer = window.setTimeout(() => {
      isSearchFocus.value = false;
      controlOperation(false);
    }, 300);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const icon = searchEl.value.$el.querySelector('.dp-category-search-icon') as HTMLElement;
    icon?.click();
  });

  (window as any).vscode.postMessage({
    type: 'getFuncTree',
  });
});
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.com-graph-header {
  height: 160px;
  background: var(--devui-header-gradient-bg);
}

.corner-container {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arrow-container {
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    box-shadow: 0 4px 16px 0 $devui-shadow;
    cursor: pointer;
  }

  .devui-icon__container {
    color: var(--devui-icon);
  }
}

.category-search {
  width: 400px;
  height: 28px;
  margin-right: 0px;
  border-radius: 0 4px 4px 0;
  transition: border-color 0.3s var(--devui-animation-ease-in-out-smooth, cubic-bezier(0.645,0.045,0.355,1));
  user-select: none;
  position: absolute;
  right: 0px;
  top: 0px;
  border-left: transparent !important;
  border: none !important;
  --hide-icon: 1;

  :deep() {
    .dp-category-search-line-container {
      display: flex;
      padding-top: 3px;
      margin-right: 0px;
      height: 100%;
      width: 365px;

      .dp-category-search-line {
        height: 22px;
        font-size: 13px;

        .devui-tag .devui-tag__item {
          height: 22px;
          line-height: 22px;
          font-size: 13px;
        }
      }

      &:hover {
        overflow-y: hidden;
      }
    }

    .dp-category-search-extended-container {
      align-items: center;
      justify-content: center;
      border-left: none !important;
    }

    .dp-category-search-toggle {
      min-width: 80px !important;
      height: 22px !important;
      font-size: 13px !important;
    }

    .dp-category-search-icon {
      position:absolute;
      padding-right: 0px;
      right: 8px;
      width: 16px;
      opacity: var(--hide-icon);
    }

  }

  &:not(.search-focus):hover {
    border-color: none;
  }

  &.search-focus {
    border-color: none;
  }

  .rect-upper-lower {
    width: 20px;
    height: 20px;
    color: rgba(179, 179, 179, 1);
    background-color: rgba(255, 255, 255, 0.13);
    border-radius: 4px;
    margin-right: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
  }

  .rect-reg {
    width: 20px;
    height: 20px;
    color: rgba(179, 179, 179, 1);
    background-color: rgba(255, 255, 255, 0.13);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
  }

  .rect-upper-lower.active,
  .rect-reg.active {
    border-color: rgba(49, 122, 247, 1);
    color: rgba(49, 122, 247, 1);
  }

  .rect-upper-lower:hover {
    color: rgba(49, 122, 247, 1);
  }

  .rect-reg:hover {
    color: rgba(49, 122, 247, 1);
  }

  .has-tooltip {
    position: relative;
    cursor: pointer;
  }

  .tooltip {
    position: absolute;
    height: 24px;
    display: flex;
    padding: 4px 12px 4px 12px;
    bottom: 120%;
    left: 50%;
    top: -31px;
    transform: translateX(-50%);
    color: rgba(179, 179, 179, 1);
    background-color: rgba(54, 54, 54, 1);
    white-space: nowrap;
    font-size: 12px;
    opacity: 1;
    border-radius: 4px;
    pointer-events: none;
    visibility: hidden;
  }

  .has-tooltip:hover .tooltip {
    opacity: 1;
    visibility: visible;
  }
}

.res-it {
  width: 447px;
  height: 28px;
  padding: 4px;
  border-radius: 4px;
  overflow:hidden;
  position: relative;

  &:hover {
    background: $devui-list-item-active-bg;
  }

  .res-it-text {
    width: 100%;
    height: 20px;
    font-size: 12px;
    color: rgba(82, 145, 255, 1);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-right: 26px;
  }

  .res-it-icon {
    position:absolute;
    right: 1px;
    width: 16px;
    height: 16px;
    padding: 4px;
    background: translate;
    margin-right: 8px;
    overflow: hidden;
    border: node !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }

}

.res-size {
  width: 450px;
  height: 28px;
  padding: 4px;
  border-radius: 4px;

  .res-size-text {
    width: 100%;
    height: 20px;
    font-size: 12px;
    color: rgba(230, 230, 230, 1);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.module-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0 18px 16px;
  user-select: none;
}

.module-row-center-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.module-row-graph-type {
  color: var(--devui-primary-text);
  padding: 0 8px;
  height: 18px;
  line-height: 16px;
  border-radius: 4px;
  
  &.TENSOR_GRAPH {
    background-color: var(--devui-mint-60);
  }
  &.TILE_GRAPH {
    background-color: var(--devui-green-60);
  }
  &.EXECUTE_GRAPH {
    background-color: var(--devui-cyan-60);
  }
  &.BLOCK_GRAPH {
    background-color: var(--devui-blue-60);
  }
  &.LEAF_VF_GRAPH {
    background-color: var(--devui-indigo-60);
  }
  &.INVALID {
    background-color: var(--devui-red-60);
  }
}

.navigation {
  display: flex;
  gap: 4px;

  & > span {
    line-height: 18px;
  }
}

.select-options {
  display: flex;
  position: absolute;
  pointer-events: auto;
  left: 0px;
  top: 0px;
  height: 28px;
  font-size: 13px;
  z-index: 1080;

  .toolbar-row .select-options.devui-select--open,
  .toolbar-row .select-options.devui-select--focus {
      border-color: var(--devui-line) !important;
      border: none !important;
  }


  :deep() {
    .devui-select__selection {
      height: 28px;
      border-radius: 4px 0 0 4px;
      border-right: none !important;
      box-shadow: none !important;
      outline: none !important;
      border-color: var(--devui-line) !important;
      border: none !important;
    }

    .devui-select__item {
      font-size: 13px !important;
      margin-left: 8px;
    }

    .devui-select__arrow {
      width: 16px;
      height: 16px;
    }

    .devui-select__input {
      padding-top: 5px;
      height:26px;
      line-height: 27px;
      padding-left: 8px;
      padding-right: 0px;
      font-size: 13px;
    }

    .devui-select__selection.devui-select__selection--glow-style {
      border-color: var(--devui-line) !important;
    }

    :focus {
      outline: none !important;
      border: none !important;
      border-color: var(--devui-line) !important;
      box-shadow: none !important;
      border-radius: 4px 0 0 4px;
      border-right: none !important;
    }

    :hover {
      outline: none !important;
      box-shadow: none !important;
      border-radius: 4px 0 0 4px;
      border-right: none !important;
      border-color: var(--devui-line) !important;
    }

    &:not(.devui-select__selection--error) {
      border-color: var(--devui-line) !important;
    }
  }
}

.corner-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-color: var(--devui-secondary-button-bg);
  box-shadow: var(--devui-tips-shadow);

  .devui-icon__container {
    color: var(--devui-overlay-icon);
  }

  &:hover {
    cursor: pointer;
    .devui-icon__container {
      color: var(--devui-operation-text-hover);
    }
    svg {
      :deep() {
        path {
          stroke: var(--devui-operation-text-hover);
        }
      }
    }
  }
}

.toolbar-row {
  display: flex;
  align-items: center;
  padding: 0px 0px 0px 0px;
  overflow: visible;
  height: 30px;
  left: 16px;
  position: relative;
  border-radius: 4px;
  border: 1px solid;
  border-color: var(--devui-line);
}

.toolbar-row.search-focusd {
  border-color: rgba(49, 122, 247, 1);
}

.control-flow {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  width: 100%;
  padding-left: 16px;
  box-sizing: border-box;

  .control-flow-base {
    flex-grow: 0;
    flex-shrink: 1;
    flex-basis: auto;
    height: 20px;
    line-height: 16px;
    margin-top: 14px;
    padding: 0px 8px 2px 8px;
    box-sizing: border-box;
    border-radius: 4px;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 240px;
  }

  .control-flow-itername {
      border: 1px solid rgba(244, 112, 171, 1);
      color: rgba(244, 112, 171, 1);
    }

    .control-flow-begin {
      border: 1px solid rgba(140, 163, 250, 1);
      color: rgba(140, 163, 250, 1);
    }

    .control-flow-end {
      border: 1px solid rgba(168, 219, 129, 1);
      color: rgba(168, 219, 129, 1);
    }

    .control-flow-step {
      border: 1px solid rgba(249, 183, 102, 1);
      color: rgba(249, 183, 102, 1);
    }

    .control-flow-coretype {
      border: 1px solid rgba(203, 142, 251, 1);
      color: rgba(203, 142, 251, 1);
    }

    .control-flow-magic-name {
      border: 1px solid rgba(99, 213, 168, 1);
      color: rgba(99, 213, 168, 1);
    }
}

.layer-list {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap:4px;

  .layer-item {
    padding: 4px;

    &:hover {
      background:  $devui-list-item-active-hover-bg;
      cursor: pointer;
    }

    &.active {
      background: $devui-list-item-active-bg;
    }
  }
}

.layer-cur {
    font-weight: bold;

    &:hover {
      cursor: pointer;
    }
  }

</style>

<style lang='scss'>
.search-dropdown {
  padding: 4px;
  width: 465px;
  display: flex;
  flex-direction: column;
  gap: 4;
  border-radius: 8px;

  &.devui-dropdown__menu-wrap {
    max-height: 164px;
    overflow: auto;
  }
}
</style>

<style lang="scss">
.devui-tooltip.devui-flexible-overlay.corner-tips {
  z-index: 1030;
}

.globalSelect .devui-select__item  {
  font-size: 13px !important;
}

.searchResultDown {
  transform: translate(-65px, 10px) !important;
}



</style>