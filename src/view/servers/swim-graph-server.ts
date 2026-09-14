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
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { SwimGraphMsgHandler } from '../../handler/swimGraphMsgHandler';
import { ISwimViewServer, ICommonViewServer, ISwimApis, ISwimRefs, ICommonApis, ICommonRefs } from './view-server-interface';
import fs from 'node:fs';
import stream from 'node:stream';
import { setSaveDir, getCurrentPlatform, saveFile, checkFilePath } from '../../common/downloadFileCheck';
import { hismartliteEx } from '../../hismarliteEx';


type Apis = ISwimApis | ICommonApis;

type Refs = ISwimRefs & ICommonRefs;

@viewRefs(['returnSwim', 'noSwimFile', 'performanceWarn', 'returnSwimData', 'bindResult', 'unbindResult', 'dataError', 'SaveFileResult', 'CheckSysResult', 'SaveDirPath', 'CheckFilePathResult', 'locateNodeResult'])
export class SwimGraphServer extends ViewServer<Apis, Refs> implements ICommonViewServer, ISwimViewServer {
  swimDataPath: string;
  title: string;
  isReveal: boolean;
  _disposables: any[];

  entryHash: string;
  viewType?: string;

  handler: typeof SwimGraphMsgHandler;
  query?: any;

  constructor(ctx: ViewServerContext) {
    super(ctx);
    this.title = 'Swim Lane Graph';
    this.isReveal = false;
    this._disposables = [];
    this.viewType = ctx.viewType;
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : ctx.fileUri?.query ?? {};
    this.swimDataPath = this.query._path;
    this.handler = SwimGraphMsgHandler;
  }
  public override created(ctx: ViewServerContext): void { }

  @viewApi()
  public getInitialData = async () => {
    await this.handler.getInitialData(this);
  };
  @viewApi()
  public getData = async () => {
    hismartliteEx.startTime = new Date().getTime();
    const data = await this.handler.getData(this);
    if (Array.isArray(data)) {
      hismartliteEx.transformStartTime = new Date().getTime();
      return stream.Readable.toWeb(stream.Readable.from(data!));
    }
    hismartliteEx.transformStartTime = new Date().getTime();
    return data;
  };
  @viewApi()
  public getSwimData = async () => {
    const packages = await this.handler.getSwimData(this);
    return stream.Readable.toWeb(stream.Readable.from(packages!));
  };
  @viewApi()
  public getOtherData = async () => {
    return await this.handler.getOtherData(this);
  };
  @viewApi()
  public getPerformanceInfo = async () => {
    return await this.handler.getPerformanceInfo(this);
  };
  @viewApi()
  public getCompressedData = async () => {
    return await this.handler.getCompressedData(this);
  };
  @viewApi()
  public bindComGraphJson = async () => {
    await this.handler.bindComGraphJson(this);
  };
  @viewApi()
  public unbindComGraph = async () => {
    await this.handler.unbindComGraph(this);
  };
  @viewApi()
  public jumpToComGraph = async (message: any) => {
    await this.handler.jumpToComGraph(this, message.paramObj);
  };
  @viewApi()
  public openBoundComGraph = async () => {
    await this.handler.openBoundComGraph(this);
  };
  @viewApi()
  public jumpRawMagic = async (message: any) => {
    await this.handler.jumpRawMagic(this, message.paramObj);
  };
  @viewApi()
  public showMessage = async (message: any) => {
    await this.handler.showMessage(this, message.paramObj);
  };
  @viewApi()
  public saveRendingMode = async (message: any) => {
    await this.handler.saveRendingMode(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgConnection = async (message: any) => {
    await this.handler.changeUserCfgConnection(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgPerformance = async (message: any) => {
    await this.handler.changeUserCfgPerformance(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgIsMixMode = async (message: any) => {
    await this.handler.changeUserCfgIsMixMode(this, message.paramObj);
  };
  @viewApi()
  public getShortCutKeyCfg = async () => {
    return await this.handler.getShortCutKeyCfg(this);
  };
  @viewApi()
  public setSaveDir = async () => {
    const dir = await setSaveDir()
    this.setRef('SaveDirPath', { dir: dir });
  };
  @viewApi()
  public checkSys = async () => {
    this.setRef('CheckSysResult', { sustem: getCurrentPlatform() });
  };
  @viewApi()
  public saveFile = async (message) => {
    const result = await saveFile(message);
    if (!result) return;
    this.setRef('SaveFileResult', result);
  };
  @viewApi()
  public checkFilePath = async (message) => {
    const result = await checkFilePath(message);
    this.setRef('CheckFilePathResult', result);
  };
  public locateNode(seqNo: number, taskId: number) {
    this.setRef('locateNodeResult', { seqNo, taskId, timestamp: Date.now() });
  }

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
