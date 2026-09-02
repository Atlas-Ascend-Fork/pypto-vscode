/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

export enum RequestSourceType {
  NodeOverLimit = 1,
  SearchNoMagic = 2,
  SearchMagic = 3,
}

export type OpError = {
  FuncMagic: number | null;
  OpMagic: number | null;
  error: string;
};

export interface readFileResult {
  isBigData: boolean;
}

export const NODE_COUNT_LIMIT = 10000;

export const WHITE_COMMANDS = new Set([
  'askLayout',
  'searchAllFunc',
  'jumpToCodeLine',
  'getHealthyReport',
  'getAccurancyReport',
  'searchAccurancySumList',
  'getAccurancyDetail',
  'getInitialData',
  'callInOutTensorMap',
  'getSubgraph',
  'innerGetSubgraph',
  'getSprottyGraphWithLevel',
  'accuFilePathGet',
  'getCmpDiffListData',
]);
