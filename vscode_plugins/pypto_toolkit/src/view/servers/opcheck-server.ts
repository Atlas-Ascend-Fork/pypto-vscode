/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import * as vscode from 'vscode';

import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { getCmpDiffList, getPrecisionExceptList, setCurAccuFilePath, openCmpDiffComGraph, getCmpErrorList, getAccuFilePath, getTaskCmpList } from '../../common/accurancyAnylasis';
import { IOpCheckViewServer, IOpCheckApis, IOpCheckRefs } from './view-server-interface';

type Apis = IOpCheckApis;
type Refs = IOpCheckRefs;

@viewRefs([
  'cmpDiffList',
  'precisionExceptList',
  'cmpErrorList',
  'taskCmpDiffList',
  'taskCmpErrorList'
])
export class OpCheckViewServer extends ViewServer<Apis, Refs> implements IOpCheckViewServer {
  private fileUri: vscode.Uri;

  @viewApi()
  public getCmpDiffListData = async (data: {
    cmpCsvPath: string;
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
    readFlag?: boolean;
  }) => {
    const { cmpCsvPath, pageSize = 50, startOffset = 0, res, keyword, readFlag = true } = data;
    const result = await getCmpDiffList(cmpCsvPath, readFlag, pageSize, startOffset, res, keyword);
    // const testTask = await SQLiteCache.getInstance().accuracyToolTaskCmpGetByFileName(cmpCsvPath, 50, 0);
    // const testTask = await getTaskCmpList('c:\\Users\\d30050268\\.pypto\\run\\rundata_20260630000000\\verify\\verify_task_result_cmp~Pass_38_CodegenPreproc~1782818241.csv', true, pageSize, startOffset, res, keyword);
    // const testError = await getTaskCmpList('c:\\Users\\d30050268\\.pypto\\run\\rundata_20260630000000\\verify\\verify_task_result_cmp~Pass_38_CodegenPreproc~1782818241.csv', false, pageSize, startOffset, 'FAIL', keyword);
    // const testSearch = await getTaskCmpList('c:\\Users\\d30050268\\.pypto\\run\\rundata_20260630000000\\verify\\verify_task_result_cmp~Pass_38_CodegenPreproc~1782818241.csv', false, pageSize, startOffset, 'FAIL', keyword, 'Pass_38_CodegenPreproc', '',);
    // const testFilter = await getTaskCmpList('c:\\Users\\d30050268\\.pypto\\run\\rundata_20260630000000\\verify\\verify_task_result_cmp~Pass_38_CodegenPreproc~1782818241.csv', 
    //                                         false, pageSize, startOffset, 'FAIL', keyword, 'Pass_38_CodegenPreproc', '', {rawMagic: '', opMagic: '10002', tensorAddr: ''});
    this.setRef('cmpDiffList', result);
  };

  @viewApi()
  public getPrecisionExceptList = async (data: {
    filePath: string;
    fileName: string;
  }) => {
    const { filePath, fileName } = data;
    
    try {
      const result = await getPrecisionExceptList(filePath, fileName);
      
      this.setRef('precisionExceptList', result);
    } catch (error) {
      this.setRef('precisionExceptList', null);
    }
  };

  @viewApi()
  public setCurAccuFilePathApi = async (data: {
    filePath: string;
    fileType: string;
  }) => {
    const { filePath, fileType } = data;
    
    try {
      await setCurAccuFilePath({ filePath, fileType });
    } catch (error) {
      console.error('[OpCheckViewServer] setCurAccuFilePath error:', error);
    }
  };

  @viewApi()
  public openCmpDiffComGraphApi = async (data: {
    filePath: string;
    funcHash: string;
    rootFuncHash?: string;
    passName: string;
    funcMagicName: string;
    loopInfo?: string;
    fileType?: string;
    computeGraphDirPath?: string;
    flowVerifyPath?: string;
  }) => {
    const { filePath, funcHash, rootFuncHash, passName, funcMagicName, loopInfo, fileType, computeGraphDirPath, flowVerifyPath } = data;
    
    try {
      await openCmpDiffComGraph(filePath, funcHash, passName, funcMagicName, loopInfo, fileType, filePath, computeGraphDirPath, flowVerifyPath, rootFuncHash);
    } catch (error) {
      console.error('[OpCheckViewServer] openCmpDiffComGraph error:', error);
    }
  };

  @viewApi()
  public getCmpErrorListData = async (data: {
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
    readFlag?: boolean;
    comgraphPath?: string;
  }) => {
    const cmpCsvInfo = await getAccuFilePath();
    const filePath = cmpCsvInfo?.filePath || '';
    
    const { pageSize = 50, startOffset = 0, res, keyword, readFlag = true, comgraphPath = '' } = data;
    const result = await getCmpErrorList(filePath, comgraphPath, readFlag, pageSize, startOffset, keyword);
    this.setRef('cmpErrorList', result);
  };

  @viewApi()
  public getTaskCmpDiffListData = async (data: {
    cmpCsvPath: string;
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
    filterWord?: { rawMagic?: string; opMagic?: string; tensorAddr?: string };
    rootFuncHash?: string;
  }) => {
    const { cmpCsvPath, pageSize = 50, startOffset = 0, res, keyword, filterWord, rootFuncHash } = data;
    const result = await getTaskCmpList(cmpCsvPath, true, pageSize, startOffset, res, keyword, undefined, undefined, filterWord, rootFuncHash);
    this.setRef('taskCmpDiffList', result);
  };

  @viewApi()
  public getTaskCmpErrorListData = async (data: {
    pageSize?: number;
    startOffset?: number;
    keyword?: string;
    readFlag?: boolean;
    comgraphPath?: string;
    filterWord?: { rawMagic?: string; opMagic?: string; tensorAddr?: string };
  }) => {
    const cmpCsvInfo = await getAccuFilePath();
    const filePath = cmpCsvInfo?.filePath || '';

    const { pageSize = 50, startOffset = 0, keyword, readFlag = true, filterWord } = data;
    const result = await getTaskCmpList(filePath, readFlag, pageSize, startOffset, 'FAIL', keyword, undefined, undefined, filterWord);
    this.setRef('taskCmpErrorList', result);
  };

  public override created(ctx: ViewServerContext): void {
    this.fileUri = ctx.fileUri!;
  }
}

