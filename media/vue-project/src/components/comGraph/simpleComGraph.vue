<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
 <template>
  <div class="simple-com-graph-container show-sticky-block">
    <div class="sticky-block">
      <div class="simple-layout">
        <fileSelect :file-name="comFileName" :file-paths="filePaths" />
        <d-select
          ref="rootHashEl"
          v-if="rootHashList.length > 0"
          :key="selectKey"
          v-model="rootHashPath"
          :placeholder="t('comGraph.pleaseSelect')"
          :position="['bottom-start']"
          :class="['simple-com-root-hash-list', isLoading && 'not-allow-expand', 'ml20']"
          :menu-class="`simple-com-root-hash-list-menu`"
          @value-change="handleHashChange"
        >
        <d-option v-for="(item, index) in rootHashList" :key="index" :value="item.name" :title="item.name">
          <div class="option-item">
            <span v-if="item.graphtype ?? false" :class="['module-row-graph-type', item.graphtype]">{{ item.graphtype }}</span>
            <span class="option-name">{{ item.name }}</span>
          </div>
        </d-option>
          <template #empty>
            <div class="simple-com-root-hash-empty">{{ t('comGraph.noData') }}</div>
          </template>
        </d-select>
      </div>
      <DragIcon />

      <div :class="['sticky-block-right', isExpandSearch && 'expand-search']">
        <d-tooltip
          v-if="drillDownPathIcon.showBack"
          :content="t('pleaseUnlock')"
          :disabled="!drillDownPathIcon.disableBack"
          position="top-end"
          overlay-class="unlock-label-tips"
        >
          <i :class="['icon-arrow-left-l', drillDownPathIcon.disableBack && 'disabled-back-icon']" @click="onBackGraph"></i>
        </d-tooltip>
        <i v-if="drillDownPathIcon.showForward" class="icon-arrow-right-l" @click="onForwardGraph"></i>
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
    <ComGraphMinimap ref="minimapEl" :width="200" :height="124"></ComGraphMinimap>
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
    <div v-if="showGuideAnchor" id="guideThreeColumn" class="guide-three-column-anchor"></div>
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, ref, inject, computed, nextTick, onBeforeUnmount, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphHeader from './comGraphHeader.vue';
import ComGraphMinimap from './comGraphMinimap.vue';
import Loading from './loading.vue';
import { comGraphStore } from '../../service/com-graph-store';
import NodeDetail from './nodeDetail/nodeDetail.vue';
import { debounce } from 'lodash-es';
import { ThreeColumnProvideKey, type IThreeColumnCtx } from '../threeColumn/types';
import DragIcon from '../threeColumn/drag-icon.vue';
import fileSelect from '../threeColumn/file-select.vue';
import { useViewServer } from '../../core/use-view-server';
import type { IComViewServer } from '../../../../../src/core/view/view-server-interface';
import { findNodeIdsBySemanticLabel } from '../../utils/search';
import { ThreeColumnServer } from '../../../../../src/core/view/three-column-server';
import type { DrillDownPathItem } from './type';
import { GraphType } from './type';
import { useFourColumnGraphLinkage, type OpSelection } from './hooks/use-four-column-graph-linkage';
const { server: threeColumnServer } = useViewServer<ThreeColumnServer>();

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
  isThreeMode: {
    type: Boolean,
    default: true,
  },
  comFileName: {
    type: String,
    default: '',
  },
  shouldUpdateHashList: {
    type: Boolean,
    default: false,
  },
  filePaths: {type: Object, default: {}},
});

const { isDarkTheme } = inject('root');
const { isComGraphFullscreen, currentActiveBlock, BlockToGraphMap, onToggleComGraphFullscreen } = inject(
  ThreeColumnProvideKey,
) as IThreeColumnCtx;

const { server } = useViewServer<IComViewServer>();
const isLoading = ref(false);
const showGuideAnchor = ref(false);
const loadingText = ref('');
const warningText = ref('');
const graphType = ref('');
const rootHash = ref('');
const rootHashPath = ref('');
const rootHashList = ref<(Record<'name' | 'value', string> & { graphtype?: string })[]>([]);
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
let centerNodeAction;
let selectAction;
let hoverFeedbackAction;
let createSelectNodesRect;
let createSelectNodesRectByIds;
let removeSelectNodesRect;
let updateModelAction;
let initComDocText;
let resetModelSource;
let fitToScreenAction;
// 跨 leaf 下钻是异步的（innerGetSubgraph → 重新渲染 → layoutEnding），
// 待渲染完成后执行的视觉动作统一挂这里（py 精确选中 / CCE hover / CCE 锁定共用）
let pendingApply: (() => void) | null = null;
let drillDownPath: DrillDownPathItem[] = [];
let currentPath: DrillDownPathItem;
const drillDownPathIcon = reactive({
  showBack: false,
  disableBack: false,
  showForward: false,
});
const showNodeDetail = ref(false);
const nodeId = ref('');
const containerHeight = ref(0);
const isExpandSearch = ref(false);
const comGraphHeaderEl = ref();
const rootHashEl = ref();
const isComGraphActive = ref(false);
const minimapEl = ref();
watch(
  currentActiveBlock,
  (val) => {
    if (val) {
      isComGraphActive.value = BlockToGraphMap[val] === 'comGraph';
      if (!isComGraphActive.value) {
        isExpandSearch.value = false;
        comGraphHeaderEl.value?.hideDropdown();
        rootHashEl.value?.toggleChange(false);
      }
    }
  },
  { immediate: true },
);

window.addEventListener('message', (event) => {
  if (event.data.type === 'postLayoutResult') {
    isLoading.value = false;
    loadingText.value = '';
    showGuideAnchor.value = true;
  }
});

