import { comGraphStore } from '../service/com-graph-store';

export function setFixedComGraphFlow(fixedFlag: boolean, visibleFlag: boolean, selectedNodeId?: string): any {
  if (fixedFlag) {
    if (!selectedNodeId) {
      (window as any).ascEventBus.emit('message_notice', (window as any).ascLang === 'en' ? 'Please select the node first' : '请先选中节点');
      return;
    }
    comGraphStore.setData('fixedNodeId', selectedNodeId);
    if (fixedFlag != comGraphStore.data.inFixedComGraphFlow) {
      comGraphStore.setData('inFixedComGraphFlow', fixedFlag);
    }
    if (visibleFlag != comGraphStore.data.visibleOtherNodes) {
      comGraphStore.setData('visibleOtherNodes', visibleFlag);
    }
  } else {
    // 取消锁定
    if (fixedFlag != comGraphStore.data.inFixedComGraphFlow) {
      comGraphStore.setData('inFixedComGraphFlow', fixedFlag);
    }
    if (visibleFlag != comGraphStore.data.visibleOtherNodes) {
      comGraphStore.setData('visibleOtherNodes', visibleFlag);
    }
  }
  if (comGraphStore.data.updateModelActionFunc) comGraphStore.data.updateModelActionFunc();
  if (comGraphStore.data.renderMinimapFunc) comGraphStore.data.renderMinimapFunc();
  return;
}
