/**
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
 */
import { inject, injectable } from 'inversify';
import { EMPTY_ROOT, LabeledAction, SNodeImpl, TYPES, ViewerOptions } from 'sprotty';
import type { Anchor, IActionDispatcher, IContextMenuItemProvider, IContextMenuService, MenuItem, SModelRootImpl } from 'sprotty';
import { SetPopupModelAction } from 'sprotty-protocol';
import type { Action, Point } from 'sprotty-protocol';
import { setFixedComGraphFlow } from '../utils/operation';
import { comGraphStore } from '../service/com-graph-store';
import { useViewServer } from '../core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { getQuery } from '@/core/query';

/** 最近一次构建右键菜单时的图根节点，供“切换节点”功能查询相邻节点使用 */
let rootNodes: Readonly<SModelRootImpl>;

const { server } = useViewServer<IComViewServer>();

@injectable()
export class AstgrContextMenuService implements IContextMenuService {
  @inject(TYPES.IActionDispatcher) private readonly dispatcher: IActionDispatcher;
  @inject(TYPES.ViewerOptions) private readonly viewerOptions: ViewerOptions;

  show(items: MenuItem[], anchor: Anchor, onHide?: (() => void) | undefined): void {
    // 先关闭 sprotty 内置的 popup 弹层，避免与右键菜单叠加显示
    this.dispatcher.dispatch(SetPopupModelAction.create(EMPTY_ROOT));

    // teardown 在菜单挂载时生成，负责摘除菜单节点并回调调用方
    let teardown: (() => void) | undefined;
    const closeMenu = () => {
      teardown?.();
      teardown = undefined;
    };
    const mountMenu = (menuNode: HTMLDivElement) => {
      teardown = () => {
        menuNode.remove();
        onHide?.();
      };
      document.getElementById(this.viewerOptions.baseDiv)?.appendChild(menuNode);
      fitInsideViewport({ x: anchor.x, y: anchor.y }, menuNode);
      menuNode.onmouseleave = closeMenu;
    };

    const { isSimple, canViewSubgraph, canLockPath } = comGraphStore.data.comGraphConfig;
    if (isSimple && canViewSubgraph) {
      // 简图三栏模式：菜单只包含“在新标签打开子图”类入口
      if (items.length === 0) {
        onHide?.();
        return;
      }
      mountMenu(this.buildSimpleGraphMenu(items, closeMenu));
    } else if (!comGraphStore.data.isDiffGraph && canLockPath) {
      this.buildFullMenu(items, closeMenu).then(mountMenu);
    }
  }

  jumpNodeButtonStyleFit(buttonPos: string, buttonText: string, selectedNodeId: string, nodeId: string, isBootStep = false): HTMLDivElement {
    const nodeWrap = document.createElement('div');
    nodeWrap.style.cssText = 'transition:background-color .15s;border-radius:4px;padding:2px 4px;cursor:pointer;display:flex;flex-direction:row;align-items:center;margin-top:6px;gap:3px';
    nodeWrap.classList.add('jump-button-item');
    const nodeArrowBox = document.createElement('span');
    nodeArrowBox.style.cssText = 'border:1px solid var(--devui-placeholder-text);padding:3px 3px;border-radius:4px;display:inline-flex;align-items:center;'
    const nodeArrow = document.createElement('i');
    nodeArrow.className = `icon-arrow-${buttonPos}-l` ;
    nodeArrow.style.fontSize = '12px';
    nodeArrowBox.appendChild(nodeArrow);
    const nodeText = document.createElement('span');
    nodeText.textContent = buttonText;
    nodeWrap.appendChild(nodeArrowBox);
    nodeWrap.appendChild(nodeText);

    if (!nodeId) {
      nodeWrap.style.cursor = 'not-allowed';
    } else {
      if (isBootStep || !nodeId) {
        return;
      }
      nodeWrap.onclick = () => {
        const newNodeId = findDestNode(selectedNodeId, buttonPos, nodeId);
        (window as any).ascEventBus.emit('jump2SiblingNode', newNodeId);
      }
    }
    return nodeWrap;
  }