// py 悬停 label 通道：与 label 同名的节点保持常规颜色，只套渐变背景框。
// 走 byIds 而非 createSelectNodesRect(label)：后者会置 selectedNodeSemanticLabel，
// 把同 label 节点染成高亮色、并把框外节点连带置灰。
(window as any).ascEventBus.on('returnSemanticLabelFromCode', (args) => {
  if (comGraphStore.data.isNodeRectLock) {
    return; // 锁定期间悬停不覆盖，与 rect_node_hover / returnOpFromCce 语义一致
  }
  const label = args?.label;
  const ids = label ? (findNodeIdsBySemanticLabel(comGraphStore.data.jsonData, label) as string[]) : [];
  if (!ids.length) {
    removeSelectNodesRect?.();
    return;
  }
  // 退出上一来源（CCE 单 op 悬停）遗留的节点级着色，保证这批节点是常规颜色
  comGraphStore.setData('fourColFocusNodeIds', []);
  comGraphStore.setData('fourColDimNodeIds', []);
  // isLocate=true：与其余跨栏入口（泳道悬停/锁定/py 行悬停）一致，框选后 fit 视口保证整个框可见
  createSelectNodesRectByIds?.(ids, true);
  updateModelAction?.();
});

// 规避锁定时泳道图发送消息，重新创建框选时，框选消失的问题
let prevent = false;
let currentLockLabel: string = '';
let sendlist;
let clickLabel: string = '';
let currentHoverLabel: string = '';

// 泳道点击在途：跳图归属 activeLockFromSwim → applySwimVisual，sendHashList 整段让位。
// 泳道 event-hint 形如
//   Task:[0-0-87], rootHash:196978988935989036, callOpMagic:10032, leafHash:1214246419424137219, TaskId:87
// 其中 leafHash 才是 task 对应的子图，而 rootHash 对同一泳道图里全部 task 都相同（且等于入口层），
// 按它跳图落不到被点击的子图；sendHashList 的 payload 又只有 rootHashList、拿不到 leafHash。
// 也不能用「当前图是否已含 currentLockLabel 的节点」这条启发式判跳：root 层同样带该 label 的节点
// （ffn_dense 的 root 就有 69 个 cast 节点），会误判「已含」。
let swimLockJumpPending = false;

/** 泳道给来的 hash 需能在 calleeMap 里解析出 func_magicname 才能用于跳图，否则返回空串 */
function resolvableSwimHash(hash?: any): string {
  const meta = hash ? (comGraphStore.data.calleeMap ?? {})[String(hash)] : undefined;
  return meta?.func_magicname ? String(hash) : '';
}

/**
 * 泳道 task → 计算图节点分类。节点「所属 hash」分层取：ROOT 层的 CALL 节点带 calleehash
 * （gt2 层 109/109 都带，指向被调 leaf），leaf 层的节点没有 calleehash，一律属于当前渲染子图。
 *   A = label 相同且所属 hash == leafHash
 *   B = label 相同但所属 hash != leafHash
 * 框恒覆盖 A∪B；下钻进 leaf 后所有节点都属于该 leaf，B 自然为空。
 */
function classifySwimNodes(label: string, leafHash: string): { a: string[]; b: string[] } {
  const graph = (comGraphStore.data.jsonData ?? {}) as any;
  const cur = currentGraphHash();
  const a: string[] = [];
  const b: string[] = [];
  const put = (owner: string, id: string) => {
    (owner === String(leafHash) ? a : b).push(id);
  };
  for (const op of graph.operations ?? []) {
    if ((op?.semantic_label?.label ?? '') !== label) {
      continue;
    }
    const sub = op.subgraphid !== undefined ? op.subgraphid : -1;
    put(op.calleehash != null ? String(op.calleehash) : cur, `operation-magic-${op.opmagic}-${sub}`);
  }
  for (const tensor of graph.tensors ?? []) {
    if ((tensor?.semantic_label?.label ?? '') !== label) {
      continue;
    }
    const sub = tensor.subgraphid !== undefined ? tensor.subgraphid : -1;
    put(tensor.calleehash != null ? String(tensor.calleehash) : cur, `tensor-${tensor.magic}-${sub}`);
  }
  return { a, b };
}

/** task 只有 leafHash、没有 label 时按「整张子图」处理：当前图全部 op 与 tensor 节点 */
function allSwimGraphNodeIds(): string[] {
  const graph = (comGraphStore.data.jsonData ?? {}) as any;
  const ids: string[] = [];
  for (const op of graph.operations ?? []) {
    ids.push(`operation-magic-${op.opmagic}-${op.subgraphid !== undefined ? op.subgraphid : -1}`);
  }
  for (const tensor of graph.tensors ?? []) {
    ids.push(`tensor-${tensor.magic}-${tensor.subgraphid !== undefined ? tensor.subgraphid : -1}`);
  }
  return ids;
}

/**
 * 泳道 task → 计算图视觉。
 *   有 label：悬浮 A 高亮色 / B 常规色 / A∪B 渐变框；锁定 A 常规色 / B 置灰 / A∪B 蓝色框+锁图标
 *   无 label：整张子图常规色，悬浮渐变框、锁定蓝色框
 * 悬浮不切子图（与三栏悬停一致）；锁定在当前图层不是该 leafHash 子图时切过去，
 * 渲染完成后由 pendingApply 套用（与 applyCceVisual / applyOpsSelection 同一套 layoutEnding 机制）。
 */
function applySwimVisual(label: string, leafHash: string, mode: 'hover' | 'lock') {
  const isLock = mode === 'lock';
  const run = () => {
    const sets = label ? classifySwimNodes(label, leafHash) : { a: allSwimGraphNodeIds(), b: [] as string[] };
    const ids = [...sets.a, ...sets.b];
    if (!ids.length) {
      removeSelectNodesRect?.();
      return;
    }
    if (isLock) {
      comGraphStore.data.isNodeRectLock = true;
      drillDownPathIcon.disableBack = true;
      comGraphStore.setData('fourColFocusNodeIds', []);
      comGraphStore.setData('fourColDimNodeIds', [...sets.b]);
    } else {
      comGraphStore.setData('fourColFocusNodeIds', label ? [...sets.a] : []);
      comGraphStore.setData('fourColDimNodeIds', []);
    }
    createSelectNodesRectByIds?.(ids, true);
    selectAction?.([]);
    updateModelAction?.();
  };
  if (!isLock) {
    run();
    return;
  }
  // 「当前图有结果」= 当前图层就是该 task 的 leafHash 子图；否则切过去（切完由 pendingApply 套用）。
  // 不能用「当前图能否分出 A」判定：ROOT 层的 CALL 节点本身就带 (semantic_label, calleehash)，
  // A 在 root 层恒非空，那样点任何 task 都只会高亮 CALL 节点、永远下钻不进 leaf 子图。
  const stay = !leafHash || currentGraphHash() === String(leafHash);
  if (stay || !resolvableSwimHash(leafHash)) {
    run();
    return;
  }
  pendingApply = run;
  drillToLeaf(String(leafHash));
}

