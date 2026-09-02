/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

// ============================================================
// ComGraph 领域接口
// ============================================================

export interface ComGraphLayoutRow {
  file_path: string;
  func_hash: string;
  layout_result: string;
  last_change_time: string;
}

export interface ComGraphFinalResultRow {
  file_path: string;
  func_hash: string;
  final_result: string;
  last_change_time: string;
}

export interface ComGraphFuncDataRow {
  file_path: string;
  func_hash: string;
  call_hash_arr: string;
  data: string;
  big_data_file_path: string;
  last_change_time: string;
}

// ============================================================
// Accuracy 领域接口
// ============================================================

export interface AccuracyToolCompList {
  file_path: string;
  first_req: string;
  compute_path: string;
}

export interface AccuracyToolData {
  filePath: string;
  no?: string;
  phaseName: string;
  funcMagicName: string;
  rawMagic: string;
  result?: string;
  dataType?: string;
  validShape?: string;
  loopInfo?: string;
  rtolAtol?: string;
  cntFailWarnTol?: string;
  cntTotalZeroInfnanCnt?: string;
  mre?: string;
  mreTop1permil?: string;
  mreTop8?: string;
  mae?: string;
  maeTop8?: string;
  maeTop1permil?: string;
  aMax?: string;
  aMin?: string;
  aAvg?: string;
  aAavg?: string;
  aZero?: string;
  aInfnan?: string;
  bMax?: string;
  bMin?: string;
  bAvg?: string;
  bAavg?: string;
  bZero?: string;
  bInfnan?: string;
  bTimestamp?: string;
}

export interface AccuracyToolCmpData {
  filePath?: string;
  no?: string;
  pathFuncMagicName?: string;
  loopInfo?: string;
  symbol?: string;
  validShape?: string;
  dataType?: string;
  opAttrSymOffset?: string;
  aOpMagic?: string;
  aPhaseName?: string;
  aOpcode?: string;
  aRawShape?: string;
  aShape?: string;
  aFormat?: string;
  aFuncHash?: string;
  aRootFuncHash?: string;
  aFuncMagic?: string;
  aFileName?: string;
  aMax?: string;
  aMin?: string;
  aAvg?: string;
  aAavg?: string;
  aZero?: string;
  aInfnan?: string;
  bPhaseName?: string;
  bOpMagic?: string;
  bOpcode?: string;
  bRawShape?: string;
  bShape?: string;
  bFormat?: string;
  bFuncMagic?: string;
  bFuncHash?: string;
  bRootFuncHash?: string;
  bFileName?: string;
  bTimestamp?: string;
  bMax?: string;
  bMin?: string;
  bAvg?: string;
  bAavg?: string;
  bZero?: string;
  bInfnan?: string;
  abResult?: string;
  abRtolAtol?: string;
  abFailWarnTol?: string;
  abTotalZeroInfnanCnt?: string;
  abMre?: string;
  abMreTop8?: string;
  abMreTop1permil?: string;
  abMae?: string;
  abMaeTop8?: string;
  abMaeTop1permil?: string;
}

export interface AccuracyToolCmpDetailData {
  filePath?: string;
  group: string;
  index: string;
  offset: string;
  offsetRaw: string;
  aData: string;
  bData: string;
  abAe: string;
  abRe: string;
  abTol: string;
}

export interface accuFilePathData {
  fileType: string;
  filePath?: string;
}

// ============================================================
// 通用接口
// ============================================================

export interface PaginatedResult<T> {
  total: number;
  list: T[];
}
