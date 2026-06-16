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
      const res = await getResDataSum(fileUri);
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