/**
 * 泳道 task → returnOpsFromCom。ops 必须是 leaf 层编号：root 层 CALL 的 opmagic 在
 * fourcol_py_impl 里没有实现行（gt2 层实现行数为 0），py/CCE 栏按 (hash, opmagic) 反查会落空。
 * label 为空代表整张子图，取该 leaf 的全部 op。
 */
async function emitSwimOps(label: string, leafHash: string): Promise<void> {
  if (!leafHash) {
    (window as any).ascEventBus.emit('returnOpsFromCom', { source: 'swim', hash: '', ops: [] });
    return;
  }
  const res = await threeColumnServer.resolveSwimOps?.({ leafHash, label }).catch(() => null);
  (window as any).ascEventBus.emit('returnOpsFromCom', { source: 'swim', hash: leafHash, ops: res?.ops ?? [] });
}

function onMessageFromSwim(args) {
  if (prevent) {
    prevent = false;
    return;
  }
  const label = args?.label ?? '';
  const leafHash = args?.leafHash ?? '';
  // 锁定期间泳道悬停不覆盖框选，与 rect_node_hover / rect_node_leave / returnOpFromCce / py label 通道
  // 是同一约定；ops 广播不受锁定影响照发，py/CCE 栏自带 isLocked 守卫，不会因此丢失各自的锁定态
  if (!comGraphStore.data.isNodeRectLock) {
    if (label || leafHash) {
      currentHoverLabel = label;
      applySwimVisual(label, leafHash, 'hover');
    } else {
      removeSelectNodesRect?.();
    }
  }
  void emitSwimOps(label, leafHash);
  sendlist = args.rootHashList;
  if (args.rootHashList?.length) {
    // curPath 是后端下发的 JSON 字符串，按下标取会得到最后一个字符，必须走 currentGraphHash()。
    // rootHash 供 rect_node_hover 的 emitOpsFromLeaf、returnSemanticLabelFromCom 与
    // currentGraphHash 的兜底读取，这里与当前渲染层保持同步。
    const cur = currentGraphHash();
    if (cur) {
      rootHash.value = cur;
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
    createSelectNodesRect?.(args.semanticLabel, false);
    (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label: args.semanticLabel, rootHash: rootHash.value });
  }
  // 四联动：op 节点悬停 → py/CCE 栏按 (leafHash, opmagic) 描边
  const opMagic = extractOpMagic(args.nodeId);
  if (opMagic != null && rootHash.value) {
    void emitOpsFromLeaf('com', rootHash.value, [opMagic]);
  }
});
(window as any).ascEventBus.on('rect_node_leave', () => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  removeSelectNodesRect?.();
  (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label: '' });
  (window as any).ascEventBus.emit('returnOpsFromCom', { source: 'com', hash: '', ops: [] });
});

/** 在当前图 jsonData 里按 opmagic 定位节点 id 与它的 semantic label */
function findOpNodeInGraph(opmagic: number | string): { nodeId: string; label: string } | null {
  const graph = (comGraphStore.data.jsonData ?? {}) as any;
  const op = (graph.operations ?? []).find((o: any) => String(o.opmagic) === String(opmagic));
  if (!op) {
    return null;
  }
  const subgraphid = op.subgraphid !== undefined ? op.subgraphid : -1;
  return { nodeId: `operation-magic-${op.opmagic}-${subgraphid}`, label: op.semantic_label?.label ?? '' };
}

/** 下钻到指定 leaf。跨 leaf 时目标节点根本不在当前图里，必须先切图 */
function drillToLeaf(leafHash: string) {
  const name = (comGraphStore.data.calleeMap?.[leafHash]?.func_magicname ?? leafHash).replace(/^TENSOR_/i, '');
  rootHash.value = leafHash;
  onHashChange({ value: leafHash, name });
}

/**
 * CCE 行 → 计算图视觉。B = 与该行同 opmagic 的节点，b = 与 B 同 label 的其余节点：
 *   hover：B 高亮色、b 常规色，B+b 渐变背景框
 *   lock ：B 常规色、b 置灰，  B+b 蓝色背景框（isNodeRectLock 驱动 getRectStrokeColor）
 * leafHash 与当前图不一致时先下钻，等 layoutEnding 后再套用（原实现在此直接 return，即「拦截」）。
 */
function applyCceVisual(opmagic: number | string, leafHash: string, mode: 'hover' | 'lock') {
  const run = () => {
    const hit = findOpNodeInGraph(opmagic);
    if (!hit) {
      return;
    }
    // B+b = 当前图里同 label 的全部节点（含 B）；无 label 时退化为只有 B
    const group = hit.label
      ? (findNodeIdsBySemanticLabel(comGraphStore.data.jsonData, hit.label) as string[])
      : [hit.nodeId];
    const isLock = mode === 'lock';
    comGraphStore.setData('fourColFocusNodeIds', isLock ? [] : [hit.nodeId]);
    comGraphStore.setData('fourColDimNodeIds', isLock ? group.filter((id) => id !== hit.nodeId) : []);
    if (isLock) {
      prevent = true;
      currentLockLabel = hit.label;
      comGraphStore.data.isNodeRectLock = true;
      drillDownPathIcon.disableBack = true;
    }
    createSelectNodesRectByIds?.(group, isLock);
    selectAction?.(isLock ? [] : [hit.nodeId]);
    updateModelAction?.();
  };
  if (currentGraphHash() === String(leafHash)) {
    run();
    return;
  }
  pendingApply = run;
  drillToLeaf(String(leafHash));
}

