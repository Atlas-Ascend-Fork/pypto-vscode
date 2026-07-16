/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { inject, injectable } from 'inversify';
import {
  Anchor,
  EMPTY_ROOT,
  IActionDispatcher,
  IContextMenuItemProvider,
  IContextMenuService,
  LabeledAction,
  MenuItem,
  SModelRootImpl,
  SChildElementImpl,
  TYPES,
  ViewerOptions,
  SNodeImpl,
} from 'sprotty';
import { Action, Point, SetPopupModelAction } from 'sprotty-protocol';
import { setFixedComGraphFlow } from '../utils/operation';
import { comGraphStore } from '../service/com-graph-store';
import { useViewServer } from '../core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { getQuery } from '@/core/query';
import { forEach } from 'lodash-es';
import { sizeType } from 'vue-devui/types/time-picker/src/types';

let rootNodes: Readonly<SModelRootImpl>;


const { server } = useViewServer<IComViewServer>();
@injectable()
export class AstgrContextMenuService implements IContextMenuService {
  @inject(TYPES.IActionDispatcher) readonly actionDispatcher: IActionDispatcher;
  @inject(TYPES.ViewerOptions) protected viewerOptions: ViewerOptions;

  show(items: MenuItem[], anchor: Anchor, onHide?: (() => void) | undefined): void {
    this.actionDispatcher.dispatch(SetPopupModelAction.create(EMPTY_ROOT));
    const container = document.getElementById(this.viewerOptions.baseDiv);
    let menuNode: HTMLDivElement;
    const hideMenu = () => {
      container?.removeChild(menuNode);
      if (onHide) {
        onHide();
      }
    };
    if (comGraphStore.data.comGraphConfig.isSimple && comGraphStore.data.comGraphConfig.canViewSubgraph) {
      if (items.length) {
        menuNode = this.createMenuForSimpleCom(items, hideMenu);
        container?.appendChild(menuNode);
        fitInsideViewport({ x: anchor.x, y: anchor.y }, menuNode);
        menuNode.onmouseleave = () => hideMenu();
      } else {
        onHide?.();
      }
    } else if (!comGraphStore.data.isDiffGraph && comGraphStore.data.comGraphConfig.canLockPath) {
      this.createMenu(items, hideMenu).then((res) => {
        menuNode = res;
        container?.appendChild(menuNode);
        fitInsideViewport({ x: anchor.x, y: anchor.y }, menuNode);
        menuNode.onmouseleave = (e: MouseEvent) => hideMenu();
      });
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

  findNeighbor(menuNode: HTMLDivElement, menuItem: HTMLDivElement, index: number, selectedNodeId: string, isBootStep = false) {
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

  private createMenuItemContent(menuItem: HTMLDivElement, item: MenuItem, index: number, menuNode: HTMLDivElement, isBootStep: boolean): void {
    if (item.label === '') {
      menuItem.textContent = item.label;
      menuItem.classList.add('disabled-action');
      return;
    }

    const { text, key } = splitLabel(item.label);

    if (item.id === 'JumpToSibling') {
      const selectedNodeId = (item.actions[0] as any as CallSetFixedAction).selectedNodeId;
      this.findNeighbor(menuNode, menuItem, index, selectedNodeId, isBootStep);
      return;
    }

    if (item.id === 'NewTabForCurPath') {
      const selectedNodeId = (item.actions[0] as any as CallSetFixedAction).selectedNodeId;
      const nodeMagic = this.extractNodeMagic(selectedNodeId);
      const textSpan = document.createElement('span');
      textSpan.textContent = text;
      textSpan.className = 'menu-text';

      if (nodeMagic === undefined) {
        textSpan.style.cursor = 'not-allowed';
      } else {
        textSpan.onclick = () => {
          if (isBootStep) return;
          (window as any).ascEventBus.emit('SearchModeOpen', String(nodeMagic));
        };
      }
      menuItem.appendChild(textSpan);
      return;
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    textSpan.className = 'menu-text';
    const keySpan = document.createElement('span');
    keySpan.className = 'shortcut-key';
    keySpan.textContent = key;
    menuItem.appendChild(textSpan);
    menuItem.appendChild(keySpan);
  }

  private createMenuItemClickHandler(item: MenuItem, closeCallback: () => void, isBootStep: boolean): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
      if (isBootStep && item.id !== 'FocusOnCurrent') return;
      closeCallback();
      if (item.actions.length === 0) return;

      const cb = item.actions.find((a) => a.kind === CALL_SET_FIXED) as CallSetFixedAction;
      if (item.id === 'JumpToSibling' || item.id === 'NewTabForCurPath') return;

      if (cb) {
        if (cb.goToCodeLine) {
          server.jumpToCodeLine({paramObj: {file: cb.codePath, line: cb.codeLine}});
          return;
        }
        setFixedComGraphFlow(cb.fixedFlag, cb.visibleFlag, cb?.selectedNodeId);
        if (cb?.selectedNodeId && cb?.selectedNodeId != '') {
          (window as any).ascEventBus.emit('switchLockInformation', [cb.fixedFlag, cb.visibleFlag]);
        }
        return;
      }
      this.actionDispatcher.dispatchAll(item.actions);
    };
  }

  protected async createMenu(items: MenuItem[], closeCallback: () => void): Promise<HTMLDivElement> {
    const res = await getQuery();
    const query = JSON.parse(res._uri.query);
    const isBootStep = Boolean(query.isBootStep);
    const menuNode = document.createElement('div');
    menuNode.id = 'astgr-context-menu';
    menuNode.classList.add('astgr-context-menu');

    items.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.id = `astgr-context-menu-item-${item.id}`;
      menuItem.classList.add('astgr-context-menu-item');
      if (isBootStep && item.id !== 'FocusOnCurrent') {
        menuItem.classList.add('disabled-action');
      }

      this.createMenuItemContent(menuItem, item, index, menuNode, isBootStep);
      menuItem.onclick = this.createMenuItemClickHandler(item, closeCallback, isBootStep);
      menuNode.appendChild(menuItem);
    });
    return menuNode;
  }

