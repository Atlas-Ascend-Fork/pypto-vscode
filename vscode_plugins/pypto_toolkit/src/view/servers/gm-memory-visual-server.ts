/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { IGmMemoryVisualApis, IGmMemoryVisualRefs, IGmMemoryVisualServer } from './view-server-interface';
import * as vscode from 'vscode';
import { performance } from 'node:perf_hooks';

export interface GmMemoryVisualTimings {
  decode: number;
  fileRead: number;
  publicationToReady: number;
  total: number;
}

export interface GmMemoryVisualReadyEvent {
  fsPath: string;
  tensorCount: number;
  regionCount: number;
  hasChart: boolean;
  timings: GmMemoryVisualTimings;
  webviewPerformance?: {
    fingerprint: Record<string, unknown>;
    marks: Record<string, number>;
    stages: Record<string, number>;
  };
}

const gmMemoryVisualReadyEmitter = new vscode.EventEmitter<GmMemoryVisualReadyEvent>();
export const onDidGmMemoryVisualReady = gmMemoryVisualReadyEmitter.event;

@viewRefs([
  'GmMemoryVisualData',
])
export class GmMemoryVisualServer extends ViewServer<IGmMemoryVisualApis, IGmMemoryVisualRefs> implements IGmMemoryVisualServer {
  query?: any;
  private loadStartedAt = performance.now();
  private publicationStartedAt = 0;
  private loadTimings = { decode: 0, fileRead: 0 };

  constructor(ctx: ViewServerContext) {
    super(ctx);
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : (ctx.fileUri?.query ?? {});
  }
  setSaveDir: () => Promise<void>;
  checkSys: () => Promise<void>;
  saveFile: (message: { dataUrl: any; fileName?: any; filePath?: any }) => Promise<void>;
  checkFilePath: (message: { filePath: any }) => Promise<void>;
  public override created(ctx: ViewServerContext): void {
    this.getGmMemoryVisualData();
  }

  @viewApi()
  public getGmMemoryVisualData = async () => {
    this.loadStartedAt = performance.now();
    let fsPath = this.query?._path ?? '';
    const memoryData = await readJsonText(fsPath, this.loadTimings);
    this.publicationStartedAt = performance.now();
    this.setRef('GmMemoryVisualData', process.env.GM_MEMORY_BENCHMARK_PATH ? { data: memoryData, performance: true } : memoryData);
    this.setRef('GmMemoryVisualData', null);
  };

  @viewApi()
  public reportGmMemoryVisualReady = async (message: {
    tensorCount: number;
    regionCount: number;
    hasChart: boolean;
    performance?: GmMemoryVisualReadyEvent['webviewPerformance'];
  }) => {
    const readyAt = performance.now();
    gmMemoryVisualReadyEmitter.fire({
      fsPath: this.query?._path ?? '',
      tensorCount: message.tensorCount,
      regionCount: message.regionCount,
      hasChart: message.hasChart,
      timings: {
        ...this.loadTimings,
        publicationToReady: readyAt - this.publicationStartedAt,
        total: readyAt - this.loadStartedAt,
      },
      webviewPerformance: message.performance,
    });
  };

  safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}


export async function readJsonText(fsPath: string, timings = { decode: 0, fileRead: 0 }): Promise<string | undefined> {
  if (!fsPath) {
      console.error('文件路径为空');
      return;
    }
    try {
      const fileUri = vscode.Uri.file(fsPath);
      let startedAt = performance.now();
      const fileData = await vscode.workspace.fs.readFile(fileUri);
      timings.fileRead = performance.now() - startedAt;
      startedAt = performance.now();
      const fileContent = Buffer.from(fileData).toString('utf8');
      timings.decode = performance.now() - startedAt;
      return fileContent;
    } catch (error: any) {
      console.error('读取或解析 JSON 文件失败:', error);
      vscode.window.showErrorMessage(`读取文件失败: ${error.message}`);
    }
}