// CCE 行悬停 → B 高亮 + B+b 渐变框；leafHash 不同不再拦截，改为切图后套用
(window as any).ascEventBus.on('returnOpFromCce', (args) => {
  if (comGraphStore.data.isNodeRectLock) {
    return; // 锁定期间悬停不覆盖，与 rect_node_hover 语义一致
  }
  const opMagic = args?.opmagic;
  const leafHash = args?.hash;
  if (!opMagic || !leafHash) {
    // cceColumn 悬停离开发 {opmagic:0, hash:''} → 清除四联动视觉
    comGraphStore.setData('fourColFocusNodeIds', []);
    comGraphStore.setData('fourColDimNodeIds', []);
    removeSelectNodesRect?.();
    return;
  }
  applyCceVisual(opMagic, String(leafHash), 'hover');
});

// CCE 行点击 → B+b 蓝色框 + b 置灰；leafHash 不同则先切图
(window as any).ascEventBus.on('activeLockFromCce', (args) => {
  const opMagic = args?.opmagic;
  const leafHash = args?.hash;
  if (!opMagic || !leafHash) {
    return;
  }
  applyCceVisual(opMagic, String(leafHash), 'lock');
});

// leafHash → 该 leaf 的 opmagic 列表（悬停时返回全部；带指定 ops 时原样透传）
async function emitOpsFromLeaf(source: string, leafHash: string, ops: number[]) {
  if (!leafHash) {
    (window as any).ascEventBus.emit('returnOpsFromCom', { source, hash: '', ops: [] });
    return;
  }
  if (ops.length) {
    (window as any).ascEventBus.emit('returnOpsFromCom', { source, hash: leafHash, ops });
    return;
  }
  const res = await threeColumnServer.resolveOpsFromLeaf?.({ leafHash }).catch(() => null);
  const leafOps: number[] = res?.ops ?? [];
  (window as any).ascEventBus.emit('returnOpsFromCom', { source, hash: leafHash, ops: leafOps });
}

(window as any).ascEventBus.on('activeLock', (args) => {
  lockGraphByLabel(args.label);
});
// 泳道点击锁定的图侧入口：按 (label, leafHash) 分类上色并进入锁定态（蓝色框 + 锁图标），
// 解锁由 deactivateLock 统一退出。跳图也由这里负责——只有 applySwimVisual 能判断当前图
// 是否已分出 A 节点，故置 swimLockJumpPending 让随后的 sendHashList 不再跳一次。
// 刻意不调 lockGraphByLabel：
//   1) 它会置 prevent，把随后 debounce 100ms 到达的 onMessageFromSwim 整个吞掉，
//      而后者还负责 emitSwimOps 把 ops 广播给 py/CCE 栏；
//   2) 它会写 currentLockLabel，使 watcher 里「子图重建后补画框」的补偿走 createSelectNodesRect(label)，
//      与这里的 A∪B byIds 框互相覆盖。补画改走 pendingApply（layoutEnding 触发）。
(window as any).ascEventBus.on('activeLockFromSwim', (args) => {
  const label = args?.label ?? '';
  const leafHash = args?.leafHash ?? '';
  if (!label && !leafHash) {
    return;
  }
  swimLockJumpPending = true;
  applySwimVisual(label, leafHash, 'lock');
  hoverFeedbackAction?.();
});
(window as any).ascEventBus.on('sendHashList', (args) => {
  generateHashList(args.rootHashList ?? []);
  // 泳道点击的跳图已由 activeLockFromSwim → applySwimVisual 负责（只有它知道当前图层是否已是
  // 目标 leafHash 子图），这里必须整段让位：再跳一次会让同一次点击触发两次子图重载，
  // 且尾部 selectPassPath 会拿到切换前的 hash、把面包屑填成上一层的 pass 副本。
  // 跳图完成后 watcher 会用 generateHashList() 全量重建面包屑，无需在此维护。
  if (swimLockJumpPending) {
    swimLockJumpPending = false;
    return;
  }
  // curPath 是后端下发的 JSON 字符串，按下标取会得到最后一个字符，必须走 currentGraphHash()
  const currentHash = currentGraphHash();
  const selectedNodes = findNodeIdsBySemanticLabel(comGraphStore.data.jsonData, currentLockLabel);
  if (selectedNodes.length <= 0 && rootHashList.value.length) {
    rootHash.value = rootHashList.value[0].value;
    drillDownPath = [currentPath, { calleehash: rootHashList.value[0].value, subFuncmagicname: rootHashList.value[0].name }];
    drillDownPathIcon.showBack = true;
    drillDownPathIcon.disableBack = true;
    drillDownPathIcon.showForward = false
    // 目标就是当前子图时不重载：重载会经 resetModelSource + initComDocText 整体重建 sprotty model，
    // 已画好的框要等 _view_zoom / layoutEnding 补偿才会恢复，同 hash 反复锁解锁时会表现为无反应
    if (String(rootHashList.value[0].value) !== currentHash) {
      onHashChange(rootHashList.value[0]);
    }
    return;
  }
  const curMeta = comGraphStore.data.calleeMap?.[currentHash];
  if (curMeta?.func_magicname && rootHashList.value.every((item) => item.value !== currentHash)) {
    const splitFileName = curMeta.func_magicname.replace(/^TENSOR_/i, '');
    const tag = GraphType[curMeta.graphtype];
    const splitTag = tag?.replace(/_GRAPH$/, '') ?? '';
    rootHashList.value.unshift({ name: splitFileName, value: currentHash,  graphtype: splitTag});
  }
  if (currentHash) {
    threeColumnServer.selectPassPath({ paramObj: { calleehash: currentHash } });
  }
});

function resetDrillDownPathIcon() {
  drillDownPathIcon.disableBack = false;
  drillDownPathIcon.showBack = false;
  drillDownPathIcon.showForward = false;
}

function onBackGraph() {
  if (drillDownPathIcon.disableBack) {
    return;
  }
  drillDownPathIcon.showBack = false;
  drillDownPathIcon.showForward = true;
  rootHash.value = drillDownPath[0].calleehash;
  server.innerGetSubgraph({ paramObj: drillDownPath[0] });
}

