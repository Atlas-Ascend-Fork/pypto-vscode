<template>
  <div class="sidebar-demo-container">
    <!-- 抽屉组件：右侧弹出，包含页签和表格核心内容 -->
    <d-drawer :lock-scroll="false" v-model="drawerVisible" :show-overlay="true" class="drawer-container"
              placement="right" @close="handleDrawerClose" @open="handleDrawerOpen">
      <div class="drawer-header">
        <div class="drawer-header__title">{{ currentDrawerData?.title }}</div>
        <i class="icon icon-close" @click="drawerVisible=false"></i>
      </div>

      <!-- 抽屉内容区：包含页签切换和表格内容，高度自适应 -->
      <div class="drawer-content">
        <!-- Tabs组件：切换不同数据分类（如基本信息、联系方式） -->
        <d-tabs v-model="activeTabId" class="data-tabs" type="options" @active-tab-change="handleTabChange"
                custom-width="140px">
          <!-- 动态页签面板：根据当前抽屉数据生成对应页签 -->
          <d-tab v-for="(tab, tabIndex) in currentDrawerData?.tabs || []" :id="`tab-${tabIndex}`"
                 :key="tabIndex" :title="tab.name" class="data-tabs">
            <div class="call-record">
              <!-- 搜索框：筛选当前页签表格数据，支持清空 -->
              <d-input v-model="searchKeywords[tabIndex]" class="search-input"
                       :placeholder="t('controlFlows.tableSearch')"
                       @input="processedTableData(tabIndex)"
              >
                <template #prefix>
                  <d-icon class="search-input__icon" name="search"/>
                </template>
                <template #suffix>
                  <d-icon v-if="searchKeywords[tabIndex]" class="search-input__clear" name="close"
                          @click.stop="searchKeywords[tabIndex] = ''"/>
                </template>
              </d-input>
              <!-- 表格组件：支持展开详情、列排序，深色主题适配 -->
              <d-table ref="tableRef" :data="processedTableData(tabIndex)"
                       :expand-row-keys="defaultExpandedRowKeys[tabIndex]"
                       :row-hovered-highlight="true"
                       class="content-table"
                       :header-bg="true"
                       row-key="id"
                       fix-header
                       @row-click="onRowClick"
                       @expand-change="(currentRow: TableRowData, expandedRows: TableRowData[]) => handleExpandChange(tabIndex, currentRow, expandedRows)"
                       @sort-change="(sortInfo: SortInfo) => handleSortChange(tabIndex, sortInfo)"
                       v-if="isTableVisited"
              >

                <d-column field="name" width="286px" show-overflow-tooltip>
                  <template #header>
                    <span class="table-header-left">{{ tableTitle[tabIndex].name }}</span>
                    <div class=" left-sort">
                      <div class="sort-icon">
                        <d-icon class="sort" operable @click="sortLeaf(tabIndex)">
                          <template #prefix>
                            <img :src="sortIcon" class="icon-sort">
                          </template>
                        </d-icon>
                      </div>
                    </div>

                  </template>
                  <template #default="scope">
                    <div class="table-leaf-sell">
                      <span class="callee-sell-name">{{ scope.row.name }}</span>
                    </div>
                  </template>
                </d-column>

                <d-column field="frequency" width="154px">
                  <template #header="scope">
                    <span class="table-header-right">{{ tableTitle[tabIndex].value }}</span>
                    <d-icon class="sort" operable @click="sortFrequency(tabIndex)">
                      <template #prefix>
                        <img :src="sortIcon" class="icon-sort">
                      </template>
                    </d-icon>
                  </template>
                  <template #default="scope">
                    <div class="table-callee-sell">
                      <span class="callee-sell-count">{{ scope.row.frequency }}</span>
                      <div v-if="scope.row.frequency==='-'" class="callee-sell-progress"></div>
                      <d-progress v-else class="callee-sell-progress"
                                  :percentage="(scope.row.frequency/(tabIndex===0?calledMaxFrequency:calleeMaxFrequency))*100"
                                  barBgColor="#317AF7" height="6px"></d-progress>
                    </div>
                  </template>
                </d-column>
                <!-- 表格展开列：点击展开显示当前行详情数据 -->
                <d-column type="expand" width="0px">
                  <template #default="rowData">
                    <div class="content-table__expand-column">
                      <div class="expand-content">
                        {{ tableTitle[tabIndex].detailTitle }}
                      </div>
                      <div v-for="item in rowData.row.detail" class="expand-row">
                        <div class="expand-row_title">
                          {{ item.label }}
                        </div>
                        <div class="expand-row_frequency">
                          <span class="expand-row_frequency_name">
                            {{ item.value }}
                          </span>
                          <div class="expand-row_frequency_progress">
                            <div v-if="item.value==='-'" class="expand-row-progress"></div>
                            <d-progress v-else class="expand-row-progress"
                                        :percentage="(item.value/rowData.row.detailMaxCalled)*100"
                                        barBgColor="#317AF7" height="6px"></d-progress>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </d-column>

              </d-table>

              <!-- 空数据提示：当前页签无匹配数据时显示 -->
              <div v-if="processedTableData(tabIndex).length === 0" class="empty-tip">
                {{ t('controlFlows.noMatchingData') }}
              </div>
            </div>
          </d-tab>
          <d-tab v-if="passList.length" class="data-tabs" :id="'tab-3'"
                 :title="t('controlFlows.allComputationalPanelTitle')">
            <div class="data-tabs_computes">
              <!-- 每组数据 -->
              <div v-for="(group,groupIndex) in passList" :key="groupIndex">
                <div class="group-line" :style="`color:${group.color}`">
                  <i class="group-line-icon icon-management-new"></i>
                  <span class="group-line-title"> {{ group.name }}</span>
                </div>
                <div v-for="(item,index) in group.members" :key="index" class="group-line" :style="getColor(item.type)"
                     @click="openGraph(item)">
                  <div class="line-group">
                    <span class="group-line-index"> {{ item.passIndex }}</span>
                    <span class="group-line-name" :title="item.passName "> {{ item.passName }}</span>
                  </div>
                  <span class="group-member-icon" v-if="item.icon"><img class="healthIcon" :src="healthIcon"/></span>
                </div>
              </div>
            </div>
          </d-tab>
        </d-tabs>
      </div>
    </d-drawer>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import {
  CalledRecordsType, CalleeRecordsType,
  ControlFlowNodesType, DetailItem, GroupItem, LeafFunctionType,
  PanelData, PassesType,
  SortInfo,
  SortOption, TabData,
  TableRowData, TableTitleType
} from "@/components/controlFlowGraph/type/node-detail-types";
import { useI18n } from 'vue-i18n';
import { openComputeGraph } from "@/apis/opener";


