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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

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
