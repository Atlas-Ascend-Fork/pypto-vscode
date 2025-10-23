import type { PropType, InjectionKey, ExtractPropTypes, Ref } from 'vue';
import type { OutputRecord } from '../../../../../src/types/workspace/output';
import type { ControlFlowPath, ControlFlowIf, ControlFlowLoop, PathInPass, LeafFunction } from '../../../../../src/types/control-flow';

export type HistoryData = OutputRecord;



export type ControlFlowData = ControlFlowPath | ControlFlowIf | ControlFlowLoop;

export interface PathTreeData {
  controlFlowData: ControlFlowData;
  id: number;
  label: string;
  parentNode?: PathTreeData;
  expanded?: boolean;
  disableToggle?: boolean;
  children?: PathTreeData[];
  [key: string]: any;
}

type Step = 'controlFlow' | 'comGraph';

export const navbarProps = {
  currentRecordDirectoryPath: {
    type: String as PropType<HistoryData['directoryPath']>,
    default: '',
  },
  currentStep: {
    type: String as PropType<Step>,
    default: 'comGraph',
  },
  currentPathMagic: {
    type: Number as PropType<ControlFlowPath['magic']>,
    default: -1,
  },
  currentPassName: {
    type: String as PropType<PathInPass['passName']>,
    default: '',
  },
  currentLeafHash: {
    type: String as PropType<LeafFunction['hash']>,
    default: '',
  },
};

type NavbarProps = ExtractPropTypes<typeof navbarProps>;

export type NavbarEmits = {
  (e: 'currentRecordChange', msg: HistoryData['directoryPath']): void;
  (e: 'currentPathChange', msg: ControlFlowPath['magic']): void;
  (e: 'currentPassChange', msg: PathInPass['passName']): void;
  (e: 'currentLeafChange', msg: LeafFunction['hash']): void;
};

export interface NavbarContext {
  rootProps: NavbarProps;
  rootEmits: NavbarEmits;
  historyList: Ref<HistoryData[]>;
  controlFlowList: Ref<ControlFlowData[]>;
  passList: Ref<PathInPass[]>;
  leafFunctions: Ref<LeafFunction[]>;
}
export const NavbarProvideKey = 'navbar' as unknown as InjectionKey<NavbarContext>;
