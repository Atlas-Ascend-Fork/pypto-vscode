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
import { IControlFlowViewServer, IControlFlowApis, IControlFlowRefs } from './view-server-interface';
import { getResDataSum, getPassInfoOfSinglePath, setCurAccuFilePath } from '../../common/accurancyAnylasis';

// type Apis = never;
// type Refs = {};

type Apis = IControlFlowApis;

type Refs = IControlFlowRefs;

@viewRefs([
    'accurancyResult', 'pathPassResult'
])
export class ControlFlowViewServer extends ViewServer<Apis, Refs> implements IControlFlowViewServer {
    
    @viewApi()
    public getAccurancyResult = async (data) => {
      const fileUri = data.controwFlowFilePath;
      const computeGraphDirPath = data.computeGraphDirPath;
      const flowVerifyPath = data.flowVerifyPath;
      const res = await getResDataSum(fileUri, flowVerifyPath, computeGraphDirPath);
      this.setRef('accurancyResult', res);
    };
    @viewApi()
    public getPathPassResult = async (data) => {
      const fileUri = data.controwFlowFilePath;
      const pathName = data.funcMagicName;
      const res = await getPassInfoOfSinglePath(fileUri, pathName);
      this.setRef('pathPassResult', res);
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
        console.error('[ControlFlowViewServer] setCurAccuFilePath error:', error);
      }
    };
}
