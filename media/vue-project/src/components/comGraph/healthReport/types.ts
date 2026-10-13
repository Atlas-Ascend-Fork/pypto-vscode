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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { PropType, InjectionKey, Ref } from 'vue';

export enum ColumnAlign {
  Left = 'left',
  Right = 'right',
}

export interface ColumnItem {
  field: string;
  header: string;
  width?: number | string;
  align?: ColumnAlign;
}

// "品字形"统计信息
export const statisticInfoProps = {
  title: String,
  count: [String, Number],
  type: {
    type: String as PropType<'op' | 'tensor' | 'total'>,
    default: '',
  },
};

// 数据列表
export const dataListProps = {
  data: {
    type: Array as PropType<Record<string, any>[]>,
    default: () => [],
  },
  columns: {
    type: Array as PropType<ColumnItem[]>,
    default: () => [],
  },
  columnCount: {
    type: Number,
    default: 5,
  },
  disableCollapsePanel: {
    type: Boolean,
    default: false
  }
};

// "最大"信息
export const limitInfoProps = {
  label: String,
  value: [String, Number],
  type: {
    type: String as PropType<'max-width' | 'max-depth'>,
    default: 'max-depth',
  },
};

// 带提示的统计信息
export const tipsInfoProps = {
  title: String,
  count: [String, Number],
  tips: String,
};

// 计算单元+计算流水
export const calcUnitProps = {
  width: Number,
  height: Number,
  badgeText: String,
  type: {
    type: String as PropType<'no-data' | 'has-data' | 'warning'>,
    default: 'no-data',
  },
  title: String,
  count: [String, Number],
};

// 存储单元
export const storageUnitProps = {
  width: Number,
  height: Number,
  badgeText: String,
  type: {
    type: String as PropType<'no-data' | 'has-data'>,
    default: 'no-data',
  },
  titles: {
    type: Array as PropType<Array<string | number>>,
    default: () => [],
  },
  counts: {
    type: Array as PropType<Array<string | number>>,
    default: () => [],
  },
};

// 纯流水
export const flowWaterProps = {
  arrowType: {
    type: String as PropType<'left' | 'right'>,
    default: 'right',
  },
  type: {
    type: String as PropType<'no-data' | 'has-data' | 'warning'>,
    default: 'has-data',
  },
  title: String,
  count: [String, Number],
};

// 箭头
export const arrowItemProps = {
  direction: {
    type: String as PropType<'horizontal' | 'vertical'>,
    default: 'horizontal',
  },
  type: {
    type: String as PropType<'left' | 'right' | 'both'>,
    default: 'right',
  },
};

export interface HealthReportContext {
  jsonData: Ref<Record<string, any>>;
  locateNode: (nodeId: number, type: 'op') => void;
}
export const HealthReportProvideKey = 'health-report' as unknown as InjectionKey<HealthReportContext>;

export interface ItemData {
  label: number | string;
  expandAll?: boolean;
}
