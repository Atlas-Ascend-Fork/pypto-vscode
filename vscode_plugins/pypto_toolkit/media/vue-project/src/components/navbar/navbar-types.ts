import type { PropType, InjectionKey, ExtractPropTypes, Ref } from 'vue';
import type { OutputRecord } from '../../../../../src/types/workspace/output';
import type { ControlFlowPath, ControlFlowIf, ControlFlowLoop, PathInPass, LeafInPass } from '../../../../../src/types/control-flow';

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
    default: 'controlFlow',
  },
  currentPathMagicName: {
    type: String as PropType<ControlFlowPath['magicName']>,
    default: '',
  },
  currentPassIndex: {
    type: String as PropType<PathInPass['passIndex']>,
    default: '',
  },
  currentLeafName: {
    type: String as PropType<LeafInPass['leafName']>,
    default: '',
  },
  controlFlowData:{
      type:Array as PropType<ControlFlowData[]>,
      default:[]
  }
};

type NavbarProps = ExtractPropTypes<typeof navbarProps>;

export interface NavbarContext {
  rootProps: NavbarProps;
  historyList: Ref<HistoryData[]>;
  controlFlowList: Ref<ControlFlowData[]>;
  passList: Ref<PathInPass[]>;
  leafFunctions: Ref<LeafInPass[]>;
  jumpComGraph: (filePath: string, pathName?: string) => void;
}
export const NavbarProvideKey = 'navbar' as unknown as InjectionKey<NavbarContext>;
