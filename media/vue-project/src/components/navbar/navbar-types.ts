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
import type { PropType, InjectionKey, ExtractPropTypes, Ref } from 'vue';
import type { OutputRecord } from '../../../../../src/types/workspace/output';
import type { ControlFlowPath, ControlFlowIf, ControlFlowLoop, PathInPass, LeafInPass, CallLeafRecord } from '../../../../../src/types/control-flow';

export type HistoryData = OutputRecord;

export type ControlFlowData = ControlFlowPath | ControlFlowIf | ControlFlowLoop;

export interface PathTreeData {
  controlFlowData: ControlFlowData;
  label: string;
  parentNode?: PathTreeData;
  expanded?: boolean;
  disableToggle?: boolean;
  children?: PathTreeData[];
  [key: string]: any;
}

type Step = 'controlFlow' | 'comGraph' | 'swimGraph';

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
  controlFlowData: {
    type: Array as PropType<ControlFlowData[]>,
    default: () => [],
  },
};

type NavbarProps = ExtractPropTypes<typeof navbarProps>;

export interface NavbarContext {
  rootProps: NavbarProps;
  controlFlowList: Ref<ControlFlowData[]>;
  passList: Ref<PathInPass[]>;
  leafFunctions: Ref<LeafInPass[]>;
  currentPathCalledLeafRecord: Ref<CallLeafRecord[]>;
  currentLeafData: Ref<LeafInPass>;
  jumpComGraph: (filePath: string, pathName?: string, blank?: boolean) => void;
}
export const NavbarProvideKey = 'navbar' as unknown as InjectionKey<NavbarContext>;
