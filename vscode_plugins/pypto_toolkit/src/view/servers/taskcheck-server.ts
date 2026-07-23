import * as vscode from 'vscode';

import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { getTaskCmpList, getPrecisionExceptList, openTaskCmpDiffComGraph } from '../../common/accurancyAnylasis';
import { ITaskCheckViewServer, ITaskCheckApis, ITaskCheckRefs } from './view-server-interface';
import { TaskCmpFilterWord } from '../../core/sqliteCache';

type Apis = ITaskCheckApis;
type Refs = ITaskCheckRefs;

@viewRefs([
  'taskCmpDiffList',
  'precisionExceptList'
])
export class TaskCheckViewServer extends ViewServer<Apis, Refs> implements ITaskCheckViewServer {
  private fileUri: vscode.Uri;

  @viewApi()
  public getTaskCheckList = async (data: {
    outputPath: string;
  }) => {
    const { outputPath } = data;

    // TODO: 后期对接真实后端接口
    // 当前使用模拟数据
    const mockData = {
      list: [
        {
          id: '1',
          taskName: 'Task-001',
          status: 'pass',
          time: '2026/06/30'
        },
        {
          id: '2',
          taskName: 'Task-002',
          status: 'fail',
          failCount: 3,
          time: '2026/06/30'
        },
        {
          id: '3',
          taskName: 'Task-003',
          status: 'pending',
          time: '2026/06/30'
        }
      ],
      total: 3
    };

    this.setRef('taskCheckList', mockData);
  };

  @viewApi()
  public getTaskDetail = async (data: {
    taskId: string;
  }) => {
    const { taskId } = data;

    // TODO: 后期对接真实后端接口
    // 当前使用模拟数据
    const mockDetail = {
      taskId,
      taskName: `Task-${taskId}`,
      accuracy: 0.98,
      errors: [],
      details: []
    };

    this.setRef('taskDetail', mockDetail);
  };

  @viewApi()
  public getTaskCmpDiffListData = async (data: {
    cmpCsvPath: string;
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
    phaseName?: string;
    funcHash?: string;
    readFlag?: boolean;
    opMagic?: string;
    rawMagic?: string;
    tensorAddr?: string;
    symbol?: string;
    funchash?: string;
  }) => {
    const { cmpCsvPath, pageSize = 50, startOffset = 0, res, keyword, phaseName, funcHash, readFlag = true, opMagic, rawMagic, tensorAddr, symbol, funchash } = data;

    const filterWord: TaskCmpFilterWord | undefined = 
      (opMagic || rawMagic || tensorAddr || symbol || funchash) ? { opMagic, rawMagic, tensorAddr, symbol, funchash } : undefined;

    const result = await getTaskCmpList(
      cmpCsvPath,
      readFlag,
      pageSize,
      startOffset,
      res,
      keyword,
      phaseName,
      funcHash,
      filterWord
    );

    this.setRef('taskCmpDiffList', result);
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
  public openTaskCmpDiffComGraphApi = async (data: {
    filePath: string;
    funcHash: string;
    passName: string;
    loopInfo?: string;
    fileType?: string;
    cmpCsvPath?: string;
    computeGraphDirPath?: string;
    flowVerifyPath?: string;
    rootFuncHash?: string;
    pathFuncHash?: string;
  }) => {
    const { filePath, funcHash, passName, loopInfo, fileType, cmpCsvPath, computeGraphDirPath, flowVerifyPath, rootFuncHash, pathFuncHash } = data;
    
    try {
      await openTaskCmpDiffComGraph(filePath, funcHash, passName, loopInfo, fileType, cmpCsvPath, computeGraphDirPath, flowVerifyPath, rootFuncHash, pathFuncHash);
    } catch (error) {
      console.error('[TaskCheckViewServer] openTaskCmpDiffComGraph error:', error);
    }
  };

  @viewApi()
  public openSwimGraphApi = async (data: {
    swimPath: string;
    seqNo: number;
    taskId: number;
  }) => {
    const { swimPath, seqNo, taskId } = data;
    
    try {
      await vscode.commands.executeCommand('PyPTO.Open.OpenSwimGraph', swimPath, seqNo, taskId);
    } catch (error) {
      console.error('[TaskCheckViewServer] openSwimGraph error:', error);
    }
  };

  public override created(ctx: ViewServerContext): void {
    this.fileUri = ctx.fileUri!;
  }
}