  findNeighbor(menuNode: HTMLDivElement, menuItem: HTMLDivElement, selectedNodeId: string, isBootStep = false) {
    menuItem.style.backgroundColor = 'transparent';

    const splitLine = document.createElement('div');
    splitLine.style.cssText = 'border:none;border-top:1px solid var(--devui-split-line);margin-top:6px;margin-bottom:6px'
    menuNode.appendChild(splitLine);

    const shortCutContainer = document.createElement('div');

    const shortCutTitle = document.createElement('div');
    shortCutTitle.style.cssText = 'menu-text;color: var(--devui-title-text);margin-bottom:3px';
    shortCutTitle.textContent = `${(window as any).ascLang === 'en' ? 'Switch Node': '切换节点'}`;
    shortCutContainer.appendChild(shortCutTitle);

    const [previousNode, nextNode] = findNeighborNode(selectedNodeId, rootNodes);
    const leftWrap = this.jumpNodeButtonStyleFit('left', `${(window as any).ascLang === 'en' ? 'Previous Node': '上一个'}`, selectedNodeId, previousNode, isBootStep);
    const rightWrap = this.jumpNodeButtonStyleFit('right', `${(window as any).ascLang === 'en' ? 'Next Node': '下一个'}`, selectedNodeId, nextNode, isBootStep);

    const findSibling = document.createElement('div');
    findSibling.style.cssText = 'display:flex;align-items:center;gap:16px;fontSize:12px;color:var(--devui-primary-text)';
    findSibling.appendChild(leftWrap);
    findSibling.appendChild(rightWrap);
    shortCutContainer.appendChild(findSibling);

    menuItem.appendChild(shortCutContainer);
    menuNode.appendChild(menuItem);
  }

  extractNodeMagic(nodeId: string): number {
    const TensorNodeIdPrefix = 'tensor-';
    const OperationNodeIdPrefix = 'operation-magic-';
    let nodeMagic;
    if (nodeId.includes(OperationNodeIdPrefix)) {
      nodeMagic = parseInt(nodeId.split(OperationNodeIdPrefix)[1]);
    } else if (nodeId.includes(TensorNodeIdPrefix)) {
      nodeMagic = parseInt(nodeId.split(TensorNodeIdPrefix)[1]);
    }
    return nodeMagic;
  }

  /** 渲染单个菜单项的内容：普通项为“文本 + 快捷键”，特殊项单独渲染交互组件 */
  private renderItemContent(itemNode: HTMLDivElement, item: MenuItem, menuNode: HTMLDivElement, bootStepMode: boolean): void {
    if (item.label === '') {
      itemNode.textContent = item.label;
      itemNode.classList.add('disabled-action');
      return;
    }

    const { text, key } = splitLabel(item.label);

    if (item.id === 'JumpToSibling') {
      // 切换节点：渲染分割线与上/下一个节点跳转按钮
      const { selectedNodeId } = item.actions[0] as unknown as CallSetFixedAction;
      this.findNeighbor(menuNode, itemNode, selectedNodeId, bootStepMode);
      return;
    }

    if (item.id === 'NewTabForCurPath') {
      // 新标签查看当前通路：点击后打开 SearchMode 并定位节点
      const { selectedNodeId } = item.actions[0] as unknown as CallSetFixedAction;
      const nodeMagic = this.extractNodeMagic(selectedNodeId);
      itemNode.appendChild(this.createMagicSearchLabel(text, nodeMagic, bootStepMode));
      return;
    }

    appendLabelWithShortcut(itemNode, text, key);
  }

  /** “新标签查看当前通路”入口的文本标签，可点击时跳转到 SearchMode */
  private createMagicSearchLabel(text: string, nodeMagic: number | undefined, bootStepMode: boolean): HTMLSpanElement {
    const label = createSpan('menu-text', text);
    if (nodeMagic === undefined) {
      // 无法从节点 id 解析出 magic 时，入口置灰不可点击
      label.style.cursor = 'not-allowed';
      return label;
    }
    label.onclick = () => {
      if (bootStepMode) {
        return;
      }
      (window as any).ascEventBus.emit('SearchModeOpen', String(nodeMagic));
    };
    return label;
  }

