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

/**
 * Field mapping constants for INSERT parameter extraction.
 * Each array maps interface property names to SQL INSERT column order.
 */

export const ACCURACY_TOOL_FIELDS = [
  'filePath', 'no', 'phaseName', 'funcMagicName', 'rawMagic',
  'result', 'dataType', 'validShape', 'loopInfo', 'rtolAtol',
  'cntFailWarnTol', 'cntTotalZeroInfnanCnt',
  'mre', 'mreTop1permil', 'mreTop8',
  'mae', 'maeTop8', 'maeTop1permil',
  'aMax', 'aMin', 'aAvg', 'aAavg', 'aZero', 'aInfnan',
  'bMax', 'bMin', 'bAvg', 'bAavg', 'bZero', 'bInfnan',
  'bTimestamp',
] as const;

export const ACCURACY_TOOL_CMP_FIELDS = [
  'filePath', 'no', 'pathFuncMagicName', 'loopInfo',
  'symbol', 'validShape', 'dataType', 'opAttrSymOffset',
  'aOpMagic', 'bPhaseName', 'aPhaseName', 'aOpcode',
  'aRawShape', 'aShape', 'aFormat',
  'aFuncMagic', 'aFuncHash', 'aRootFuncHash', 'aFileName',
  'aMax', 'aMin', 'aAvg', 'aAavg', 'aZero', 'aInfnan',
  'bOpMagic', 'bOpcode', 'bRawShape', 'bShape', 'bFormat',
  'bFuncMagic', 'bFuncHash', 'bRootFuncHash', 'bFileName',
  'bMax', 'bMin', 'bAvg', 'bAavg', 'bZero', 'bInfnan',
  'abResult', 'abRtolAtol', 'abFailWarnTol', 'abTotalZeroInfnanCnt',
  'abMre', 'abMreTop8', 'abMreTop1permil',
  'abMae', 'abMaeTop8', 'abMaeTop1permil',
  'bTimestamp',
] as const;

export const TASK_CMP_FIELDS = [
  'sourceFileName', 'no', 'phaseName', 'ioFlag', 'loopInfo',
  'rootCallOpmagic', 'rootCallRawmagic', 'fileName',
  'aDatatype', 'aFormat', 'aMagic', 'aOpcode', 'aOpMagic', 'aRawMagic',
  'aSymbol', 'aValidshape', 'aDynvalidshape',
  'aOpAttrAtomic', 'aOpAttrSymOfst',
  'aFuncHash', 'aPathHash', 'aRootFuncHash',
  'bDataType', 'bRawShape', 'bValidShape', 'bBlockIdx', 'bOpAttrSymOfst',
  'bSeqNo', 'bTaskId', 'bTensorAddr', 'bTimestamp', 'bExecTimestamp',
  'result', 'rtolAtol',
  'cntFailWarnTol', 'cntTotalZeroInfnanCnt',
  'mae', 'maeTop8', 'maeTop1permil', 'mre', 'mreTop8', 'mreTop1permil',
  'aMax', 'aMin', 'aAvg', 'aAavg', 'aZero', 'aInfnan',
  'bMax', 'bMin', 'bAvg', 'bAavg', 'bZero', 'bInfnan',
] as const;

/**
 * Extract params array from data object using field mapping.
 * Missing/undefined fields default to empty string.
 */
export function extractParams<T extends object>(fields: readonly string[], data: T): string[] {
  return fields.map(f => ((data as Record<string, unknown>)[f] as string | undefined) ?? '');
}