const healthIcon = ref(`${window.staticPath}/static-assets/control_flow_health.svg`);
const sortIcon = ref(`${window.staticPath}/static-assets/control_flow_panel_sort.svg`);
const rgb='rgb(97,201,131)'
// ========================== 1. 绑定组件 ==========================
const tableRef = ref();

// ========================== 2. 数据 ==========================
// 按钮配置数据：点击不同按钮打开对应数据的抽屉
const { t } = useI18n();
const passList = ref<GroupItem[]>([])
const panelData = ref<PanelData>({
  title: '',
  tabs: []
});
const tableTitle: TableTitleType[] = [
  {
    name: t('controlFlows.callFunctionTableName'),
    value: t('controlFlows.callFunctionTableValue'),
    detailTitle: t('controlFlows.detailTitle'),
  },
  {
    name: t('controlFlows.leafFunctionTableName'),
    value: t('controlFlows.leafFunctionTableValue'),
  }
]
const outPutPath = ref()
// ========================== 3. 状态管理 ==========================
// 抽屉显示状态：控制抽屉是否弹出
const drawerVisible = ref(false);
// 当前抽屉数据：存储点击按钮后对应的配置（标题、页签等）
const currentDrawerData = ref<PanelData | null>(null);
// 活跃页签ID：控制当前显示的页签
const activeTabId = ref('tab-0');
// 搜索关键词：按页签存储搜索输入（{ 页签索引: 关键词 }）
const searchKeywords = ref<Record<number, string>>({});
// 排序状态：按页签存储排序信息（{ 页签索引: { field, direction } }）
const sortStates = ref<Record<number, SortInfo>>({});
// 旧排序配置：兼容历史逻辑，可后续统一为sortStates
const sortOptions = ref<Record<number, SortOption>>({});
// 表格引用：按页签存储表格组件实例（备用）
const tableRefs = ref<Record<number, any>>({});
// 展开行ID：按页签存储展开的行ID（{ 页签索引: [行ID数组] }）
const defaultExpandedRowKeys = ref<Record<number, string[]>>({});
// 控制table显示隐藏
const isTableVisited = ref<boolean>(true);

