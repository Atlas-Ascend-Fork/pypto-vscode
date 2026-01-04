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
