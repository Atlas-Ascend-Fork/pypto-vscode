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
    if (visibleFlag != comGraphStore.data.unVisibleOtherNodes) {
      comGraphStore.setData('unVisibleOtherNodes', visibleFlag);
    }
  } else {
    // 取消锁定
    if (fixedFlag != comGraphStore.data.inFixedComGraphFlow) {
      comGraphStore.setData('inFixedComGraphFlow', fixedFlag);
    }
    if (visibleFlag != comGraphStore.data.unVisibleOtherNodes) {
      comGraphStore.setData('unVisibleOtherNodes', visibleFlag);
    }
  }
  if (comGraphStore.data.updateModelActionFunc) comGraphStore.data.updateModelActionFunc();
  if (comGraphStore.data.renderMinimapFunc) comGraphStore.data.renderMinimapFunc();
  return;
}