  /** 菜单项点击处理：先收起菜单，再执行锁通路/跳代码行等动作 */
  private runItemActions(item: MenuItem, closeCallback: () => void, bootStepMode: boolean): void {
    if (bootStepMode && item.id !== 'FocusOnCurrent') {
      return;
    }
    closeCallback();
    if (item.actions.length === 0) {
      return;
    }
    // 切换节点 / 新标签查看通路的行为已在内容渲染阶段单独处理
    if (item.id === 'JumpToSibling' || item.id === 'NewTabForCurPath') {
      return;
    }
    const fixedAction = findFixedAction(item);
    if (!fixedAction) {
      this.dispatcher.dispatchAll(item.actions);
      return;
    }
    if (fixedAction.goToCodeLine) {
      server.jumpToCodeLine({paramObj: {file: fixedAction.codePath, line: fixedAction.codeLine}});
      return;
    }
    setFixedComGraphFlow(fixedAction.fixedFlag, fixedAction.visibleFlag, fixedAction.selectedNodeId);
    if (fixedAction.selectedNodeId) {
      (window as any).ascEventBus.emit('switchLockInformation', [fixedAction.fixedFlag, fixedAction.visibleFlag]);
    }
  }

  /** 完整右键菜单：需要异步读取 webview query 以判断是否处于 boot step 模式 */
  private async buildFullMenu(items: MenuItem[], closeCallback: () => void): Promise<HTMLDivElement> {
    const bootStepMode = await resolveBootStepMode();
    const menuNode = createMenuShell();
    for (const item of items) {
      const itemNode = createItemShell(item);
      if (bootStepMode && item.id !== 'FocusOnCurrent') {
        itemNode.classList.add('disabled-action');
      }
      this.renderItemContent(itemNode, item, menuNode, bootStepMode);
      itemNode.onclick = () => this.runItemActions(item, closeCallback, bootStepMode);
      menuNode.appendChild(itemNode);
    }
    return menuNode;
  }

  /** 简图模式右键菜单：仅一个入口，点击后经事件总线打开三栏子图 */
  private buildSimpleGraphMenu(items: MenuItem[], closeCallback: () => void): HTMLDivElement {
    const menuNode = createMenuShell();
    items.forEach((item) => {
      const itemNode = createItemShell(item);
      itemNode.appendChild(createSpan('menu-text', item.label));
      itemNode.onclick = () => {
        const fixedAction = findFixedAction(item);
        (window as any).ascEventBus.emit('OpenSubGraphInThreeColumn', { selectedNode: fixedAction?.selectedNode });
        closeCallback();
      };
      menuNode.appendChild(itemNode);
    });
    return menuNode;
  }
}

export function findDestNode(selectedNodeId: string, buttonPos: string, nodeId: string): string {
  const tracePath = comGraphStore.data.historyPath;
  const nodePos = tracePath.indexOf(selectedNodeId);
  // 当前节点不在历史路径中：以它为起点重新建路
  if (nodePos === -1) {
    comGraphStore.setData('historyPath', buttonPos === 'left' ? [nodeId, selectedNodeId] : [selectedNodeId, nodeId]);
    return nodeId;
  }
  if (buttonPos === 'left') {
    if (nodePos > 0) {
      return tracePath[nodePos - 1];
    }
    tracePath.unshift(nodeId);
  } else if (nodePos + 1 < tracePath.length) {
    return tracePath[nodePos + 1];
  } else {
    tracePath.push(nodeId);
  }
  return nodeId;
}

