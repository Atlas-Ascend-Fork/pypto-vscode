/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
