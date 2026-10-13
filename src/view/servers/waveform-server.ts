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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as vscode from 'vscode';
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { IWaveformApis, IWaveformRefs, IWaveformServer } from './view-server-interface';
import { parseVcdStream, VcdParsedData } from '../../converter/vcdConverter';

@viewRefs(['WaveformData', 'ErrorMessage'])
export class WaveformServer extends ViewServer<IWaveformApis, IWaveformRefs> implements IWaveformServer {
  query?: any;
  private cachedData: VcdParsedData | null = null;

  constructor(ctx: ViewServerContext) {
    super(ctx);
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : (ctx.fileUri?.query ?? {});
  }

  public override created(ctx: ViewServerContext): void {
    this.loadWaveformData();
  }

  protected override onDisposed(): void {
    this.cachedData = null;
  }

  @viewApi()
  public loadWaveformData = async () => {
    const fsPath = this.query?._path ?? '';
    if (!fsPath) {
      this.setRef('ErrorMessage', { data: '文件路径为空' });
      return;
    }
    try {
      this.cachedData = await parseVcdStream(fsPath);
      const changesObj: Record<string, [number, string][]> = {};
      this.cachedData.changes.forEach((value, key) => {
        changesObj[key] = value;
      });
      this.setRef('WaveformData', {
        timescale: this.cachedData.timescale,
        date: this.cachedData.date,
        version: this.cachedData.version,
        signals: this.cachedData.signals,
        signalTree: this.cachedData.signalTree,
        timeRange: this.cachedData.timeRange,
        signalCount: this.cachedData.signalCount,
        changeCount: this.cachedData.changeCount,
        changes: changesObj,
      });
    } catch (error: any) {
      this.setRef('ErrorMessage', { data: `解析 VCD 文件失败: ${error.message}` });
    }
  };

  @viewApi()
  public getSignalChanges = async (message: { signalIds: string[]; startTime: number; endTime: number }) => {
    if (!this.cachedData) return {};
    const result: Record<string, [number, string][]> = {};
    for (const id of message.signalIds) {
      const arr = this.cachedData.changes.get(id);
      if (arr) result[id] = arr;
    }
    return result;
  };

  safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
