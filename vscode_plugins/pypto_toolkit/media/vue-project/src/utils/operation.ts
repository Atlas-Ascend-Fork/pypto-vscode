/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
