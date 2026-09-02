/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import type { ExtractPropTypes, PropType } from 'vue';

export interface IItemData {
  index: number;
  data: Record<string, any>;
  $height: number;
  $offsetTop: number;
}

export interface IScrollParams {
  distance: number;
  renderCountPerScreen: number;
  scrollScale: Array<number>;
  originData: Array<IItemData>;
}

export const virtualScrollProps = {
  data: {
    type: Array as PropType<Array<Record<string, any>>>,
    default: () => [],
  },
  itemHeight: {
    type: Number,
    default: 30,
  },
};
export type VirtualScrollProps = ExtractPropTypes<typeof virtualScrollProps>;
