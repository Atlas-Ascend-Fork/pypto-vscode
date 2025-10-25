<template>

  <div class="com-graph-header">
    <img 
      :src="iconPath" 
      :class= "icon-img"
      style = "width: 64px; height: 64px; margin-top: -20px; gap: 20px"
    />

    <div class="search-wrapper" :style="{width: 540 + selectWidth + 'px'}">
      <div 
        class="toolbar-row"
        :class="{ 'search-focusd': isSearchFocus}"
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
          <div class='dividing-line'></div>
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

      <div v-if="historyList.length" class="history-box">
        <div class="history-header">{{ t('comGraph.searchHistoryTips') }}</div>
        <div class="history-tags">
          <span v-for="item in historyList" :key="item" class="history-tag" @click="historyOnSearch(item)">
            {{item}}
          </span>
        </div>
      </div>

      <div class="search-page-tips">{{ t('comGraph.searchPageTips') }}</div>
      <div class="search-page-tips-content">{{ t('comGraph.searchPageTipsContent') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineEmits, onMounted, reactive, watch} from 'vue';
import { useI18n } from 'vue-i18n';
import { comGraphStore } from '../../service/com-graph-store';
import { getCurFunctionDynamicAttr } from '../../sprotty-graph/parseSymbolicAttr';
import { getTextWidth } from '../../utils/index';
import { useHeader } from './hooks/use-header';
import { extractIncasts,
  extractOutcasts,
  extractRawTensors,
  extractTensorNodes,
  extractOperationNodes,
  searchFuzzy,
  searchByTensorMagic,
  searchByTensorSemanticLabel,
  searchByRawTensorMagic,
  searchBySubgraphid,
  searchByOperationMagic } from '../../utils/search';


const props = defineProps({
  jsonContent: {
    type: Object,
    default: {}
  },
})

const { t } = useI18n();
const searchEl = ref();
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
];

const curSearchOptions = [
  {name: t('comGraph.onlyPath'), value: 'currentPath'},
];

const currentSelect = ref('current');
const allOptions = ref(searchOptions);
const selectWidth = ref(getTextWidth(allOptions.value[0].name, 16) + 40);
const textConfig = {
  keywordName: t('comGraph.keyword')
}
const searchConfig = {
  keywordDescription: (key: string) => t('comGraph.keywordDesc', { key }),
  fieldDescription: (label: string) => t('comGraph.fieldDesc', { label }),
  categoryDescription: t('comGraph.categoryDesc')
}

let currentFuncHash = "0";
let isVisible = ref(false);
let tensorMap = {};
let opMap = {};
let rawTensorMap = {};
let funcMap = ref({});
let res = ref([]);
let totalSize = ref(0);
let resSize = ref(0);
let hasSearched = false;
let searchTimer: number | null = null;
let isSelectedMagic = false;
const isSearchFocus = ref(false);
const upperActive = ref(false);
const regActive = ref(false);
const iconPath = `${(window as any).staticPath}/static-assets/logo.png`;
const historyList = localStorage['history'].split(',');

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

const historyOnSearch = (searchNode) => {
  hasSearched = false;
  upperActive.value = false;
  regActive.value = false;
  const realSearchKey = searchNode.split(':')[1];
  const e = {
    selectedTags: [],
    searchKey : realSearchKey,
    category : undefined
  }
  onSearch(e);
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
  setSearchHistory(e.searchKey, res.value);
}

function setSearchHistory(searchContent: string, result: any) {
  if (!(searchContent) || searchContent === '') {
    return;
  }
  searchContent = searchContent.trim();
  const searchKeyType = matchNodeType(searchContent, result);

  const fixedkey = "history";

  let oldSearchList: string[];
  const oldSearchHistory = localStorage.getItem(fixedkey);
  if (!oldSearchHistory) {
    oldSearchList = [];
  } else {
    oldSearchList = oldSearchHistory.split(',');
  }

  const newRecord = `${searchKeyType}:${searchContent}`;

  const nodePos = oldSearchList.findIndex(pastnode => pastnode.split(':')[1] === searchContent);
  if (nodePos !== -1) {
    oldSearchList.splice(nodePos, 1);
  }
  oldSearchList.unshift(newRecord);

  if (oldSearchList.length > 20) {
    oldSearchList.pop();
  }

  const newSearchList = oldSearchList.join(',');
  localStorage.setItem(fixedkey, newSearchList);
}

function matchNodeType(searchContent: string, result: any) {
  let searchKey = 'unmatched';

  for (let i = result.length - 1; i >= 0; i--) {
    const obj = result[i];
    if (obj.magic?.toString() === searchContent || obj.opmagic?.toString() === searchContent) {
      searchKey = obj.node_type;
      return searchKey;
    }
  }

  for (let i = result.length - 1; i >= 0; i--) {
    const obj = result[i];
    if (obj.node_type === 'tensor' && obj.rawtensor?.toString() === searchContent) {
      searchKey = 'rawtensor';
      return searchKey;
    }
  }

  for (let i = result.length - 1; i >= 0; i--) {
    const obj = result[i];
    if (obj.subgraphid?.toString() === searchContent) {
      searchKey = 'subgraphId';
      return searchKey;
    }
  }

  return searchKey;
}