// ========================== 4. 事件处理 ==========================
/**
 * 打开抽屉：初始化当前抽屉数据和状态（搜索、排序、展开行）
 * @param data 点击按钮对应的配置数据
 */
const openDrawer = () => {
  currentDrawerData.value = panelData.value;
  activeTabId.value = 'tab-0';

  try {
    // 初始化每个页签的状态
    panelData.value.tabs.forEach((_, tabIndex) => {
      searchKeywords.value[tabIndex] = ''; // 清空搜索
      sortOptions.value[tabIndex] = {sortField: 'frequency', sortDirection: "DESC"}; // 清空旧排序
      sortStates.value[tabIndex] = {field: '', direction: null}; // 清空新排序
      defaultExpandedRowKeys.value[tabIndex] = []; // 清空展开行
      tableRefs.value[tabIndex] = null; // 清空表格引用
    });

    drawerVisible.value = true;
  } catch (err) {
    console.log(err);
  }

};

/**
 * 抽屉打开回调：禁止页面背景滚动
 */
const handleDrawerOpen = () => {
  document.body.style.overflow = 'hidden';
};

/**
 * 抽屉关闭回调：恢复页面背景滚动
 */
const handleDrawerClose = () => {
  document.body.style.overflow = '';
};

/**
 * 页签切换回调：切换页签时清空当前页签的展开行（避免索引错位）
 * @param tabId 新页签ID（格式：tab-索引）
 */
const handleTabChange = (tabId: string) => {
  const tabIndex = Number(tabId.split('-')[1]);
  defaultExpandedRowKeys.value[tabIndex] = [];
};

/**
 * 搜索回调：触发表格数据筛选（实际筛选逻辑在processedTableData中）
 * @param tabIndex 当前页签索引
 */
const handleSearch = (tabIndex: number) => {
  // 筛选逻辑由processedTableData自动处理，此处仅触发响应式更新
};

/**
 * 打开图
 */
function openGraph(item) {
  openComputeGraph({
    outputPath: outPutPath.value,
    computeGraphPath: item.graphFilePath,
    pathName: item.pathName,
  })


}

const sortFrequencyType = ref<SortInfo>({field: 'frequency', direction: "ASC"})

function sortFrequency(tabIndex: number) {
  sortFrequencyType.value.direction = sortFrequencyType.value.direction === "ASC" ? "DESC" : "ASC";
  handleSortChange(tabIndex, sortFrequencyType.value);
}

const sortLeafType = ref<SortInfo>({field: 'name', direction: "ASC"})

function sortLeaf(tabIndex: number) {
  sortLeafType.value.direction = sortLeafType.value.direction === "ASC" ? "DESC" : "ASC";
  handleSortChange(tabIndex, sortLeafType.value);
}

/**
 * 排序变化回调：更新当前页签的排序状态，并同步列的排序方向
 * @param tabIndex 当前页签索引
 * @param sortInfo 排序信息（字段、方向）
 */
const handleSortChange = (tabIndex: number, sortInfo: SortInfo) => {
  // 更新排序状态
  sortStates.value[tabIndex] = sortInfo;

};

/**
 * 展开变化回调：更新当前页签的展开行ID数组
 * @param tabIndex 当前页签索引
 * @param currentRow 当前点击的行数据
 * @param expandedRows 所有展开的行数据
 */
const handleExpandChange = (tabIndex: number, currentRow: TableRowData, expandedRows: TableRowData[]) => {
  defaultExpandedRowKeys.value[tabIndex] = expandedRows.map(row => row.id);
};

// ========================== 5. 工具函数 ==========================
/**
 * 获取列的排序方法：根据字段类型返回对应的排序逻辑
 * @param field 排序字段
 * @returns 排序函数（a、b为比较的两行数据）
 */