export function findNeighborNode(selectedNode: string, rootNodes: Readonly<SModelRootImpl>): string[] {
  if (!rootNodes) {
    return [];
  }

  const relativeNodes = rootNodes?.children.filter((e) => (e.type.includes('edge') && (e.sourceId.includes(selectedNode) || e.targetId.includes(selectedNode))));

  let sourceNodesIdList = [];
  let targetNodesIdList = [];
  relativeNodes.forEach((elem) => {
    if(elem.sourceId.includes(selectedNode)) {
      const targetNode = elem.targetId.split('-')?.slice(0, -1)?.join('-');
      targetNodesIdList.push(targetNode);
    } else if (elem.targetId.includes(selectedNode)) {
      const sourceNode = elem.sourceId.split('-')?.slice(0, -1)?.join('-');
      sourceNodesIdList.push(sourceNode);
    }
  });

  let sourceNodesList = [];
  let targetNodesList = [];
  rootNodes.children.forEach(node => {
    if (sourceNodesIdList.includes(node.id)) {
      sourceNodesList.push(node);
    } else if (targetNodesIdList.includes(node.id)) {
      targetNodesList.push(node);
    }
  });

  let previousNode = sourceNodesList?.[0];
  let nextNode = targetNodesList?.[0];
  targetNodesList.forEach(node => {
    if (node.position.y < nextNode.position.y) {
      nextNode = node;
    }
  });

  sourceNodesList.forEach(node => {
    if (node.position.y < previousNode.position.y) {
      previousNode = node;
    }
  });

  return [previousNode?.id ? previousNode.id: '', nextNode?.id ? nextNode.id: ''];
}

function fitInsideViewport(anchor: Point, menuNode: HTMLElement): void {
  const pad = -4;
  const { innerWidth, innerHeight } = window;
  const { offsetWidth: mw, offsetHeight: mh } = menuNode;

  let x = anchor.x + pad;
  let y = anchor.y + pad;

  // 右边溢出 → 贴到鼠标左侧
  if (x + mw > innerWidth - pad) {
    x = anchor.x - mw - pad;
  }
  // 下边溢出 → 贴到鼠标上方
  if (y + mh > innerHeight - pad) {
    y = anchor.y - mh - pad;
  }
  // 保险：如果上面两步后仍为负，直接 0
  x = Math.max(pad, x);
  y = Math.max(pad, y);

  menuNode.style.left = `${x}px`;
  menuNode.style.top  = `${y}px`;
}

function splitLabel(label: string): { text: string; key: string } {
  const m = label.match(/^(.+?)\[(.+?)\]$/);
  return m ? { text: m[1], key: m[2] } : { text: label, key: '' };
}

function createMenuShell(): HTMLDivElement {
  const menuNode = document.createElement('div');
  menuNode.id = 'astgr-context-menu';
  menuNode.classList.add('astgr-context-menu');
  return menuNode;
}

function createItemShell(item: MenuItem): HTMLDivElement {
  const itemNode = document.createElement('div');
  itemNode.id = `astgr-context-menu-item-${item.id}`;
  itemNode.classList.add('astgr-context-menu-item');
  return itemNode;
}