function onForwardGraph() {
  drillDownPathIcon.showBack = true;
  drillDownPathIcon.showForward = false;
  server.innerGetSubgraph({ paramObj: drillDownPath[1] });
  rootHash.value = drillDownPath[1].calleehash;
}

function autoDrillCb(args) {
  clickLabel = args.label;
  generateHashList(sendlist ?? []);
  const selectedNodes = findNodeIdsBySemanticLabel(comGraphStore.data.jsonData, args.label);
  if (selectedNodes.length <= 0 && rootHashList.value.length) {
    rootHash.value = rootHashList.value[0].value;
    drillDownPath = [currentPath, { calleehash: rootHashList.value[0].value, subFuncmagicname: rootHashList.value[0].name }];
    drillDownPathIcon.showBack = true;
    drillDownPathIcon.showForward = false
    onHashChange(rootHashList.value[0]);
  }
  generateHashList();
}
(window as any).ascEventBus.on('returnSemanticLabelFromCodeClick', autoDrillCb);
(window as any).ascEventBus.on('swimSelectModeChange', (args) => {
  if (args.selectMode) {
    autoDrillCb({ label: currentHoverLabel });
  }
});

watch(threeColumnServer.GetPassPath, (newValue) => {
  if (!newValue.data) return;
  newValue.data.forEach((fullPath: string) => {
    const fileName = fullPath.replace(/^.*[\\/]/, '');
    rootHashList.value.push({ name: fileName, value: fullPath });
  });
});

(window as any).ascEventBus.on('deactivateLock', () => {
  prevent = false;
  lockedOpNodeIds = [];
  lockedOpActiveIndex = 0;
  comGraphStore.data.isNodeRectLock = false;
  drillDownPathIcon.disableBack = false;
  // 复位锁定 label：sendHashList 用 findNodeIdsBySemanticLabel(jsonData, currentLockLabel) 判断
  // 当前图是否已含锁定目标，残留会让它误判为「已含」而跳过跳图分支
  currentLockLabel = '';
  // 「确实有框要清」才清：label 语义框（selectedNodeSemanticLabel，泳道悬停/锁定走这条）
  // 与四联动节点级框（fourCol* 数组，CCE/py 行联动走这条）任一存在都要清；
  // 漏掉 selectedNodeSemanticLabel 会导致解锁后它不复位，同 label 二次锁定时
  // createSelectNodesRect 内部 `selectedNodeSemanticLabel !== label` 为假而跳过重建，表现为联动失效
  // 同时也要清 py 行两级配色（lockedOpNodeIds + fourColMatchedNodeIds + fourColActiveNodeIds）
  if (
    comGraphStore.data.selectedNodeSemanticLabel ||
    comGraphStore.data.fourColFocusNodeIds?.length ||
    comGraphStore.data.fourColDimNodeIds?.length ||
    comGraphStore.data.fourColRectNodeIds?.length ||
    comGraphStore.data.fourColMatchedNodeIds?.length ||
    comGraphStore.data.fourColActiveNodeIds?.length
  ) {
    setOpNodeHighlight([], 'none');
    removeSelectNodesRect?.();
    updateModelAction?.();
  }
  hoverFeedbackAction?.();
  generateHashList();
});
(window as any).ascEventBus.on('threeColumnSizeChange', ({ comGraphVisible }) => {
  if (comGraphVisible) {
    window.dispatchEvent(new Event('resize'));
    minimapEl.value.updateScaleRation();
    const fitTimer = setTimeout(() => {
      fitToScreenAction?.();
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
      const jsonFile = comGraphStore.data.calleeMap[item].func_magicname;
      const splitName = jsonFile.replace(/^TENSOR_/i, '');
      const tag = GraphType[comGraphStore.data.calleeMap[item].graphtype];
      const splitTag = tag?.replace(/_GRAPH$/, '') ?? '';
      rootHashList.value.push({ name: splitName, value: item, graphtype: splitTag });
    }
  } else {
    const tempHashList = Object.keys(comGraphStore.data.calleeMap);
    for (let i = 0; i < tempHashList.length; i++) {
      const item = tempHashList[i];
      const jsonFile = comGraphStore.data.calleeMap[item].func_magicname;
      const splitName = jsonFile.replace(/^TENSOR_/i, '');
      const tag = GraphType[comGraphStore.data.calleeMap[item].graphtype];
      const splitTag = tag?.replace(/_GRAPH$/, '') ?? '';
      rootHashList.value.push({ name: splitName, value: item, graphtype: splitTag});
    }
  }
}

const handleHashChange = (val) => {
  const selectedItem = rootHashList.value.find(item =>
    String(item.name) === String(val)
  );
  resetDrillDownPathIcon();
  if (selectedItem) {
    rootHash.value = selectedItem.value;
  }
  onHashChange(selectedItem);
};
const onHashChange = (val) => {
  server.innerGetSubgraph({ paramObj: { calleehash: val.value, subFuncmagicname: val.name } });
};

const extractOpMagic = (nodeId?: string): number | undefined => {
  if (!nodeId) {
    return undefined;
  }
  const m = nodeId.match(/operation-magic-(\d+)/);
  return m ? Number(m[1]) : undefined;
};

/**
 * 当前渲染子图的 hash。
 * 不能直接用 comGraphStore.data.curPath 下标：GraphData.curPath 是 JSON 字符串，
 * 字符串按下标取会得到最后一个字符（曾导致点击计算图节点拿不到 leafHash、联动全失效）。
 */
function currentGraphHash(): string {
  const graph = (comGraphStore.data.jsonData ?? {}) as any;
  if (graph.hash != null) {
    return String(graph.hash);
  }
  const raw = comGraphStore.data.curPath;
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw || '[]');
    } catch {
      list = [];
    }
  }
  const last = Array.isArray(list) && list.length ? list[list.length - 1] : rootHash.value;
  return last != null ? String(last) : '';
}

