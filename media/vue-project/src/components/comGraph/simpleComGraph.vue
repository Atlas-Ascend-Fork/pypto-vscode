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
    <ComGraphMinimap ref="minimapEl" :width="200" :height="124" :show-related-nav="true"></ComGraphMinimap>
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
    <div v-if="showGuideAnchor" id="guideThreeColumn" class="guide-three-column-anchor"></div>
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { cancelRectAnimation } from '../../sprotty-graph/animation';
import { onMounted, watch, ref, inject, computed, nextTick, onBeforeUnmount, reactive } from 'vue';
import type { Ref } from 'vue';
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
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { findNodeIdsBySemanticLabel } from '../../utils/search';
import type { ThreeColumnServer } from 'ext:/view/servers/three-column-server';
import type { DrillDownPathItem } from './type';
import { GraphType } from './type';
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

const { isDarkTheme } = inject('root') as { isDarkTheme: Ref<boolean> };
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
const svgPath = computed(() => `"${(window as any).staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
let centerNodeAction;
let selectAction;
let hoverFeedbackAction;
let createSelectNodesRect;
let createSelectNodesRectByIds;
let removeSelectNodesRect;
let updateModelAction;
let initComDocText;
let resetModelSource;
let resetModel;
let fitToScreenAction;
let getModelSourceChildren: (() => any[]) | undefined;
let graphLayoutReady = false;
let layoutEnded = false;
let modelDisplayed = false;
let graphRenderVersion = 0;
// 跨 leaf 下钻是异步的（innerGetSubgraph → 重新渲染 → layoutEnding），
// 待渲染完成后执行的视觉动作统一挂这里（py 精确选中 / CCE hover / CCE 锁定共用）
let pendingApply: (() => void) | null = null;
let pendingApplyHash = '';
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

// 规避锁定时泳道图发送消息，重新创建框选时，框选消失的问题
let prevent = false;
let currentLockLabel: string = '';
let sendlist;
let clickLabel: string = '';
let currentHoverLabel: string = '';

// 四联动手动切换子图后按原锁定目标重新上锁
type ReLockState = {
  source: 'py' | 'cce' | 'swim' | 'label';
  label: string;
  opmagic?: number;
  input?: { label?: string; file?: string; line?: number };
};
let reLockState: ReLockState | null = null;
let pendingReLock = false;

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

/** 四栏模式下计算图节点点击直接上锁 */
function isFourColumnMode(): boolean {
  return (threeColumnServer as any).ColumnMode?.value?.columnMode === 4;
}

/** 各来源最近一次收到的语义 label，随 returnOpsFromCom 一并回传 */
let comHoverLabel = '';
let cceHoverLabel = '';

function graphNodeIdOf(item: any): string {
  return item?.opmagic != null
    ? `operation-magic-${item.opmagic}-${item.subgraphid ?? -1}`
    : `tensor-${item?.magic}-${item?.subgraphid ?? -1}`;
}

function currentGraphOps(): any[] {
  const graph = (comGraphStore.data.jsonData ?? {}) as any;
  return (graph.operations ?? []) as any[];
}

/** 当前子图全部 op 与 tensor 的节点 id（置灰候选集） */
function currentGraphElementIds(): string[] {
  const graph = (comGraphStore.data.jsonData ?? {}) as any;
  return [...(graph.operations ?? []), ...(graph.tensors ?? [])].map(graphNodeIdOf);
}

function nodeIdsOfLabel(label: string): string[] {
  return label ? currentGraphOps().filter((op) => (op?.semantic_label?.label ?? '') === label).map(graphNodeIdOf) : [];
}

/** 布局后按 x、再按 y 取最左上角节点 */
function sortNodeIdsByPosition(ids: string[]): string[] {
  const positions = new Map((getModelSourceChildren?.() ?? []).map((node: any) => [node.id, node.position ?? { x: 0, y: 0 }]));
  return [...ids].sort((a, b) => {
    const pa = positions.get(a) ?? { x: 0, y: 0 };
    const pb = positions.get(b) ?? { x: 0, y: 0 };
    return pa.x - pb.x || pa.y - pb.y;
  });
}

/** 锁定态相关节点：按位置排序并定位当前节点 */
function setLockedNodeGroup(ids: string[], activeId?: string) {
  lockedOpNodeIds = sortNodeIdsByPosition(ids);
  lockedOpActiveIndex = activeId ? Math.max(0, lockedOpNodeIds.indexOf(activeId)) : 0;
}

function hasImplLocation(op: any): boolean {
  return !!op?.file && Number(op?.line) > 0;
}

interface FourColVisual {
  highlight?: string[];
  normal?: string[];
  dim?: string[];
  box?: string[];
  lock?: boolean;
  source?: string;
}

/**
 * 四联动统一视觉：highlight=高亮色，normal=常规色，dim=置灰，box=框选节点，lock=上锁框。
 * 同一节点只保留一种状态，避免置灰与常规色叠加。
 */
function applyFourColVisual(spec: FourColVisual) {
  clearOpNodeHighlight();
  comGraphStore.data.selectedNodeSemanticLabel = '';
  const highlight = new Set(spec.highlight ?? []);
  const normal = new Set(spec.normal ?? []);
  const dim = new Set(spec.dim ?? []);
  const focusIds = Array.from(highlight).filter((id) => !dim.has(id));
  const normalIds = Array.from(normal).filter((id) => !dim.has(id) && !highlight.has(id));
  const dimIds = Array.from(dim).filter((id) => !highlight.has(id) && !normal.has(id));
  comGraphStore.setData('fourColFocusNodeIds', focusIds);
  comGraphStore.setData('fourColActiveNodeIds', normalIds);
  comGraphStore.setData('fourColDimNodeIds', dimIds);
  comGraphStore.data.isNodeRectLock = !!spec.lock;
  drillDownPathIcon.disableBack = !!spec.lock;
  if (spec.box?.length) {
    // const curResetModel = (spec.source === 'com') ? ()=>{} : resetModel;
    void createSelectNodesRectByIds?.(spec.box, true, resetModel, spec.source === 'com');
  } else {
    removeSelectNodesRect?.();
  }
}

/** returnOpsFromCom 统一出口：始终携带来源最近的 label */
function emitOpsFeedback(source: string, hash: string, ops: number[], label: string) {
  (window as any).ascEventBus.emit('returnOpsFromCom', { source, hash, ops, label: label ?? '' });
}

/**
 * 泳道 task → 计算图视觉。
 *   有 label：悬浮 A 高亮、其余置灰、A 框选；锁定 A 常规、左上角高亮、A 上锁框
 *   无 label：整张子图常规，悬浮框选；锁定左上角高亮并上锁
 * hash 与当前子图不一致时先切图，layoutEnding 后由 pendingApply 套用。
 */
function applySwimVisual(label: string, targetHash: string, mode: 'hover' | 'lock') {
  // 7.3 / 6.3：没有 hash 不互动
  if (!targetHash) {
    return;
  }
  const run = () => {
    const group = label ? nodeIdsOfLabel(label) : currentGraphElementIds();
    if (!group.length) {
      removeSelectNodesRect?.();
      return;
    }
    const allIds = currentGraphElementIds();
    const ops = currentGraphOps()
      .filter((op) => !label || (op.semantic_label?.label ?? '') === label)
      .map((op) => Number(op.opmagic));
    if (mode === 'hover') {
      applyFourColVisual(label
        ? { highlight: group, dim: allIds.filter((id) => !group.includes(id)), box: group }
        : { normal: allIds, box: allIds });
      emitOpsFeedback('swim', targetHash || currentGraphHash(), ops, label);
      return;
    }
    // 锁定回执必须是 op 节点；无 label 时整图框选可含 tensor，但高亮取首个 op
    const candidates = label ? group : currentGraphOps().map(graphNodeIdOf);
    const active = sortNodeIdsByPosition(candidates)[0];
    applyFourColVisual({
      highlight: active ? [active] : [],
      normal: group.filter((id) => id !== active),
      box: group,
      lock: true,
    });
    setLockedNodeGroup(group, active);
    reLockState = { source: 'swim', label };
    const opMagic = extractOpMagic(active);
    if (opMagic != null) {
      void emitLock('swim', { hash: targetHash || currentGraphHash(), opmagic: opMagic, label });
    }
  };
  if (currentGraphHash() === String(targetHash) || !resolvableSwimHash(targetHash)) {
    run();
    return;
  }
  pendingApply = run;
  pendingApplyHash = String(targetHash);
  drillToLeaf(String(targetHash));
}

function onMessageFromSwim(args) {
  if (prevent) {
    prevent = false;
    return;
  }
  const label = args?.label ?? '';
  const targetHash = args?.leafHash ?? args?.hash ?? '';
  // 6.3：没有 hash 不互动
  if (!targetHash) {
    return;
  }
  if (!comGraphStore.data.isNodeRectLock) {
    currentHoverLabel = label;
    cancelPySelection(true);
    applySwimVisual(label, String(targetHash), 'hover');
  }
  sendlist = args.rootHashList;
  if (args.rootHashList?.length) {
    // curPath 是后端下发的 JSON 字符串，按下标取会得到最后一个字符，必须走 currentGraphHash()。
    const cur = currentGraphHash();
    if (cur) {
      rootHash.value = cur;
    }
  }
}
const onSwimEcho = debounce((args) => {
  if (!pyOwnsVisual && !hoverTimer) {
    onMessageFromSwim(args);
  }
}, 100);
(window as any).ascEventBus.on('returnSemanticLabelFromSwimToCom', onSwimEcho);
(window as any).ascEventBus.on('returnSemanticLabelFromSwim', debounce((args) => {
  if (!comGraphStore.data.isNodeRectLock) {
    cancelPySelection(true);
  }
  onMessageFromSwim(args);
}, 100));
/** 在当前图里按节点 id / opmagic 定位 op */
function findGraphOpByNode(nodeId?: string, opmagic?: number | string | null): any {
  const ops = currentGraphOps();
  if (nodeId) {
    const exact = ops.find((op) => graphNodeIdOf(op) === nodeId);
    if (exact) {
      return exact;
    }
  }
  const magic = opmagic ?? extractOpMagic(nodeId);
  if (magic == null || magic === '') {
    return null;
  }
  return ops.find((op) => String(op.opmagic) === String(magic)) ?? null;
}

/** 点击可能落在 op 的 label/compartment 上，沿 parent 链找回所属 op 节点 */
function resolveClickedGraphOp(node: any): { op: any; opmagic: number } | null {
  let current = node;
  while (current) {
    if (typeof current.id === 'string' && current.id.startsWith('operation-magic-')) {
      const opmagic = extractOpMagic(current.id);
      const op = findGraphOpByNode(current.id, opmagic);
      if (op && opmagic != null) {
        return { op, opmagic };
      }
    }
    current = current.parent;
  }
  return null;
}

/**
 * 计算图节点 → 其余栏联动。
 * hover：aa 高亮；有 label 时同 label B 常规色，其余置灰；无 label 时其余置灰；aa+B 框选
 * lock ：aa 常规色；同 label B 与其余节点置灰；aa+B 上锁框
 * returnOpsFromCom：有 file/line 或完全没有 label 时发 aa，仅 label 无实现行时发空列表
 */
function applyComNodeVisual(op: any, mode: 'hover' | 'lock') {
  if (!op) {
    return;
  }
  const nodeId = graphNodeIdOf(op);
  const label = op.semantic_label?.label ?? '';
  const hasLine = hasImplLocation(op);
  const labelIds = nodeIdsOfLabel(label);
  const allIds = currentGraphElementIds();
  const box = label ? [nodeId, ...labelIds.filter((id) => id !== nodeId)] : [nodeId];
  if (mode === 'lock') {
    applyFourColVisual({
      normal: [nodeId],
      dim: allIds.filter((id) => id !== nodeId),
      box,
      lock: true,
      source: 'com'
    });
    return;
  }
  comHoverLabel = label;
  (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label, rootHash: rootHash.value });
  applyFourColVisual({
    highlight: [nodeId],
    normal: labelIds.filter((id) => id !== nodeId),
    dim: allIds.filter((id) => id !== nodeId && !labelIds.includes(id)),
    box,
    source: 'com'
  });
  emitOpsFeedback('com', currentGraphHash(), label && !hasLine ? [] : [Number(op.opmagic)], label);
}

(window as any).ascEventBus.on('rect_node_hover', (args) => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  cancelPySelection(true);
  const op = findGraphOpByNode(args?.nodeId);
  if (!op) {
    return;
  }
  applyComNodeVisual(op, 'hover');
});
(window as any).ascEventBus.on('rect_node_leave', () => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  removeSelectNodesRect?.();
  comHoverLabel = '';
  (window as any).ascEventBus.emit('returnSemanticLabelFromCom', { label: '' });
  emitOpsFeedback('com', '', [], '');
});

// 联动驱动的切图标记：drillToLeaf（py/CCE/泳道的锁定或悬停下钻）置位，
// 「联动切图」（新锁定回声 activeLockFromCom 在途，不广播解锁）与
// 「手动切图」（旧锁定目标与新子图强绑冲突，广播解锁）
let lockDrivenDrill = false;

/** 下钻到指定 leaf。跨 leaf 时目标节点根本不在当前图里，必须先切图 */
function drillToLeaf(leafHash: string) {
  lockDrivenDrill = true;
  const name = (comGraphStore.data.calleeMap?.[leafHash]?.func_magicname ?? leafHash).replace(/^TENSOR_/i, '');
  rootHash.value = leafHash;
  onHashChange({ value: leafHash, name });
}

/** CCE 行 → 当前图 op：有 label 时须同 opmagic + 同 label */
function findCceTargetOp(opmagic: number | string, label: string): any {
  const ops = currentGraphOps().filter((op) => String(op.opmagic) === String(opmagic));
  return (label ? ops.find((op) => (op.semantic_label?.label ?? '') === label) : ops[0]) ?? null;
}

/**
 * CCE 行 → 计算图视觉。
 * hover：a 高亮，同 label A 常规色，其余置灰，a+A 框选
 * lock ：a 常规色，其余置灰，a+A 上锁框
 * opmagic 不在当前子图时先切到消息携带的 hash，layoutEnding 后套用。
 */
function applyCceVisual(opmagic: number | string, leafHash: string, mode: 'hover' | 'lock') {
  const label = cceHoverLabel;
  const run = () => {
    const op = findCceTargetOp(opmagic, label);
    if (!op) {
      return;
    }
    const nodeId = graphNodeIdOf(op);
    const labelIds = nodeIdsOfLabel(label);
    const allIds = currentGraphElementIds();
    const box = label ? [nodeId, ...labelIds.filter((id) => id !== nodeId)] : [nodeId];
    if (mode === 'hover') {
      applyFourColVisual({
        highlight: [nodeId],
        normal: labelIds.filter((id) => id !== nodeId),
        dim: allIds.filter((id) => id !== nodeId && !labelIds.includes(id)),
        box,
      });
      emitOpsFeedback('cce', currentGraphHash(), [Number(op.opmagic)], label);
      return;
    }
    applyFourColVisual({
      normal: [nodeId],
      dim: allIds.filter((id) => id !== nodeId),
      box,
      lock: true,
    });
    setLockedNodeGroup(box, nodeId);
    reLockState = { source: 'cce', label, opmagic: Number(op.opmagic) };
    void emitLock('cce', { hash: currentGraphHash(), opmagic: Number(op.opmagic), label });
  };
  if (!leafHash || currentGraphHash() === String(leafHash)) {
    run();
    return;
  }
  pendingApply = run;
  pendingApplyHash = String(leafHash);
  drillToLeaf(String(leafHash));
}

(window as any).ascEventBus.on('returnSemanticLabelFromCce', (args) => {
  cceHoverLabel = args?.label ?? '';
});

// CCE 行悬停：opmagic 为 0 时不互动
(window as any).ascEventBus.on('returnOpFromCce', (args) => {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  const opMagic = args?.opmagic;
  if (!opMagic) {
    return;
  }
  cancelPySelection(true);
  applyCceVisual(opMagic, String(args?.hash ?? ''), 'hover');
});

// CCE 行点击：a 常规色，其余置灰，a+A 上锁框；opmagic 不在当前图时先切图
(window as any).ascEventBus.on('activeLockFromCce', (args) => {
  const opMagic = args?.opmagic;
  if (!opMagic) {
    return;
  }
  cancelPySelection(true);
  applyCceVisual(opMagic, String(args?.hash ?? ''), 'lock');
});

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
  cancelPySelection(true);
  applySwimVisual(label, leafHash, 'lock');
  hoverFeedbackAction?.();
});
(window as any).ascEventBus.on('sendHashList', (args) => {
  if (swimLockJumpPending) {
    swimLockJumpPending = false;
    return;
  }
  generateHashList(args.rootHashList ?? []);
  // 泳道点击的跳图已由 activeLockFromSwim → applySwimVisual 负责（只有它知道当前图层是否已是
  // 目标 leafHash 子图），这里必须整段让位：再跳一次会让同一次点击触发两次子图重载，
  // 且尾部 selectPassPath 会拿到切换前的 hash、把面包屑填成上一层的 pass 副本。
  // 切换期间保留现有下拉选项，跳图完成后沿用原列表。
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
(window as any).ascEventBus.on('swimSelectModeChange', (args) => {
  if (args.selectMode) {
    autoDrillCb({ label: currentHoverLabel });
  }
});

watch(threeColumnServer.GetPassPath, (newValue: any) => {
  if (!newValue.data) return;
  newValue.data.forEach((fullPath: string) => {
    const fileName = fullPath.replace(/^.*[\\/]/, '');
    rootHashList.value.push({ name: fileName, value: fullPath });
  });
});

(window as any).ascEventBus.on('deactivateLock', () => {
  cancelPySelection(true);
  prevent = false;
  lockedOpNodeIds = [];
  lockedOpActiveIndex = 0;
  reLockState = null;
  pendingReLock = false;
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
    clearOpNodeHighlight();
    removeSelectNodesRect?.();
    updateModelAction?.();
  }
  hoverFeedbackAction?.();
  generateHashList();
});
(window as any).ascEventBus.on('threeColumnSizeChange', ({ comGraphVisible }) => {
  if (comGraphVisible) {
    window.dispatchEvent(new Event('resize'));
    minimapEl.value?.updateScaleRation();
    const fitTimer = setTimeout(() => {
      fitToScreenAction?.();
      fitTimer && clearTimeout(fitTimer);
    });
  }
});

function onLockClick() {
  if (pySelection && !comGraphStore.data.isNodeRectLock) {
    onLockFromPy(pySelection.input);
    return;
  }
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
  // 四联动锁定态手动切换子图：保留锁定，等新图布局完成后按原目标重锁
  const keepLock = isFourColumnMode() && comGraphStore.data.isNodeRectLock && !!reLockState;
  if (keepLock) {
    pendingReLock = true;
  } else if (pySelection?.stable) {
    (window as any).ascEventBus.emit('deactivateLock');
  }
  cancelPySelection(true);
  // 重锁切图按联动切图广播，CCE 看到 lockDriven 后不主动解锁，由新图重锁结果决定
  lockDrivenDrill = keepLock;
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
// 当前已渲染子图的 hash：切图时清空上一张图的节点级配色
let renderedGraphHash = '';

/**
 * py 行触发切图时先广播目标 hash（1.1.2），让 CCE 等栏提前准备。
 * 目标数据渲染后的 watcher 因 lastNotifiedSubgraphHash 已相同而跳过重复广播。
 */
function notifyPreparedSubgraph(hash: string) {
  if (!hash || hash === lastNotifiedSubgraphHash) {
    return;
  }
  lastNotifiedSubgraphHash = hash;
  // 已在下钻时提前广播，watcher 不再二次广播，避免遗留 lockDriven 标记
  lockDrivenDrill = false;
  (window as any).ascEventBus.emit('subgraphHashChanged', { hash, lockDriven: true });
}

// CCE 文件切换 → 按文件 funcHash 强绑计算图子图：hash 与当前子图一致（含主/尾块副本互换）时不动作；
// 图中无此 hash 时广播未解析，CCE 栏以"暂无关联对象"遮罩提示
const onCceFileSwitched = (args: { hash?: string }) => {
  const hash = args?.hash;
  if (!hash || hash === currentGraphHash()) {
    return;
  }
  cancelPySelection(true);
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

/**
 * 进入锁定态。isNodeRectLock 是图内所有锁定判断的唯一开关
 * （rect_node_hover / rect_node_leave / onMessageFromSwim 都靠它跳过悬停覆盖），
 * 不置位的话任何一次悬停都会把选中冲掉，表现为「点了没锁住」。
 */
function lockGraphByLabel(label: string) {
  cancelPySelection(true);
  prevent = true;
  currentLockLabel = label;
  reLockState = { source: 'label', label };
  comGraphStore.data.isNodeRectLock = true;
  drillDownPathIcon.disableBack = true;
  // 不做 if (label) 短路：createSelectNodesRect('') 内部会走 removeSelectNodesRect()，
  // 这是 activeLock 空 label（如 onLockClick 的 selectedNodeSemanticLabel 为 ''）时的原有清框语义
  createSelectNodesRect?.(label, true);
  hoverFeedbackAction?.();
}

/** 在当前子图按 py 输入重新锁定；找不到相关 op 时退出锁定 */
function relockPyInCurrentGraph(input: { label?: string; file?: string; line?: number }) {
  if (!input || (!input.label && !hasPyLine(input))) {
    (window as any).ascEventBus.emit('deactivateLock');
    return;
  }
  cancelPySelection();
  const selection: PySelection = {
    input: { ...input },
    stable: true,
    version: pySelectionVersion,
    targetHash: currentGraphHash(),
    ops: [],
    applying: false,
  };
  pySelection = selection;
  const local = localPyNodes(selection);
  const required = hasPyLine(input) && input.label ? local.matched : local.group;
  if (!required.length) {
    (window as any).ascEventBus.emit('deactivateLock');
    return;
  }
  pyOwnsVisual = true;
  void applyPySelection();
}

/** 四联动手动切换子图后，按原锁定来源在新图中重新锁定 */
function reapplyLockAfterSwitch(state: ReLockState | null) {
  if (!state || !comGraphStore.data.isNodeRectLock) {
    return;
  }
  if (state.source === 'py' && state.input) {
    relockPyInCurrentGraph(state.input);
    return;
  }
  if (state.source === 'cce' && state.opmagic != null) {
    if (findCceTargetOp(state.opmagic, state.label)) {
      applyCceVisual(state.opmagic, currentGraphHash(), 'lock');
      return;
    }
    if (state.label) {
      lockGraphByLabel(state.label);
      return;
    }
  }
  if (state.source === 'swim') {
    applySwimVisual(state.label, currentGraphHash(), 'lock');
    return;
  }
  if (state.label) {
    lockGraphByLabel(state.label);
    return;
  }
  (window as any).ascEventBus.emit('deactivateLock');
}

// 下钻渲染完成后执行挂起的视觉动作（layoutEnding 触发）
function flushPendingSelection() {
  if (!pendingApply) {
    return;
  }
  // 旧图完成通知不能把目标子图的动作提前套到旧模型上
  if (pendingApplyHash && currentGraphHash() !== pendingApplyHash) {
    return;
  }
  const run = pendingApply;
  pendingApply = null;
  pendingApplyHash = '';
  run();
}

let lockedOpNodeIds: string[] = [];
let lockedOpActiveIndex = 0;

/** B 保持常规色，当前节点使用高亮色。 */
function renderLockedOpHighlight() {
  if (!lockedOpNodeIds.length) {
    return;
  }
  const activeId = lockedOpNodeIds[lockedOpActiveIndex];
  const group = new Set(lockedOpNodeIds);
  comGraphStore.setData('fourColMatchedNodeIds', []);
  comGraphStore.setData('fourColActiveNodeIds', lockedOpNodeIds.filter((id) => id !== activeId));
  comGraphStore.setData('fourColFocusNodeIds', [activeId]);
  comGraphStore.setData('fourColDimNodeIds', currentGraphElementIds().filter((id) => !group.has(id)));
}

function clearOpNodeHighlight() {
  lockedOpNodeIds = [];
  lockedOpActiveIndex = 0;
  comGraphStore.setData('fourColMatchedNodeIds', []);
  comGraphStore.setData('fourColActiveNodeIds', []);
}

// 锁定态下在匹配到的节点间循环切换当前节点（上下键 / 小地图上方的上一个、下一个按钮共用）
function stepLockedOpNode(step: -1 | 1) {
  if (!comGraphStore.data.isNodeRectLock || lockedOpNodeIds.length < 2) {
    return;
  }
  lockedOpActiveIndex = (lockedOpActiveIndex + step + lockedOpNodeIds.length) % lockedOpNodeIds.length;
  renderLockedOpHighlight();
  const activeId = lockedOpNodeIds[lockedOpActiveIndex];
  centerNodeAction?.([activeId]);
  selectAction?.([activeId]);
  updateModelAction?.();
  // 切换锁定当前节点后同步回执，py 栏据此移动锁定行
  if (pySelection?.stable) {
    void emitPySelectionLock(pySelection, activeId);
  } else {
    const opMagic = extractOpMagic(activeId);
    if (opMagic != null) {
      void emitLock('com', { hash: currentGraphHash(), opmagic: opMagic });
    }
  }
}

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
  stepLockedOpNode(event.key === 'ArrowDown' ? 1 : -1);
}

// 小地图上方按钮触发的上一/下一个相关节点切换
function onStepRelatedOpNode(args: { direction?: number }) {
  const direction = args?.direction;
  if (direction === 1 || direction === -1) {
    stepLockedOpNode(direction);
  }
}

// 四联动点击/悬停锁定通道：图列作为中枢，消费 py/CCE/泳道的点击，
// 经 server 反查后广播 activeLockFromCom，并下钻 + 选中 op。
type LockSource = 'py' | 'cce' | 'swim' | 'com';
interface LockInput {
  opmagic?: number | string;
  hash?: string;
  leafHash?: string;
  file?: string;
  line?: number;
  /** 来源明确给出的语义标签；resolveActiveLock 优先采用，反查不到时载荷里也不会退化成 null */
  label?: string;
}

/** py 行反查出的 op 落点（供计算图列下钻 + 精确选中） */
interface OpSelection {
  leafHash: string;
  opmagic: string;
  subgraphid: number;
  label: string | null;
  pyFile: string | null;
  pyLine: number | null;
}

async function emitLock(source: LockSource, input: LockInput): Promise<void> {
  const res = await threeColumnServer.resolveActiveLock(input);
  if (res) {
    (window as any).ascEventBus.emit('activeLockFromCom', { source, ...res });
  }
}

// 计算图自身点击：leaf op → {leafHash, opMagic}；ROOT 层 CALL 节点只给被调 leafHash（服务端取该 leaf 首个 op）
async function emitComLock(leafHash: string, opMagic?: number): Promise<void> {
  // 视觉已由 applyComNodeVisual 套用，这里只作废在途 py 查询，避免再次清空节点配色
  cancelPySelection();
  await emitLock('com', opMagic == null ? { hash: leafHash } : { hash: leafHash, opmagic: opMagic });
}

// 上一/下一 op 切换
async function stepOp(leafHash: string, opMagic: number, direction: -1 | 1): Promise<void> {
  const next = await threeColumnServer.stepOp({ leafHash, opMagic, direction });
  if (next != null) {
    await emitComLock(leafHash, next);
  }
}

interface PyInput {
  label?: string;
  file?: string;
  line?: number;
}

interface PySelection {
  input: PyInput;
  stable: boolean;
  version: number;
  targetHash: string;
  ops: OpSelection[];
  applying: boolean;
}

let pyHoverLabel = '';
let pyOwnsVisual = false;
let pySelectionVersion = 0;
let pySelection: PySelection | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPySelection(release = false) {
  pySelectionVersion++;
  pySelection = null;
  if (release) {
    pyOwnsVisual = false;
    clearOpNodeHighlight();
  }
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function hasPyLine(input: PyInput): input is PyInput & { file: string; line: number } {
  return !!input.file && Number.isInteger(input.line) && input.line! > 0;
}

function normalizePyPath(file: string): string {
  const normalized = file.replace(/\\/g, '/');
  return /^(?:[a-z]:|\/\/)/i.test(normalized) ? normalized.toLowerCase() : normalized;
}

/** 编译机路径与本地路径按唯一同名文件映射，完整路径优先。 */
function matchingPyFiles(file: string, candidates: string[]): Set<string> {
  const normalized = normalizePyPath(file);
  const paths = Array.from(new Set(candidates.filter(Boolean).map(normalizePyPath)));
  if (paths.includes(normalized)) {
    return new Set([normalized]);
  }
  const basename = normalized.split('/').pop();
  const sameName = paths.filter((candidate) => candidate.split('/').pop() === basename);
  return new Set(sameName.length === 1 ? sameName : []);
}

const pyOpNodeId = (op: { opmagic: number | string; subgraphid?: number }) =>
  `operation-magic-${op.opmagic}-${op.subgraphid ?? -1}`;

/** A、B 都限定为当前 hash 中实际存在的 op，不包含同标签的 tensor。 */
function localPyNodes(selection: PySelection): { group: string[]; matched: string[] } {
  const { input, ops } = selection;
  const graphOps: any[] = ((comGraphStore.data.jsonData ?? {}) as any).operations ?? [];
  const labelled = input.label ? graphOps.filter((op) => op.semantic_label?.label === input.label) : [];
  const sourceFiles = ops.map((op) => op.pyFile ?? '');
  const files = hasPyLine(input)
    ? matchingPyFiles(input.file, sourceFiles.length ? sourceFiles : graphOps.map((op) => op.file ?? ''))
    : new Set<string>();
  const exact = hasPyLine(input)
    ? (input.label ? labelled : graphOps).filter((op) =>
        files.has(normalizePyPath(op.file ?? '')) && Number(op.line) === input.line,
      )
    : labelled;
  return { group: (input.label ? labelled : exact).map(pyOpNodeId), matched: exact.map(pyOpNodeId) };
}

function invalidateGraphLayout() {
  cancelRectAnimation();
  graphRenderVersion++;
  graphLayoutReady = false;
  layoutEnded = false;
  modelDisplayed = false;
}

/** 同时确认当前模型已显示、布局已结束且几何有效，再插入渐变框。 */
function finishGraphLayout() {
  if (!layoutEnded || !modelDisplayed) {
    return;
  }
  const children = getModelSourceChildren?.() ?? [];
  const expected = new Set((((comGraphStore.data.jsonData ?? {}) as any).operations ?? []).map(pyOpNodeId));
  const nodes = children.filter((child) => child.id?.startsWith('operation-magic-'));
  if ((expected.size && !nodes.length) || nodes.some((node) =>
    !expected.has(node.id) || !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y) ||
    !(node.size?.width > 0) || !(node.size?.height > 0),
  )) {
    return;
  }
  graphLayoutReady = true;
  flushPendingSelection();
  void applyPySelection();
}

function onGraphViewerUpdate(args: any) {
  const children = getModelSourceChildren?.();
  if (children && args?.model?.children === children) {
    modelDisplayed = true;
    finishGraphLayout();
  }
}

function onGraphLayoutEnding() {
  isLoading.value = false;
  loadingText.value = '';
  showGuideAnchor.value = true;
  layoutEnded = true;
  finishGraphLayout();
}

async function emitPySelectionLock(selection: PySelection, activeId: string) {
  const hash = currentGraphHash();
  const res = await threeColumnServer.resolveActiveLock({
    hash, opmagic: extractOpMagic(activeId), label: selection.input.label,
  });
  if (res && selection === pySelection && selection.version === pySelectionVersion &&
    hash === currentGraphHash() && comGraphStore.data.fourColFocusNodeIds?.[0] === activeId) {
    (window as any).ascEventBus.emit('activeLockFromCom', { source: 'py', ...res });
  }
}

async function applyPySelection() {
  const selection = pySelection;
  if (!selection?.targetHash || selection.version !== pySelectionVersion || !graphLayoutReady || selection.applying) {
    return;
  }
  if (selection.targetHash !== currentGraphHash()) {
    invalidateGraphLayout();
    drillToLeaf(selection.targetHash);
    // 1.1.2 / 1.2.2 / 1.3.2 / 2.1.2 / 2.2.2 / 2.3.2：发起切图时先广播准备切换的目标 hash
    notifyPreparedSubgraph(selection.targetHash);
    return;
  }
  const local = localPyNodes(selection);
  const positions = new Map((getModelSourceChildren?.() ?? []).map((node) => [node.id, node.position]));
  const group = local.group.filter((id) => positions.has(id));
  const matched = local.matched.filter((id) => positions.has(id));
  if (!group.length) {
    return;
  }
  selection.applying = true;
  const renderVersion = graphRenderVersion;
  const ordered = [...matched].sort((a, b) => {
    const pa = positions.get(a);
    const pb = positions.get(b);
    return pa.x - pb.x || pa.y - pb.y;
  });
  // 上锁且 ops 为空：以当前子图首个 label 相关节点（按图内坐标）充当 B
  const labelFirstId = selection.input.label && !selection.ops.length
    ? [...group].sort((a, b) => {
        const pa = positions.get(a);
        const pb = positions.get(b);
        return pa.x - pb.x || pa.y - pb.y;
      })[0]
    : undefined;
  const activeId = selection.stable ? (ordered[0] ?? labelFirstId) : undefined;
  await selectAction?.([]);
  if (selection !== pySelection || renderVersion !== graphRenderVersion) {
    selection.applying = false;
    return;
  }
  clearOpNodeHighlight();
  comGraphStore.data.selectedNodeSemanticLabel = '';
  currentLockLabel = '';
  clickLabel = '';
  comGraphStore.data.isNodeRectLock = selection.stable;
  drillDownPathIcon.disableBack = selection.stable;
  const focusIds = selection.stable
    ? (activeId ? [activeId] : [])
    : (selection.input.label && hasPyLine(selection.input) ? matched : []);
  // 当前子图剩余节点集合 C 全部置灰：
  //   hover -> A 以外的节点；click -> B（无 label 时为 A）以外的节点；
  //   click 且 B 为空时以首个 label 相关节点充当 B
  const normalGroup = selection.stable && selection.input.label && hasPyLine(selection.input)
    ? (matched.length ? matched : (activeId ? [activeId] : []))
    : group;
  const dimIds = currentGraphElementIds().filter((id) => !normalGroup.includes(id));
  comGraphStore.setData('fourColFocusNodeIds', focusIds);
  comGraphStore.setData('fourColDimNodeIds', dimIds);
  // 显式保持常规色，避免节点单选产生的路径灰化覆盖 B。
  comGraphStore.setData('fourColActiveNodeIds', group.filter((id) =>
    !focusIds.includes(id) && !dimIds.includes(id),
  ));
  if (selection.stable) {
    // 切换范围取框选集合（同 label 组），当前节点仍定位到 B 中最左上角 op
    setLockedNodeGroup(group, activeId);
    reLockState = { source: 'py', label: selection.input.label ?? '', input: { ...selection.input } };
  }
  await createSelectNodesRectByIds?.(group, true, resetModel);
  if (selection !== pySelection || renderVersion !== graphRenderVersion) {
    selection.applying = false;
    return;
  }
  updateModelAction?.();
  if (activeId) {
    hoverFeedbackAction?.();
    await emitPySelectionLock(selection, activeId);
  } else if (!selection.stable) {
    const label = selection.input.label ?? '';
    // 1.3 仅 label：只回传 label，ops 为空；其余分支回传命中的 B/A
    const ops = label && !hasPyLine(selection.input)
      ? []
      : Array.from(new Set(matched.map((id) => extractOpMagic(id))));
    emitOpsFeedback('py', currentGraphHash(), ops, label);
  }
}

/** 按 label 遍历子图，返回首个含该标签 op 的 hash（ops 未命中时的兜底落点） */
async function findHashByLabel(label: string, version: number): Promise<string> {
  for (const hash of Object.keys(comGraphStore.data.calleeMap ?? {})) {
    const res = await threeColumnServer.resolveSwimOps({ leafHash: hash, label });
    if (version !== pySelectionVersion) {
      return '';
    }
    if (res?.ops?.length) {
      return hash;
    }
  }
  return '';
}

async function handlePyInput(input: PyInput, stable: boolean, version: number) {
  const selection: PySelection = { input, stable, version, targetHash: '', ops: [], applying: false };
  pySelection = selection;
  try {
    if (hasPyLine(input)) {
      const res = await threeColumnServer.resolveOpsFromPyLine({ file: input.file, line: input.line });
      if (version !== pySelectionVersion) {
        return;
      }
      const rows: OpSelection[] = res?.ops ?? [];
      const files = matchingPyFiles(input.file, rows.map((op) => op.pyFile ?? ''));
      selection.ops = rows.filter((op) => files.has(normalizePyPath(op.pyFile ?? '')) && op.pyLine === input.line &&
        (!input.label || op.label === input.label));
    }
    if (version !== pySelectionVersion) {
      return;
    }
    const local = localPyNodes(selection);
    // 文档 1.1 / 2.1：带 file+line+label 时先要求「file+line+label」在当前图命中 B；
    // B 为空则按 ops 落点切到首个命中 hash；ops 也为空时回退按 label 搜索含该标签的子图
    // （例如入口层同 label 的实现行没有 op 落点）。仅 file+line 时按 ops 落点切图，
    // 仅 label 时按 label 命中集合决定是否切图。
    if (hasPyLine(input) && input.label) {
      if (local.matched.length) {
        selection.targetHash = currentGraphHash();
      } else if (selection.ops.length) {
        selection.targetHash = selection.ops[0].leafHash;
      } else if (local.group.length) {
        // 当前图已有同 label 节点：留在当前图按 label 高亮
        selection.targetHash = currentGraphHash();
      } else {
        // ops 为 0：按 label 切到含该标签的子图
        selection.targetHash = await findHashByLabel(input.label, version);
      }
    } else if (local.group.length) {
      selection.targetHash = currentGraphHash();
    } else if (hasPyLine(input)) {
      selection.targetHash = selection.ops[0]?.leafHash ?? '';
    } else if (input.label) {
      selection.targetHash = await findHashByLabel(input.label, version);
    }
    if (version !== pySelectionVersion) {
      return;
    }
    if (selection.targetHash) {
      await applyPySelection();
    } else if (stable) {
      (window as any).ascEventBus.emit('deactivateLock');
    }
  } catch (error) {
    if (version === pySelectionVersion) {
      console.error('Python linkage lookup failed:', error);
      if (stable) {
        (window as any).ascEventBus.emit('deactivateLock');
      }
    }
  }
}

const onLockFromPy = (args: PyInput) => {
  cancelPySelection();
  const input = { ...args, label: args?.label ?? '' };
  if (!input.label && !hasPyLine(input)) {
    return;
  }
  comGraphStore.data.isNodeRectLock = true;
  pendingApply = null;
  pendingApplyHash = '';
  pyOwnsVisual = true;
  void handlePyInput(input, true, pySelectionVersion);
};

function schedulePyHover(input: PyInput) {
  if (comGraphStore.data.isNodeRectLock) {
    return;
  }
  cancelPySelection();
  if (!input.label && !hasPyLine(input)) {
    return;
  }
  pendingApply = null;
  pendingApplyHash = '';
  pyOwnsVisual = true;
  const version = pySelectionVersion;
  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    void handlePyInput(input, false, version);
  }, 200);
}

const onPyHoverLabel = (args: PyInput) => {
  pyHoverLabel = args?.label ?? '';
  schedulePyHover({ ...args, label: pyHoverLabel });
};
const onHoverFromPy = (args: PyInput) => {
  if (typeof args?.label === 'string') {
    pyHoverLabel = args.label;
  }
  schedulePyHover({ ...args, label: args?.label ?? pyHoverLabel });
};
// CCE/泳道的点击由上方内联监听统一完成视觉与 activeLockFromCom 回执，此处不再重复广播。

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
        (window as any).ascEventBus.emit('subgraphHashChanged', { hash: newHash, lockDriven: lockDrivenDrill });
        lockDrivenDrill = false;
      }
      const jsonValue = JSON.parse(JSON.stringify(props.jsonContent));
      invalidateGraphLayout();
      if (pySelection) {
        pySelection.applying = false;
      }
      comGraphStore.setData('jsonData', jsonValue);
      comGraphStore.setData('fourColRectNodeIds', []);
      comGraphStore.setData('selectedNodeSemanticLabel', '');
      // 新子图沿用旧图的节点级配色/置灰会误伤同 id 节点，切图时统一清空，由联动动作重新套用
      if (newHash !== renderedGraphHash) {
        renderedGraphHash = newHash;
        clearOpNodeHighlight();
        comGraphStore.setData('fourColFocusNodeIds', []);
        comGraphStore.setData('fourColDimNodeIds', []);
      }
      const funcMagicName = comGraphStore.data.calleeMap?.[val.hash] ?? '';
      if (val.hash && funcMagicName) {
        currentPath = { calleehash: val.hash, subFuncmagicname: funcMagicName };
      }
      if (initComDocText) {
        if (pendingReLock) {
          pendingReLock = false;
          const targetHash = String(val.hash ?? currentGraphHash());
          const state = reLockState;
          pendingApplyHash = targetHash;
          pendingApply = () => reapplyLockAfterSwitch(state);
        }
        resetModelSource(true);
        initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic, -1, props.isThreeMode);
        server.returnFuncTree();
        let shouldListenViewZoom = true;
        if (!pendingApply && !pySelection && ((comGraphStore.data.isNodeRectLock && currentLockLabel) || clickLabel)) {
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
      getModelSourceChildren = sprottyLoadResult.getModelSourceChildren;
      initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic, -1, props.isThreeMode);
      centerNodeAction = sprottyLoadResult.centerNodeAction;
      selectAction = sprottyLoadResult.selectAction;
      createSelectNodesRect = sprottyLoadResult.createSelectNodesRect;
      createSelectNodesRectByIds = sprottyLoadResult.createSelectNodesRectByIds;
      removeSelectNodesRect = sprottyLoadResult.removeSelectNodesRect;
      updateModelAction = sprottyLoadResult.updateModelAction;
      hoverFeedbackAction = sprottyLoadResult.hoverFeedbackAction;
      resetModelSource = sprottyLoadResult.resetModelSource;
      resetModel = sprottyLoadResult.resetModel;
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
      return;
    }
    // op 节点点击（可能落在 label/compartment 上）→ 找回所属 op
    const hit = resolveClickedGraphOp(node);
    // 四栏模式：op 的 label 区域点击也用于上锁；三栏保持原有 label-main 打开详情
    if (hit && (isFourColumnMode() || !node.id.endsWith('label-main'))) {
      // 上锁后只允许单击锁图标或 deactivateLock 解锁，点击其它节点不改变锁定
      if (comGraphStore.data.isNodeRectLock) {
        return;
      }
      cancelPySelection(true);
      applyComNodeVisual(hit.op, 'lock');
      hoverFeedbackAction?.();
      // 与悬浮保持同一口径：始终回传当前子图 hash + 被点击节点 opmagic，
      // 不再对 CALL 节点改传 calleehash（那会让悬浮与点击给出不同的 hash/op 组合）
      const graphHash = currentGraphHash();
      if (graphHash) {
        void emitComLock(graphHash, hit.opmagic);
      }
      return;
    }
    if (node.id.endsWith('label-main')) {
      nodeId.value = node.id;
      const container = document.querySelector('.simple-com-graph-container');
      containerHeight.value = container.getBoundingClientRect().height;
      showNodeDetail.value = true;
    }
  });
  // 上一/下一 op 切换（由菜单/快捷键触发 stepComOp {leafHash?, opMagic, direction}）
  (window as any).ascEventBus.on('stepComOp', (args) => {
    const leafHash = args?.leafHash ?? currentGraphHash();
    if (leafHash && args?.opMagic != null && (args.direction === 1 || args.direction === -1)) {
      void stepOp(leafHash, args.opMagic, args.direction);
    }
  });
  (window as any).ascEventBus.on('layoutEnding', onGraphLayoutEnding);
  (window as any).ascEventBus.on('viewer_update', onGraphViewerUpdate);
  if (props.loadingStep === 'readJson' || props.loadingStep === 'convertData') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('keydown', onFourColArrowKey);
  (window as any).ascEventBus.on('stepRelatedOpNode', onStepRelatedOpNode);
  (window as any).ascEventBus.on('lockToggleChange', onLockClick);
  (window as any).ascEventBus.on('resetComGraphToFirst', resetToFirstStep);
  (window as any).ascEventBus.on('cceFileSwitched', onCceFileSwitched);
  (window as any).ascEventBus.on('activeLockFromPy', onLockFromPy);
  (window as any).ascEventBus.on('returnFileLineFromCode', onHoverFromPy);
  (window as any).ascEventBus.on('returnSemanticLabelFromCode', onPyHoverLabel);

});
onBeforeUnmount(() => {
  cancelPySelection();
  invalidateGraphLayout();
  onSwimEcho.cancel();
  (window as any).ascEventBus.remove('returnSemanticLabelFromSwimToCom', onSwimEcho);
  (window as any).ascEventBus.remove('layoutEnding', onGraphLayoutEnding);
  (window as any).ascEventBus.remove('viewer_update', onGraphViewerUpdate);
  if (resetModelSource) {
    resetModelSource(true);
  }
  document.removeEventListener('click', onDocumentClick);
  window.removeEventListener('keydown', onFourColArrowKey);
  (window as any).ascEventBus.remove('stepRelatedOpNode', onStepRelatedOpNode);
  (window as any).ascEventBus.remove('lockToggleChange', onLockClick);
  (window as any).ascEventBus.remove('resetComGraphToFirst', resetToFirstStep);
  (window as any).ascEventBus.remove('cceFileSwitched', onCceFileSwitched);
  if (hoverTimer) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  (window as any).ascEventBus.remove('activeLockFromPy', onLockFromPy);
  (window as any).ascEventBus.remove('returnFileLineFromCode', onHoverFromPy);
  (window as any).ascEventBus.remove('returnSemanticLabelFromCode', onPyHoverLabel);

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
