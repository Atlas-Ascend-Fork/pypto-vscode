import * as vscode from 'vscode';

import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { getCmpDiffList, getPrecisionExceptList, setCurAccuFilePath, openCmpDiffComGraph, getCmpErrorList, getAccuFilePath } from '../../common/accurancyAnylasis';
import { IOpCheckViewServer, IOpCheckApis, IOpCheckRefs } from './view-server-interface';

type Apis = IOpCheckApis;
type Refs = IOpCheckRefs;

@viewRefs([
  'cmpDiffList',
  'precisionExceptList',
  'cmpErrorList'
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

  public override created(ctx: ViewServerContext): void {
    this.fileUri = ctx.fileUri!;
  }
}