function createSpan(className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function appendLabelWithShortcut(itemNode: HTMLDivElement, text: string, key: string): void {
  itemNode.appendChild(createSpan('menu-text', text));
  itemNode.appendChild(createSpan('shortcut-key', key));
}

async function resolveBootStepMode(): Promise<boolean> {
  const queryResult = await getQuery();
  const query = JSON.parse(queryResult._uri.query);
  return Boolean(query.isBootStep);
}

function findFixedAction(item: MenuItem): CallSetFixedAction | undefined {
  return item.actions.find((action) => action.kind === CALL_SET_FIXED) as CallSetFixedAction | undefined;
}

export const CALL_SET_FIXED = 'callSetFixed';

// 2. Action 接口不变
export interface CallSetFixedAction extends Action {
  kind: typeof CALL_SET_FIXED;
  fixedFlag: boolean;
  visibleFlag: boolean;
  selectedNodeId: string;
  goToCodeLine: boolean;
  codePath: string;
  codeLine: number;
  selectedNode?: Record<string, any>;
}

// 3. 工厂函数
export const callSetFixed = (fixedFlag: boolean, visibleFlag: boolean, selectedNodeId: string, goToCodeLine: boolean, codePath: string, codeLine: number): CallSetFixedAction => ({
  kind: CALL_SET_FIXED,
  fixedFlag,
  visibleFlag,
  selectedNodeId,
  goToCodeLine,
  codePath,
  codeLine,
});

/** 三栏模式下选中带子图的节点时，返回“在新标签打开子图”菜单项 */
function buildOpenSubgraphItem(node: Record<string, any>): MenuItem[] {
  const { calleeMap } = comGraphStore.data;
  if (!node.calleehash || !calleeMap || !calleeMap[node.calleehash]) {
    return [];
  }
  const label = `${(window as any).ascLang === 'en' ? 'Open subgraph in new tab' : '在新标签打开子图'}`;
  return [
    {
      id: 'openSubGraph',
      label,
      actions: new LabeledAction(label, [{ kind: CALL_SET_FIXED, selectedNode: node } as unknown as CallSetFixedAction])?.actions,
    },
  ];
}

/** 默认菜单项：锁通路/只看通路/新标签查看通路/切换节点，选中节点带代码信息时附加“跳转到代码行” */
function assembleDefaultItems(selectedNodes: Record<string, any>[], selectedIds: string[]): MenuItem[] {
  const isEn = (window as any).ascLang === 'en';
  const lockPathLabel = `${isEn ? 'Lock the path and highlight it' : '锁定通路并高亮'}[Ctrl+L]`;
  const focusPathLabel = `${isEn ? 'Focus only on the current path' : '只看当前通路'}[Ctrl+H]`;
  const newTabLabel = isEn ? 'View current path in new tab' : '在新标签查看当前通路';
  const switchNodeLabel = isEn ? 'Switch Node' : '切换节点';

  const menuItems: MenuItem[] = [
    {
      id: 'LockAndHightLight',
      label: lockPathLabel,
      actions: new LabeledAction(lockPathLabel, [callSetFixed(true, false, selectedIds[0], false, '', 0)])?.actions,
    },
    {
      id: 'FocusOnCurrent',
      label: focusPathLabel,
      actions: new LabeledAction(focusPathLabel, [callSetFixed(true, true, selectedIds[0], false, '', 0)])?.actions,
    },
    {
      id: 'NewTabForCurPath',
      label: newTabLabel,
      actions: new LabeledAction(newTabLabel, [callSetFixed(true, true, selectedIds[0], false, '', 0)])?.actions,
    },
    {
      id: 'JumpToSibling',
      label: switchNodeLabel,
      actions: new LabeledAction(switchNodeLabel, [callSetFixed(true, true, selectedIds[0], false, '', 0)])?.actions,
    },
    // 后续可按需恢复：分隔空项、解除通路锁定[Esc]
  ];

  const firstSelected = selectedNodes[0];
  if (firstSelected?.codePath && firstSelected?.codeLine) {
    const jumpToCodeLabel = isEn ? 'Jump to code line' : '跳转到代码行';
    menuItems.splice(menuItems.length - 1, 0, {
      id: 'JumpToCodeLine',
      label: jumpToCodeLabel,
      actions: new LabeledAction(jumpToCodeLabel, [
        callSetFixed(false, false, selectedIds[0], true, firstSelected.codePath, firstSelected.codeLine),
      ])?.actions,
    });
  }
  return menuItems;
}

@injectable()
export class AstgrContextMenuItemProvider implements IContextMenuItemProvider {
  async getItems(root: Readonly<SModelRootImpl>, lastMousePosition?: Point | undefined): Promise<MenuItem[]> {
    const selectedNodes = root.children.filter((child) => (child as SNodeImpl).selected) as Record<string, any>[];
    const selectedIds = selectedNodes.map((node) => node.id);
    const { isSimple, canViewSubgraph } = comGraphStore.data.comGraphConfig;

    // 三栏联动模式：右键菜单只提供“在新标签打开子图”入口
    if (selectedNodes.length > 0 && isSimple && canViewSubgraph) {
      return buildOpenSubgraphItem(selectedNodes[0]);
    }

    rootNodes = root;
    return assembleDefaultItems(selectedNodes, selectedIds);
  }
}