function filterSearchResult(result: any) {
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

const onLocate = (it) => {
  if (it.node_type === 'function') {
    return;
  }
  (window as any).ascEventBus.emit('searchNode', it.magic ?? it.opmagic);
}

const historyNodeOnLocate = (it) => {
  const nodeMagic = (it.split(':')[1]);
  const nodeType = (it.split(':')[0]);
  // unmatched节点直接提示 未匹配，点击无效
  // subgraphid节点提示 搜索具体id？
  if (nodeType === 'unmatched') {
    (window as any).ascEventBus.emit('message_notice', 
        `${(window as any).ascLang === 'en' ? 'unmatched node' :'未匹配节点'}`);
  } else if (nodeType === 'subgraphId') {
    (window as any).ascEventBus.emit('message_notice', 
        `${(window as any).ascLang === 'en' ? 'please select a node in nodes of searching result' :'请在搜索框内选中具体节点'}`);
  } else {
    (window as any).ascEventBus.emit('searchNode', nodeMagic);
  }
}

function calcNodeSize(map) {
  let cnt = 0;
  const values = Object.values(map);
  values.forEach(val => {
    cnt += Object.keys(val).length;
  })
  return cnt;
}


onMounted(() => {
  const jsonData = props.jsonContent;
  const incasts = extractIncasts(jsonData);
  const outcasts = extractOutcasts(jsonData);
  currentFuncHash = jsonData.hash;
  rawTensorMap = extractRawTensors(jsonData);
  tensorMap = extractTensorNodes(jsonData, incasts, outcasts, rawTensorMap);
  opMap = extractOperationNodes(jsonData);
  totalSize.value = calcNodeSize(opMap) + calcNodeSize(tensorMap);

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
});
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.com-graph-header {
  height: 100vh;
  background: var(--devui-header-gradient-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.dividing-line {
  width: 1px;
  height: 16px;
  background-color: var(--devui-split-line);
}

.category-search {
  flex: 1;
  height: 100%;
  margin-right: 0px;
  border-radius: 0 4px 4px 0;
  transition: border-color 0.3s var(--devui-animation-ease-in-out-smooth, cubic-bezier(0.645,0.045,0.355,1));
  user-select: none;
  border-left: transparent !important;
  border: none !important;
  background-color: transparent;
  --hide-icon: 1;

  :deep() {
    .dp-category-search-line-container {
      display: flex;
      padding-top: 3px;
      margin-right: 0px;
      height: 100%;
      //width: 365px;

      .dp-category-search-line {
        height: 100%;
        font-size: 13px;

        .devui-tag .devui-tag__item {
          height: 26px;
          line-height: 26px;
          font-size: 13px;
        }

        .dp-category-search-input {
          height: 100%;
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

    .dp-input-container {
      height: 100%;
    }

    .dp-category-search-toggle {
      min-width: 80px !important;
      height: 100% !important;
      font-size: 16px !important;

      &::placeholder {
        color: var(--devui-placeholder-text);
      }
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

.select-options {
  display: flex;
  pointer-events: auto;
  height: 100%;
  font-size: 13px;
  z-index: 1080;

  .toolbar-row .select-options.devui-select--open,
  .toolbar-row .select-options.devui-select--focus {
      border-color: var(--devui-line) !important;
      border: none !important;
  }


  :deep() {
    .devui-select__selection {
      height: 100%;
      padding: 20px 0 20px 20px;
      border-radius: 4px 0 0 4px;
      border-right: none !important;
      box-shadow: none !important;
      outline: none !important;
      border-color: var(--devui-line) !important;
      border: none !important;
      background-color: transparent;
    }

    .devui-select__item {
      font-size: 13px !important;
      margin-left: 8px;
    }

    .devui-select__arrow {
      width: 16px;
      height: 16px;

      svg path {
        fill: var(--devui-primary-text);
      }
    }

    .devui-select__input {
      padding-left: 0px;
      padding-right: 0px;
      font-size: 16px;
      color: var(--devui-primary-text);
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

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0px;
  overflow: visible;
  width: 100%;
  height: 64px;
  position: relative;
  border-radius: 12px;
  border: 1px solid;
  border-color: var(--devui-line);
}

.toolbar-row.search-focusd {
  border-color: rgba(49, 122, 247, 1);
}

.history-box {
  width: 100%;
  margin-top: 24px;
}

.history-header {
  font-size: 14px;
  line-height: 22px;
  font-weight: 700;
  color: var(--devui-primary-text);
  margin-bottom: 12px;
}

.search-wrapper {
  margin-top: 32px;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.history-tag {
  background: var(--devui-tooltip-bg);
  font-size: 12px;
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--devui-secondary-text);
  transition: background 0.2s;
}

.history-tag:hover {
  cursor: pointer;
  color: var(--devui-primary-text);
  background: var(--devui-brand-hover);
}


.search-page-tips {
  font-size: 14px;
  font-weight: bold;
  color: var(--devui-primary-text);
  line-height: 22px;
  margin-top: 24px;
}

.search-page-tips-content {
  font-size: 12px;
  color: var(--devui-secondary-text);
  line-height: 20px;
  margin-top: 12px;
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