  protected createMenuForSimpleCom(items: MenuItem[], closeCallback: () => void) {
    const menuNode = document.createElement('div');
    menuNode.id = 'astgr-context-menu';
    menuNode.classList.add('astgr-context-menu');

    items.forEach((item) => {
      const menuItem = document.createElement('div');
      menuItem.id = `astgr-context-menu-item-${item.id}`;
      menuItem.classList.add('astgr-context-menu-item');
      const textSpan = document.createElement('span');
      textSpan.textContent = item.label;
      textSpan.className = 'menu-text';
      menuItem.appendChild(textSpan);
      menuItem.onclick = () => {
        const cb = item.actions.find((a) => a.kind === CALL_SET_FIXED) as CallSetFixedAction;
        (window as any).ascEventBus.emit('OpenSubGraphInThreeColumn', { selectedNode: cb.selectedNode });
        closeCallback();
      }

      menuNode.appendChild(menuItem);
    });

    return menuNode;
  }
}

export function findDestNode(selectedNodeId: string, buttonPos: string, nodeId: string): string {
  let tracePath = comGraphStore.data.historyPath;

  const nodePos = tracePath.findIndex(item => item === selectedNodeId);
  let newNodeId = nodeId;
  if (nodePos === -1) {
    tracePath = [];
    tracePath.push(selectedNodeId);
    if (buttonPos === 'left') {
      tracePath.unshift(nodeId);
    } else {
      tracePath.push(nodeId);
    }
    comGraphStore.setData('historyPath', tracePath);
  } else {
    if (buttonPos === 'left') {
      if (nodePos - 1 >= 0) {
        newNodeId = tracePath[nodePos - 1];
      } else {
        tracePath.unshift(newNodeId);
      }
    } else {
      if ((nodePos + 1) < tracePath.length) {
        newNodeId = tracePath[nodePos + 1];
      } else {
        tracePath.push(newNodeId);
      }
    }
  }
  return newNodeId;
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

@injectable()
export class AstgrContextMenuItemProvider implements IContextMenuItemProvider {
  @inject(TYPES.IActionDispatcher) readonly actionDispatcher: IActionDispatcher;

  async getItems(root: Readonly<SModelRootImpl>, lastMousePosition?: Point | undefined): Promise<MenuItem[]> {
    const selectedNode: Record<string, any>[] = root.children.filter((e) => (e as SNodeImpl).selected);
    const selectedNodeIds = selectedNode.map((e) => e.id);

    // 三栏模式，支持右键菜单打开子图
    if (selectedNode.length && comGraphStore.data.comGraphConfig.isSimple && comGraphStore.data.comGraphConfig.canViewSubgraph) {
      if (selectedNode[0].calleehash && comGraphStore.data.calleeMap && comGraphStore.data.calleeMap[selectedNode[0].calleehash]) {
        return [
          {
            id: 'openSubGraph',
            label: `${(window as any).ascLang === 'en' ? 'Open subgraph in new tab' : '在新标签打开子图'}`,
            actions: new LabeledAction(`${(window as any).ascLang === 'en' ? 'Open subgraph in new tab' : '在新标签打开子图'}`, [
              { kind: CALL_SET_FIXED, selectedNode: selectedNode[0] } as unknown as CallSetFixedAction,
            ])?.actions,
          },
        ];
      }
      return [];
    }
    
    rootNodes = root;

    const menuItemList = [
      {
        id: 'LockAndHightLight',
        label: `${(window as any).ascLang === 'en' ? 'Lock the path and highlight it' : '锁定通路并高亮'}[Ctrl+L]`,
        actions: new LabeledAction(`${(window as any).ascLang === 'en' ? 'Lock the path and highlight it' : '锁定通路并高亮'}[Ctrl+L]`, [callSetFixed(true, false, selectedNodeIds[0], false, '', 0)])?.actions,
      },
      {
        id: 'FocusOnCurrent',
        label: `${(window as any).ascLang === 'en' ? 'Focus only on the current path' : '只看当前通路'}[Ctrl+H]`,
        actions: new LabeledAction(`${(window as any).ascLang === 'en' ? 'Focus only on the current path' : '只看当前通路'}[Ctrl+H]`, [callSetFixed(true, true, selectedNodeIds[0], false, '', 0)])?.actions,
      },
      {
        id: 'NewTabForCurPath',
        label: `${(window as any).ascLang === 'en' ? 'View current path in new tab' : '在新标签查看当前通路'}`,
        actions: new LabeledAction(`${(window as any).ascLang === 'en' ? 'View current path in new tab' : '在新标签查看当前通路'}`, [callSetFixed(true, true, selectedNodeIds[0], false, '', 0)])?.actions,
      },
      {
        id: 'JumpToSibling',
        label: `${(window as any).ascLang === 'en' ? 'Switch Node' : '切换节点'}`,
        actions: new LabeledAction(`${(window as any).ascLang === 'en' ? 'Switch Node' : '切换节点'}`, [callSetFixed(true, true, selectedNodeIds[0], false, '', 0)])?.actions,
      },
      //   new LabeledAction('', []), // 后续需要再打开
      //   new LabeledAction('解除通路锁定[Esc]', [callSetFixed(false, false, [])]),
    ]

    const nodeInfo = root.children.filter(e => (e as SNodeImpl).selected);
    if (nodeInfo.length > 0 && (nodeInfo[0].codePath && nodeInfo[0].codeLine)) {
      const codeLineItem =
        {
          id: 'JumpToCodeLine',
          label: `${(window as any).ascLang === 'en' ? 'Jump to code line' :'跳转到代码行'}`,
          actions: new LabeledAction(`${(window as any).ascLang === 'en' ? 'Jump to code line' :'跳转到代码行'}`, [callSetFixed(false, false, selectedNodeIds[0], true, nodeInfo[0].codePath, nodeInfo[0].codeLine)])?.actions,
        }
      
      menuItemList.splice(-1, 0, codeLineItem);
    }

    return menuItemList;
  }
}