// 已广播的子图 hash：jsonContent 重复触发（如主题变化）时不重复广播
let lastNotifiedSubgraphHash = '';

// CCE 文件切换 → 按文件 funcHash 强绑计算图子图：hash 与当前子图一致（含主/尾块副本互换）时不动作；
// 图中无此 hash 时广播未解析，CCE 栏以"暂无关联对象"遮罩提示
const onCceFileSwitched = (args: { hash?: string }) => {
  const hash = args?.hash;
  if (!hash || hash === currentGraphHash()) {
    return;
  }
  const calleeMap = comGraphStore.data.calleeMap;
  // calleeMap 未就绪（图数据未到位）不判定，保持静默
  if (!calleeMap || !Object.keys(calleeMap).length) {
    return;
  }
  const funcMeta = calleeMap[hash];
  if (!funcMeta?.func_magicname) {
    (window as any).ascEventBus.emit('cceFileSwitchUnresolved', { hash });
    return;
  }
  resetDrillDownPathIcon();
  rootHash.value = hash;
  onHashChange({ value: hash, name: funcMeta.func_magicname.replace(/^TENSOR_/i, '') });
};

let pendingSelection: { nodeId: string; label: string | null; lock: boolean } | null = null;

/**
 * 进入锁定态。isNodeRectLock 是图内所有锁定判断的唯一开关
 * （rect_node_hover / rect_node_leave / onMessageFromSwim 都靠它跳过悬停覆盖），
 * 不置位的话任何一次悬停都会把选中冲掉，表现为「点了没锁住」。
 */
function lockGraphByLabel(label: string) {
  prevent = true;
  currentLockLabel = label;
  comGraphStore.data.isNodeRectLock = true;
  drillDownPathIcon.disableBack = true;
  // 不做 if (label) 短路：createSelectNodesRect('') 内部会走 removeSelectNodesRect()，
  // 这是 activeLock 空 label（如 onLockClick 的 selectedNodeSemanticLabel 为 ''）时的原有清框语义
  createSelectNodesRect?.(label, true);
  hoverFeedbackAction?.();
}

// 下钻渲染完成后执行挂起的视觉动作（layoutEnding 触发）
function flushPendingSelection() {
  if (!pendingApply) {
    return;
  }
  const run = pendingApply;
  pendingApply = null;
  run();
}

/**
 * 严格本图匹配：仅当「当前渲染子图 hash === op.leafHash」且「该 opmagic 确实在当前图 operations 里」才算命中。
 * opmagic 不是全局唯一（ffn_dense 5664 个值里有 590 个跨 function 重复），必须叠加 hash 判定，
 * 否则会把 root 层同编号的 CALL 节点或别的 leaf 的 op 误当成目标高亮。
 * 命中多个时全部返回（悬停要多高亮），并用图里的 subgraphid 拼 node id 以保证该 id 必然存在。
 */
function matchLocalOpNodes(ops: OpSelection[]): { ids: string[]; chosen: OpSelection | null } {
  const cur = currentGraphHash();
  const graphOps: any[] = ((comGraphStore.data.jsonData ?? {}) as any).operations ?? [];
  const ids: string[] = [];
  let chosen: OpSelection | null = null;
  for (const op of ops) {
    if (op.leafHash !== cur) {
      continue;
    }
    const node = graphOps.find((g) => String(g.opmagic) === String(op.opmagic));
    if (!node) {
      continue;
    }
    const id = `operation-magic-${node.opmagic}-${node.subgraphid !== undefined ? node.subgraphid : -1}`;
    if (!ids.includes(id)) {
      ids.push(id);
    }
    if (!chosen) {
      chosen = op;
    }
  }
  return { ids, chosen };
}

let lockedOpNodeIds: string[] = [];
let lockedOpActiveIndex = 0;

/** 按当前下标刷新两级配色：整组压暗/提亮、当前节点保持原色 */
function renderLockedOpHighlight() {
  if (!lockedOpNodeIds.length) {
    return;
  }
  const activeId = lockedOpNodeIds[lockedOpActiveIndex];
  comGraphStore.setData(
    'fourColMatchedNodeIds',
    lockedOpNodeIds.filter((id) => id !== activeId),
  );
  comGraphStore.setData('fourColActiveNodeIds', [activeId]);
}

/**
 * py 行匹配的两级配色：
 *   hover → 命中节点保持原色（浅色），与 label 组的深色重叠处显示浅色
 *   lock  → 整组压暗/提亮 + 首节点保持原色，并记住集合供上下键切换
 */
function setOpNodeHighlight(nodeIds: string[], mode: 'hover' | 'lock' | 'none') {
  lockedOpNodeIds = [];
  lockedOpActiveIndex = 0;
  comGraphStore.setData('fourColMatchedNodeIds', []);
  comGraphStore.setData('fourColActiveNodeIds', []);
  if (mode === 'hover' && nodeIds.length) {
    comGraphStore.setData('fourColActiveNodeIds', [...nodeIds]);
    return;
  }
  if (mode === 'lock' && nodeIds.length) {
    lockedOpNodeIds = [...nodeIds];
    renderLockedOpHighlight();
  }
}

// 锁定态下用上下键在匹配到的节点间切换当前节点
function onFourColArrowKey(event: KeyboardEvent) {
  if (!comGraphStore.data.isNodeRectLock || lockedOpNodeIds.length < 2) {
    return;
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
    return;
  }
  const target = event.target as HTMLElement | null;
  const tagName = target?.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) {
    return;
  }
  event.preventDefault();
  const step = event.key === 'ArrowDown' ? 1 : -1;
  lockedOpActiveIndex = (lockedOpActiveIndex + step + lockedOpNodeIds.length) % lockedOpNodeIds.length;
  renderLockedOpHighlight();
  const activeId = lockedOpNodeIds[lockedOpActiveIndex];
  centerNodeAction?.([activeId]);
  selectAction?.([activeId]);
  updateModelAction?.();
}

