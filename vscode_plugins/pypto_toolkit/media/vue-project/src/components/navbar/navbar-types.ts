import type { PropType, InjectionKey, ExtractPropTypes, Ref } from 'vue';

interface RunData {
  label: string;
  date: string;
}

type PassStage = 'tensor' | 'tile' | 'block';

export interface PassData {
  passIndex: string;
  passStage: PassStage;
  passName: string;
  hasHealthReport: boolean;
}

export interface LeafFunctionData {
  magic: number;
  magicName: string;
  hash: string;
}

interface PathMetaData {
  leafFunctions: LeafFunctionData[];
  passes: PassData[];
}

export interface PathData {
  nodeType: string;
  magic: number;
  magicName: string;
  hash: string;
  children?: PathData[];
  meta?: PathMetaData;
  [k: string]: any;
}

type Step = 'controlFlow' | 'comGraph';

export const navbarProps = {
  currentRunData: {
    type: Object as PropType<RunData>,
    default: () => ({}),
  },
  currentStep: {
    type: String as PropType<Step>,
    default: 'comGraph',
  },
  historyList: {
    type: Array as PropType<RunData[]>,
    default: () => [],
  },
  pathList: {
    type: Array,
    default: () => [],
  },
};

type NavbarProps = ExtractPropTypes<typeof navbarProps>;

export interface NavbarContext {
  rootProps: NavbarProps;
  passList: Ref<PassData[]>;
  leafFunctions: Ref<LeafFunctionData[]>;
}
export const NavbarProvideKey = 'navbar' as unknown as InjectionKey<NavbarContext>;
