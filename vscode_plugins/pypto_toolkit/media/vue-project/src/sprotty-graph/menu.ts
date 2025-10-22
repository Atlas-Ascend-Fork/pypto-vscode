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
  TYPES,
  ViewerOptions,
  SNodeImpl,
} from 'sprotty';
import { Action, Point, SetPopupModelAction } from 'sprotty-protocol';
import { setFixedComGraphFlow } from '../utils/operation';
import { comGraphStore } from '../service/com-graph-store';

@injectable()
export class AstgrContextMenuService implements IContextMenuService {
  @inject(TYPES.IActionDispatcher) readonly actionDispatcher: IActionDispatcher;
  @inject(TYPES.ViewerOptions) protected viewerOptions: ViewerOptions;

  show(items: MenuItem[], anchor: Anchor, onHide?: (() => void) | undefined): void {
    this.actionDispatcher.dispatch(SetPopupModelAction.create(EMPTY_ROOT));
    const container = document.getElementById(this.viewerOptions.baseDiv);
    // eslint-disable-next-line prefer-const
    let menuNode: HTMLDivElement;
    const hideMenu = () => {
      container?.removeChild(menuNode);
      if (onHide) {
        onHide();
      }
    };
    if (!comGraphStore.data.isDiffGraph && !comGraphStore.data.isSimpleComGraph) {
      menuNode = this.createMenu(items, hideMenu);
  
      container?.appendChild(menuNode);
      fitInsideViewport({ x: anchor.x, y: anchor.y }, menuNode);
  
      menuNode.onmouseleave = (e: MouseEvent) => hideMenu();
    }
  }

  protected createMenu(items: MenuItem[], closeCallback: () => void): HTMLDivElement {
    const menuNode = document.createElement('div');
    menuNode.id = 'astgr-context-menu';
    menuNode.classList.add('astgr-context-menu');

    items.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.id = 'astgr-context-menu-item-' + index;
      menuItem.classList.add('astgr-context-menu-item');

      if (item.label != '') {
        const { text, key } = splitLabel(item.label);

        /* 文字 span */
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        textSpan.className = 'menu-text';

        /* 快捷键提示 span */
        const keySpan = document.createElement('span');
        keySpan.className = 'shortcut-key';
        keySpan.textContent = key;

        menuItem.appendChild(textSpan);
        menuItem.appendChild(keySpan);
      } else {
        menuItem.textContent = item.label;
        menuItem.classList.add('disabled-action');
      }

      menuItem.onclick = (e: MouseEvent) => {
        closeCallback();
        if (item.actions.length > 0) {
          // 自己识别“回调型”Action
          const cb = item.actions.find((a) => a.kind === CALL_SET_FIXED) as CallSetFixedAction;
          if (cb) {
            // ← 命中就走捷径
            if (cb.goToCodeLine) {
              vscode.postMessage({
                command:'jumpToCodeLine',
                paramObj: {file: cb.codePath, line: cb.codeLine},
              });
              return;
            }
            setFixedComGraphFlow(cb.fixedFlag, cb.visibleFlag, cb?.selectedNodeId);
            if(cb?.selectedNodeId && cb?.selectedNodeId!=''){
             (window as any).ascEventBus.emit('switchLockInformation', [cb.fixedFlag,cb.visibleFlag]);
            }
            return;
          }
          // 正常 Action 继续走
          this.actionDispatcher.dispatchAll(item.actions);
        }
      };
      menuNode.appendChild(menuItem);
    });
    return menuNode;
  }
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

  async getItems(root: Readonly<SModelRootImpl>, lastMousePosition?: Point | undefined): Promise<LabeledAction[]> {
    const selectedNodeIds = root.children.filter((e) => (e as SNodeImpl).selected).map((e) => e.id);

    const nodeInfo = root.children.filter(e => (e as SNodeImpl).selected);
    if (nodeInfo.length > 0 && !nodeInfo[0].calleehash && nodeInfo[0].codePath) {
      return [
        new LabeledAction(`${(window as any).ascLang === 'en' ? 'Lock the path and highlight it' : '锁定通路并高亮'}[Ctrl+L]`, [callSetFixed(true, false, selectedNodeIds[0], false, '', 0)]),
        new LabeledAction(`${(window as any).ascLang === 'en' ? 'Focus only on the current path' : '只看当前通路'}[Ctrl+H]`, [callSetFixed(true, true, selectedNodeIds[0], false, '', 0)]),
        new LabeledAction(`${(window as any).ascLang === 'en' ? 'Jump to code line' :'跳转到代码行'}`, [callSetFixed(false, false, selectedNodeIds[0], true, nodeInfo[0].codePath, nodeInfo[0].codeLine)]),
        //   new LabeledAction('', []), // 后续需要再打开
        //   new LabeledAction('解除通路锁定[Esc]', [callSetFixed(false, false, [])]),
      ];
    }

    return [
      new LabeledAction(`${(window as any).ascLang === 'en' ? 'Lock the path and highlight it' : '锁定通路并高亮'}[Ctrl+L]`, [callSetFixed(true, false, selectedNodeIds[0], false, '', 0)]),
      new LabeledAction(`${(window as any).ascLang === 'en' ? 'Focus only on the current path' : '只看当前通路'}[Ctrl+H]`, [callSetFixed(true, true, selectedNodeIds[0], false, '', 0)]),
      //   new LabeledAction('', []), // 后续需要再打开
      //   new LabeledAction('解除通路锁定[Esc]', [callSetFixed(false, false, [])]),
    ];
  }
}