// 代码行 → 计算图：优先高亮本图已有的落点，本图没有则切到能匹配 (hash, opmagic) 的子图再高亮。
// 返回最终选中的 op，供 hook 广播 activeLockFromCom / returnOpsFromCom 时与图侧保持一致。
function applyOpsSelection(ops: OpSelection[], opts: { stable: boolean; label?: string }): OpSelection | null {
  if (!ops.length) {
    // 锁定期间保持锁定态的配色，不被空结果清掉
    if (opts.stable || !comGraphStore.data.isNodeRectLock) {
      setOpNodeHighlight([], 'none');
    }
    // label 兜底：点击 label 块内非 op 行（整块首行/中间行）→ 按 label 框选并锁定
    if (opts.stable && opts.label) {
      lockGraphByLabel(opts.label);
      return null;
    }
    if (!opts.stable) {
      // 空白行/无 op 行：渐变框归 py label 通道（returnSemanticLabelFromCode）所有，
      // 这里只退出节点级着色与单选，避免把先一步画好的 label 框冲掉；
      // 清空路径由 label 空串经上面的 returnSemanticLabelFromCode 处理器负责
      comGraphStore.setData('fourColFocusNodeIds', []);
      comGraphStore.setData('fourColDimNodeIds', []);
      selectAction?.([]);
      updateModelAction?.();
    }
    return null;
  }
  const first = ops[0];
  const lockLabel = first.label ?? opts.label ?? '';
  const run = () => {
    // 本图匹配 leafHash+opmagic 双命中的节点，返回 ids + chosen（取 label 用）
    const local = matchLocalOpNodes(ops);
    const nodeIds = local.ids;
    const targetId = nodeIds[0] ?? `operation-magic-${first.opmagic}-${first.subgraphid}`;
    centerNodeAction?.([targetId]);
    selectAction?.([targetId]);
    if (opts.stable) {
      if (nodeIds.length) {
        // 锁定：label 组的既有高亮整体退场，改由节点级两级配色接管
        comGraphStore.data.selectedNodeSemanticLabel = '';
        currentLockLabel = local.chosen?.label ?? lockLabel;
        prevent = true;
        comGraphStore.data.isNodeRectLock = true;
        drillDownPathIcon.disableBack = true;
        createSelectNodesRectByIds?.(nodeIds, true);
        setOpNodeHighlight(nodeIds, 'lock');
        hoverFeedbackAction?.();
      } else {
        lockGraphByLabel(lockLabel);
      }
    } else {
      if (lockLabel) {
        // isLocate=true：框选后 fit 视口，保证整个 label 框选可见（与泳道悬停/点击锁定一致）
        createSelectNodesRect?.(lockLabel, true);
      }
      // 锁定期间悬浮其它行不覆盖锁定态的两级配色
      if (!comGraphStore.data.isNodeRectLock) {
        setOpNodeHighlight(nodeIds, nodeIds.length ? 'hover' : 'none');
      }
    }
    updateModelAction?.();
  };
  // 优先匹配当前图落点（HEAD 的 matchLocalOpNodes 两阶段匹配逻辑）：
  // 本图已有匹配或当前图就是目标子图 → 直接 run，否则下钻后 pendingApply 再 run
  const curLocal = matchLocalOpNodes(ops);
  if (curLocal.ids.length || rootHash.value === first.leafHash) {
    run();
    return curLocal.chosen ?? first;
  }
  pendingApply = run;
  drillToLeaf(first.leafHash);
  return first;
}

const { emitComLock, stepOp } = useFourColumnGraphLinkage({ applyOpsSelection });

const onLocate = (id) => {
  centerNodeAction?.([id]);
  selectAction?.([id]);
};

const LoadingStatusMap = {
  readJson: 'comGraph.readJson',
  convertData: 'comGraph.convertData',
  readJsonWarning: 'comGraph.readJsonWarning',
  rendering: 'comGraph.rendering',
  loading: 'loadTraceData',
};

watch(rootHashPath, () => {
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
    if (val === 'readJson' || val === 'rendering' || val === 'convertData' || val === 'loading') {
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
      // 子图切换广播：hash 变化时通知 CCE 栏按 hash 强绑文件（尾块优先，无尾块回退主块）
      const newHash = val.hash != null ? String(val.hash) : '';
      if (newHash && newHash !== lastNotifiedSubgraphHash) {
        lastNotifiedSubgraphHash = newHash;
        (window as any).ascEventBus.emit('subgraphHashChanged', { hash: newHash });
      }
      const jsonValue = JSON.parse(JSON.stringify(props.jsonContent));
      const funcMagicName = comGraphStore.data.calleeMap?.[val.hash] ?? '';
      if (val.hash && funcMagicName) {
        currentPath = { calleehash: val.hash, subFuncmagicname: funcMagicName };
      }
      if (initComDocText) {
        resetModelSource(true);
        initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic, -1, props.isThreeMode);
        comGraphStore.setData('jsonData', jsonValue);
        server.returnFuncTree();
        let shouldListenViewZoom = true;
        if ((comGraphStore.data.isNodeRectLock && currentLockLabel) || clickLabel) {
          (window as any).ascEventBus.on(`_view_zoom`, () => {
            if (shouldListenViewZoom) {
              comGraphStore.data.selectedNodeSemanticLabel = '';
              createSelectNodesRect?.(comGraphStore.data.isNodeRectLock ? currentLockLabel : clickLabel, true);
              shouldListenViewZoom = false;
            }
          });
        }
        if (props.shouldUpdateHashList) {
          generateHashList();
          resetDrillDownPathIcon();
          const curHash = currentGraphHash();
          if (curHash) {
            rootHash.value = curHash;
          }
        }
        return;
      }
      const sprottyLoadResult = useSprottyLoad();
      initComDocText = sprottyLoadResult.initComDocText;
      initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic, -1, props.isThreeMode);
      centerNodeAction = sprottyLoadResult.centerNodeAction;
      selectAction = sprottyLoadResult.selectAction;
      createSelectNodesRect = sprottyLoadResult.createSelectNodesRect;
      createSelectNodesRectByIds = sprottyLoadResult.createSelectNodesRectByIds;
      removeSelectNodesRect = sprottyLoadResult.removeSelectNodesRect;
      updateModelAction = sprottyLoadResult.updateModelAction;
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
        canViewSubgraph: true,
      });
      generateHashList();
      resetDrillDownPathIcon();
      const curHash = currentGraphHash();
      if (curHash) {
        rootHash.value = curHash;
      }
    }
  },
  { immediate: true },
);