const getColumnSortMethod = (field: string) => {
  return (a: any, b: any) => {
    let valueA = a[field];
    let valueB = b[field];
    valueA = valueA === '-' ? '0' : valueA
    valueB = valueB === '-' ? '0' : valueB

    // 处理空值：空值排在后面
    if (valueA === null || valueA === undefined) return 1;
    if (valueB === null || valueB === undefined) return -1;

    // 日期类型排序：处理"/"分隔的日期格式
    if (field === 'date' || field === 'entryDate') {
      const dateA = new Date(valueA.replace(/\//g, '-'));
      const dateB = new Date(valueB.replace(/\//g, '-'));
      return dateA.getTime() - dateB.getTime();
    }

    // 数字类型排序：直接数值比较
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueA - valueB;
    }

    // 字符串类型排序：支持中文排序
    return String(valueA).localeCompare(String(valueB), 'zh-CN');
  };
};

/**
 * 处理表格数据：整合筛选和排序逻辑，返回最终显示的表格数据
 * @param tabIndex 当前页签索引
 * @returns 筛选+排序后的表格数据
 */
const processedTableData = (tabIndex: number) => {

  // 边界判断：当前无抽屉数据或页签不存在时返回空数组
  if (!currentDrawerData.value || !currentDrawerData.value.tabs[tabIndex]) {
    return [];
  }

  const tab = currentDrawerData.value.tabs[tabIndex];
  const keyword = searchKeywords.value[tabIndex] || '';
  const {field: sortField, direction: sortDirection} = sortStates.value[tabIndex] || {};

  // 1. 筛选：关键词匹配任意字段（不区分大小写）
  let filteredData = [...tab.data];
  if (keyword) {
    filteredData = filteredData.filter(row => row.name.toLowerCase().includes(keyword.toLowerCase()))
    isTableVisited.value = !!filteredData.length;
  } else {
    isTableVisited.value = true
  }

  // 2. 排序：根据当前排序状态处理
  if (sortField && sortDirection) {
    filteredData = [...filteredData].sort((a, b) => {
      const sortResult = getColumnSortMethod(sortField)(a, b);
      // 升序：原排序结果；降序：反转排序结果
      return sortDirection === 'ASC' ? sortResult : -sortResult;
    });
  }
  if(filteredData.length===0){
    isTableVisited.value = false;
  }
  return filteredData;
};

function onRowClick(params) {
  if (params.row.detail) {
    tableRef.value[0].store.toggleRowExpansion(params.row)

  }
}

const calledMaxFrequency = ref(0)
const calleeMaxFrequency = ref(0)

function getCalledList(leafFunctions: LeafFunctionType[], calledRecords: CalledRecordsType[]): TableRowData[] {
  calledMaxFrequency.value = 0
  // 统计被调用数据
  const calledRecordObj = {}
  let index = 0;
  for (const called of calledRecords) {
    const callerHash = called.callerHash;
    const calleeHash = called.calleeHash;
    if (calledRecordObj.hasOwnProperty(calleeHash)) {
      calledRecordObj[calleeHash].frequency++;

      if (calledRecordObj[calleeHash].detail.hasOwnProperty(callerHash)) {
        calledRecordObj[calleeHash].detail[callerHash].value++;

      } else {
        calledRecordObj[calleeHash].detail[callerHash] = {
          value: 1,
          label: called.callerFunction.magicName.substring(7)
        }
      }

    } else {
      calledRecordObj[calleeHash] = {
        id: `${index}`,
        name: `${called.calleeFunction.magicName}`,
        frequency: 1,
        detail: {}
      }
      calledRecordObj[calleeHash].detail[callerHash] = {
        value: 1,
        label: called.callerFunction.magicName.substring(7)
      }
      index++;
    }

  }

  // 转换为表格数据对象列表并从高到低排序
  const tableData: TableRowData[] = [];
  index = 0;
  for (const leaf of leafFunctions) {
    index++;
    const leafFrequency = calledRecordObj.hasOwnProperty(leaf.hash) ? calledRecordObj[leaf.hash].frequency : '-';
    let leafObj: TableRowData = {
      id: `${index}`,
      name: `leaf_${leaf.programId}`,
      frequency: leafFrequency,
    }

    if (calledRecordObj.hasOwnProperty(leaf.hash) && JSON.stringify(calledRecordObj[leaf.hash].detail) !== "{}") {
      const detail: DetailItem[] = []
      let detailMaxCalled = 0;
      for (let i in calledRecordObj[leaf.hash].detail) {
        detailMaxCalled = Math.max(detailMaxCalled, calledRecordObj[leaf.hash].detail[i].value)
        detail.push({
          label: calledRecordObj[leaf.hash].detail[i].label,
          value: calledRecordObj[leaf.hash].detail[i].value.toString(),
        });
      }
      leafObj = {
        ...leafObj,
        detail,
        detailMaxCalled,
      }
    }
    calledMaxFrequency.value = Math.max(calledMaxFrequency.value, leafObj.frequency)
    tableData.push(leafObj)
  }
  tableData.sort((a, b) => b.frequency - a.frequency)
  return tableData;
}

function getCalleeList(leafFunctions: LeafFunctionType[], calleeRecords: CalleeRecordsType[]): TableRowData[] {
  const calleeFunctionObj = {}
  calleeMaxFrequency.value = 0
  let index = 0;
  const leafFunctionMap = new Map()
  leafFunctions.forEach(leafFunction => {
    leafFunctionMap.set(leafFunction.hash, leafFunction.magicName)
  })
  // 统计次数
  for (const callee of calleeRecords) {
    const calleeHash = callee.calleeHash;
    if (calleeFunctionObj.hasOwnProperty(calleeHash)) {
      calleeFunctionObj[calleeHash].frequency++;
    } else {
      calleeFunctionObj[calleeHash] = {
        id: `${index}`,
        name: leafFunctionMap.has(calleeHash) ? `leaf_${callee.calleeFunction.programId}` : callee.calleeFunction.magicName,
        frequency: 1,
      }
      index++;
    }
  }
// 转换为表格数据对象列表并从高到低排序
  const tableData: TableRowData[] = [];
  for (let i in calleeFunctionObj) {
    calleeMaxFrequency.value = Math.max(calleeMaxFrequency.value, calleeFunctionObj[i].frequency)
    tableData.push(calleeFunctionObj[i]);
  }
  tableData.sort((a, b) => b.frequency - a.frequency)
  return tableData;


}

const passStageTitle = {
  tensor: {label: 'Tensor Graph', color: 'var(--control-flow-panel-table-tensor)'},
  tile: {label: 'Tile Graph', color: 'var(--control-flow-panel-table-Tile)'},
  block: {label: 'Block Graph', color: 'var(--control-flow-panel-table-block)'},
};

function getPassList(passes: PassesType[]) {
  const passGroups: GroupItem[] = []
  let nowState = '';
  let item: GroupItem = {}

  for (let i = 0; i < passes.length; i++) {
    if (passes[i].passStage !== nowState) {
      if (nowState !== '') {
        passGroups.push(item);
      }
      nowState = passes[i].passStage;
      item = {icon: "icon-code", members: []};
      item.name = passStageTitle[passes[i].passStage].label;
      item.color = passStageTitle[passes[i].passStage].color;
    }
    item.members.push({
      ...passes[i],
      type: 'other',
      icon: passes[i].hasHealthReport ? "icon-HealthReport" : '',
    })
    if (i === passes.length - 1) {
      passGroups.push(item);
    }
  }
  return passGroups;
}

function transFormPanelData(nodeData: ControlFlowNodesType, path: string) {
  outPutPath.value = path
  const {leafFunctions, calledRecords, calleeRecords} = nodeData.data.source.meta;
  const calledList: TableRowData[] = getCalledList(leafFunctions, calledRecords);
  const calleeList: TableRowData[] = getCalleeList(leafFunctions, calleeRecords);

  const calleeObj: TabData = {
    name: t('controlFlows.callFunctionPanelTitle'),
    data: calleeList,
  }
  const calledObj: TabData = {
    name: t('controlFlows.calledFunctionPanelTitle'),
    data: calledList,
  }
  panelData.value.title = nodeData.data.source.magicName.substring(7);
  panelData.value.tabs = [];
  panelData.value.tabs.push(calledObj);
  panelData.value.tabs.push(calleeObj);

  if (nodeData.data.source.meta?.passes) {
    passList.value = getPassList(nodeData.data.source.meta?.passes)
  }
  openDrawer()
}


// ========================== 6. 监听事件 ==========================
/**
 * 监听搜索和旧排序变化：变化时清空当前页签的展开行（避免数据错位）
 */
watch(
    [() => searchKeywords.value, () => sortOptions.value],
    ([newSearch, newSort]) => {
      const currentTabIndex = Number(activeTabId.value.split('-')[1]);
      defaultExpandedRowKeys.value[currentTabIndex] = [];
    },
    {deep: true}
);


// ========================== 7. 计算图moke数据 ==========================

function getColor(type: string) {
  if (type == 'success') {
    return 'color: #A8DB81';
  }
  if (type == 'warning') {
    return 'color: #F9B766';
  }

}

function openGraphViewFn() {
  window.vscode.postMessage({
    command: 'openComGraph',
    paramObj: '/computational/0524_dynamic_pa_low_lantency_json/program.json',
  });
}


defineExpose({
  transFormPanelData

})
</script>

<style lang="less">
.drawer-container {
  overflow: hidden;
  box-shadow: 0px 16px 48px 0px rgba(0, 0, 0, 0.16);
}
</style>

<style lang="less" scoped>

.data-tabs_computes {
  width: 100%;
  height: 100%;
  padding-left: 4px;

  .group-line {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 32px;
    cursor: pointer;
    padding-left: 8px;
    border-radius: 4px;

    &:hover {
      background-color: var(--devui-input-hover-bg);
    }

    .group-line-title {
      font-size: 14px;
    }
.line-group{
  display: flex;
  width: 440px;
  padding: 4px 8px;
  gap:4px;
  font-size: 13px;
  font-weight: 400;

  .group-line-name {
    width: 390px;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
    .group-line-icon {
      display: flex;
      align-items: center;
      width: 16px;
      height: 16px;
    }

    .group-member-icon {
      display: flex;
      align-items: center;
      width: 16px;
      height: 16px;
    }
  }
}

// 抽屉容器：深色主题，右侧弹出，固定宽度
.drawer-container {
  // 抽屉头部：标题和关闭按钮布局
  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    // 抽屉标题：样式适配
    .drawer-header__title {
      font-size: 18px;
      font-weight: bold;
      line-height: 26px;
      color: var(--devui-title-text);
    }

    // 抽屉关闭按钮：样式适配
    .icon-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      color: var(--devui-title-text);
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--devui-secondary-button-bg);
      }
    }
  }

  // 抽屉内容区：内边距和高度控制
  .drawer-content {
    flex: 1;
    padding: 18px 0px;
    box-sizing: border-box;
    height: 0;
    // Tabs组件：深色主题适配
    .data-tabs {
      width: 100%;
      height: 100%;

      :deep(div[role="tabpanel"]) {
        height: 100%;
        overflow-y: auto;
      }

      .call-record {
        height: 100%;
        width: 100%;
      }


      // 页签面板：内边距控制
      .data-tabs__pane {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 3px 0px;
        margin: 0px;
        // 搜索框：样式适配
        .search-input {
          width: 200px;
          border-radius: 6px !important;
          // 搜索图标：颜色适配
          .search-input__icon {
            display: flex;
            align-items: center;
            width: 20px;
            height: 20px;
            color: var(--devui-node-label-text);
          }
        }
      }

      // 表格组件
      .content-table {
        width: 100%;
        height: calc(100% - 60px);
        margin-top: 16px;
        border-radius: 12px 12px 0 0;
        //表头
        :deep(.header-container) {
          padding: 0 !important;
          //表头左侧
          .table-header-left {
            display: flex;
            align-items: center;
            justify-content: start;
            padding-left: 12px;
            box-sizing: border-box;
          }

          //表头左侧
          .table-header-right {
            display: flex;
            align-items: center;
            justify-content: start;
            box-sizing: border-box;
            padding-left: 12px;
          }
        }

        //左leaf cell
        .table-leaf-sell {
          width: 100%;
          padding-left: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          .callee-sell-name {
            color: var(--devui-primary-text);
            font-size: 13px;
            line-height: 20px;
          }
        }

        //右callee cell
        .table-callee-sell {
          display: flex;
          justify-content: start;
          align-items: center;
          width: 140px;
          padding-left: 12px;

          .callee-sell-count {
            width: 24px;
            color: var(--devui-primary-text);
            font-size: 13px;
          }

          .callee-sell-progress {
            padding-left: 4px;
            width: 80px;
          }
        }

        :deep( .is-left) {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        //表格中的排序小图标
        .sort {
          margin: 0;
          padding-right: 3px;
          padding-left: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          z-index: 9999;

          .icon-sort {
            margin-left: 10px;
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }

        :deep(.devui-table_cell) {
          overflow: visible;
        }
      }
    }
  }
}


// 空数据提示：样式适配
.empty-tip {
  padding-top: 16px;
  text-align: center;
  color: var(--devui-primary-text);
  font-size: 14px;
}

//搜索栏穿透修改
:deep(.devui-input__wrapper) {
  width: 200px;
  height: 28px;
  box-sizing: border-box;
  border: 1px solid var(--devui-button-group-bg);
  border-radius: 6px;
  background-color: var(--control-flow-tab-bg) !important;
}

//页签穿透修改
:deep(.devui-tabs__nav--options ) {
  background-color: var(--control-flow-tab-bg);
  box-sizing: border-box;
  padding: 2px;

  li {
    background-color: var(--control-flow-tab-bg);

    a {
      color: var(--devui-secondary-text);
    }
  }

  //页签选中穿透修改
  .active {
    background-color: var(--control-flow-tab-active-bg);
    border-radius: 4px;

    .devui-tabs__nav-content {
      a {
        color: var(--devui-title-text) !important;
      }
    }
  }
}

//表头背景色穿透
:deep(.devui-table__thead ) {
  height: 32px;

  tr {
    background-color: var(--control-flow-table-header) !important;

    th:nth-child(3) {
      width: 0;
      display: none;
    }
  }
}

//表格row穿透背景色
:deep(.devui-table__tbody) {
  tr {
    background-color: var(--devui-card-bg) !important;
  }

  .devui-table__row {
    &:hover {
      background-color: var(--control-flow-table-hover) !important;
    }
  }

  tr {
    height: 32px;

    td {
      padding: 0 !important;
    }

    td:nth-child(3) {
      width: 0;
      display: none;
    }
  }
}

:deep(.devui-table) {
  scrollbar-width: none !important;
}

:deep(.devui-table__fix-header) {
  scrollbar-width: none !important;

}

.content-table__expand-column {
  // 展开内容区：样式适配
  background-color: var(--devui-nest-bg);
  font-size: 13px;
  line-height: 20px;
  box-sizing: border-box;

  &:hover {
    background-color: var(--devui-nest-bg);
  }

  .expand-content {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    padding-left: 12px;
    align-self: start;
    border-bottom: 1px solid var(--devui-split-line);
    height: 32px;

    &:hover {
      background-color: var(--devui-input-hover-bg);
    }
  }

  .expand-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--devui-split-line);
    min-height: 32px;

    &:hover {
      background-color: var(--devui-input-hover-bg);
    }

    .expand-row_title {
      display: flex;
      flex-wrap: wrap;
      justify-content: start;
      width: 286px !important;
      box-sizing: border-box;
      word-break: break-all;
      padding-top: 4px;
      padding-bottom: 4px;
      padding-left: 24px;
      padding-right: 18px;
    }

    .expand-row_frequency {
      display: flex;
      flex: 1;
      justify-content: start;
      flex-direction: row;
      align-items: center;
      box-sizing: border-box;
      padding-left: 10px;

      .expand-row_frequency_name {
        width: 24px;
      }

      .expand-row_frequency_progress {
        .expand-row-progress {
          padding-left: 8px;
          width: 80px;
        }
      }
    }
  }
}

:deep(colgroup) {
  col:nth-child(3) {
    width: 0px !important;
    display: none;
  }
}
</style>
<style lang="less">

.devui-drawer--right {
  background-color: var(--devui-card-bg) !important;
  width: 480px !important;
  padding: 20px !important;
  height: 100vh;
  box-sizing: border-box;
}

</style>