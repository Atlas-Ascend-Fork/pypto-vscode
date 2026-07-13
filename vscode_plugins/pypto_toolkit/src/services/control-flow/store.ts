/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { defineAttributes, SqlStore, Store } from '../../core/store';
import { ControlFlowIf, ControlFlowLoop, ControlFlowPath } from '../../types/control-flow';

export interface ControlFlowCache {
  sourceFilePath: string;
  runDataPath: string;
  flow: (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[];
}

const CONTROL_FLOW_ATTRIBUTES = defineAttributes<ControlFlowCache>({
  sourceFilePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  runDataPath: { type: String, isQuery: true },
  flow: { type: Array },
});

let controlFlowStore: Store<ControlFlowCache, 'sourceFilePath', 'runDataPath'>;

export function getControlFlowStore() {
  if (!controlFlowStore) {
    controlFlowStore = new SqlStore('control_flow', CONTROL_FLOW_ATTRIBUTES);
  }
  return controlFlowStore;
}