const selectKey = ref(0);
watch([rootHash, rootHashList], ([newHash, newList]) => {
  const item = newList.find(i => i.value === newHash);
  rootHashPath.value = item?.name || '';
  selectKey.value++;
  nextTick(() => {
    const selectInput = rootHashEl.value?.$el.querySelector('input');
    selectInput?.setAttribute('title', rootHashPath.value);
  });
}, { immediate: true, deep: true });

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

function resetToFirstStep(param: Record<string, string>) {
  server.innerGetSubgraph({ paramObj: param });
}

onMounted(() => {
  loadingText.value = t(LoadingStatusMap['loading']);
  isLoading.value = true;
  (window as any).ascEventBus.on('view_mouseup', ({node}) => {
    if (node.type === 'graph' || node.id.startsWith('parent') || node.isEmptyLabel || node.isTokenLabel) {
      showNodeDetail.value = false;
    } else if (node.id.endsWith('label-main')) {
      nodeId.value = node.id;
      const container = document.querySelector('.simple-com-graph-container');
      containerHeight.value = container.getBoundingClientRect().height;
      showNodeDetail.value = true;
    } else {
      // op 节点点击 → activeLockFromCom（四联动点击锁定）
      const opMagic = extractOpMagic(node.id);
      if (opMagic == null) {
        return;
      }
      // 注意：curPath 可能是 JSON 字符串（GraphData.curPath 为 string），不能再按下标取
      const graph = (comGraphStore.data.jsonData ?? {}) as any;
      const graphHash = graph.hash != null ? String(graph.hash) : '';
      const op = (graph.operations ?? []).find((o: any) => String(o.opmagic) === String(opMagic));
      // ROOT 层 CALL 节点：联动目标是它调用的 leaf（服务端取该 leaf 首个 op）
      const calleeHash = op?.calleehash != null ? String(op.calleehash) : '';
      if (calleeHash) {
        void emitComLock(calleeHash);
      } else if (graphHash) {
        void emitComLock(graphHash, opMagic);
      }
    }
  });
  // 上一/下一 op 切换（由菜单/快捷键触发 stepComOp {leafHash?, opMagic, direction}）
  (window as any).ascEventBus.on('stepComOp', (args) => {
    const leafHash = args?.leafHash ?? currentGraphHash();
    if (leafHash && args?.opMagic != null && (args.direction === 1 || args.direction === -1)) {
      void stepOp(leafHash, args.opMagic, args.direction);
    }
  });
  (window as any).ascEventBus.on('layoutEnding', (args) => {
    isLoading.value = false;
    loadingText.value = '';
    showGuideAnchor.value = true;
    flushPendingSelection();
  });
  if (props.loadingStep === 'readJson' || props.loadingStep === 'convertData') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('keydown', onFourColArrowKey);
  (window as any).ascEventBus.on('lockToggleChange', onLockClick);
  (window as any).ascEventBus.on('resetComGraphToFirst', resetToFirstStep);
  (window as any).ascEventBus.on('cceFileSwitched', onCceFileSwitched);
});
onBeforeUnmount(() => {
  if (resetModelSource) {
    resetModelSource(true);
  }
  document.removeEventListener('click', onDocumentClick);
  window.removeEventListener('keydown', onFourColArrowKey);
  (window as any).ascEventBus.remove('lockToggleChange', onLockClick);
  (window as any).ascEventBus.remove('resetComGraphToFirst', resetToFirstStep);
  (window as any).ascEventBus.remove('cceFileSwitched', onCceFileSwitched);
});
</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.simple-com-graph-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--devui-global-bg);
  .guide-three-column-anchor {
    position: absolute;
    top: 50%;
    left: 0%;
    z-index: -1;
    visibility: hidden;
  }

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
    justify-content: flex-end;
    gap: 8px;

    &.expand-search {
      flex-basis: 33.33%;
    }

    i {
      font-size: 14px;
      cursor: pointer;
    }

    .disabled-back-icon {
      color: var(--devui-disabled-text);
      cursor: not-allowed;
    }
  }

  .com-graph-header {
    width: 100%;
    height: 30px;

    &.with-extend-btn {
      height: 150px;
    }

    .toolbar-row {
      min-width: 170px;
      left: 0;
    }

    .module-toolbar-container {
      padding: 0;
      justify-content: flex-end;
    }

    .module-row {
      display: none;
    }
  }

  .simple-com-root-hash-list {
    width: 140px;
    min-width: 100px;

    .devui-select__input {
      height: 28px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.not-allow-expand {
      pointer-events: none;
    }
  }

  #sprotty {
    height: 100%;
  }

  .simple-layout {
    display: flex;
  }

  .simple-containner {
    display: flex;
    cursor: pointer;
  }

  .simple-com-file-name {
    font-size: 14px;
    font-weight: 700;
    line-height: 28px;
  }

  .ml20 {
    margin-left: 20px;
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
  width: 360px !important;

  &.hide-root-hash-list {
    display: none !important;
  }
}

.module-row-graph-type {
  color: var(--devui-primary-text);
  padding: 0 8px;
  height: 18px;
  line-height: 16px;
  border-radius: 4px;

  &.TENSOR {
    background-color: var(--devui-mint-60);
  }

  &.TILE {
    background-color: var(--devui-green-60);
  }

  &.EXECUTE {
    background-color: var(--devui-cyan-60);
  }

  &.BLOCK {
    background-color: var(--devui-blue-60);
  }

  &.LEAF_VF {
    background-color: var(--devui-indigo-60);
  }

  &.INVALID {
    background-color: var(--devui-red-60);
  }
}

.module-row-graph-type {
  margin-right: 6px;
}
</style>

<style lang="scss">
.devui-tooltip.devui-flexible-overlay.unlock-label-tips {
  max-width: unset;
}
</style>
