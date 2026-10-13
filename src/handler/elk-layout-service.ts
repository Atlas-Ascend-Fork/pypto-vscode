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

import ElkConstructor from 'elkjs/lib/elk.bundled';
import { fork } from 'child_process';
import path from 'path';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { getMTime } from '../core/cache-query-helper';
import { buildLayoutCacheKey } from './graph-cache-key';
import { getComGraphLayoutStore } from '../core/sqlInit';
let _graphLayout: typeof import('@pypto/native-layout').graphLayout | undefined;
async function getGraphLayout() {
  if (!_graphLayout) {
    const mod = await import('@pypto/native-layout');
    _graphLayout = mod.graphLayout;
  }
  return _graphLayout;
}

/**
 * 回调函数类型：从 server 中获取 comGraphData。
 * 子类（SingleGraphHandler / DiffGraphHandler）可重写此逻辑。
 */
export type GetComGraphDataFn = (server: any, graphData: any, elkFactory?: any) => any;

/**
 * 回调函数类型：返回错误信息。
 * 原 baseGraphMsgHandler.returnError 方法的签名。
 */
export type ReturnErrorFn = (
  server: any,
  cmd: string,
  cmdArgs?: Record<string, any>,
  logCmd?: string,
  logCmdArgs?: Record<string, any>,
  diffType?: string,
) => void;

/**
 * 布局主入口。
 * 根据配置选择原生 OGDF 布局或 elk 布局。
 * 1. enableNativeLayout 默认开启，优先尝试 native 布局
 * 2. native 失败或用户取消勾选，回退到 elk 布局（含缓存）
 */
export async function layout(
  gd: any,
  server: any,
  getComGraphData: GetComGraphDataFn,
  globalCallInOutTensorMap: Map<any, any>,
): Promise<void> {
  const enableNativeLayout = workspace.getConfiguration('PyPTOToolkitOpen').get<boolean>('enableNativeLayout', true);

  if (enableNativeLayout) {
    const nativeStart = performance.now();
    const nodeCount = gd.children?.length || 0;

    try {
      const graphLayout = await getGraphLayout();
      const result = graphLayout(gd);
      if (result) {
        const elapsed = performance.now() - nativeStart;
        console.log(`[native-layout] ${nodeCount} nodes, ${elapsed.toFixed(1)}ms, result=native`);
        server.setRef('LayoutResult', { data: result, filePath: gd.layoutOptions?.['PyPTO.filePath'] });
        return;
      }
      console.warn('[native-layout] graphLayout returned falsy, falling back to elk');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause = (err as { cause?: unknown }).cause;
      console.error(`[native-layout] Layout failed, falling back to elk: ${msg}`, cause ?? '');
    }
  }

  return elkLayout(gd, server, getComGraphData, globalCallInOutTensorMap);
}

/**
 * ELK 布局主入口。
 * 1. 构造缓存 Key
 * 2. 查询缓存（若命中且时间戳匹配则直接返回）
 * 3. 优先使用 java-elk-extension 插件布局，否则本地子进程布局
 */
export async function elkLayout(
  gd: any,
  server: any,
  getComGraphData: GetComGraphDataFn,
  globalCallInOutTensorMap: Map<any, any>,
): Promise<void> {
  const elkFactory = new ElkConstructor({ algorithms: ['layered'] });
  const comGraphData = getComGraphData(server, gd, elkFactory);
  const layoutDirection = gd.layoutOptions['elk.direction'];
  const showtensor = gd.layoutOptions['PyPTO.showTensor'];
  const filePath = comGraphData?.fsPath;
  const renderMode = gd.layoutOptions['PyPTO.renderMode'];
  let funcHash = comGraphData?.funcHash!;

  // 使用 buildLayoutCacheKey 替代原来的 4 处重复拼接
  funcHash = buildLayoutCacheKey(funcHash, {
    hasParent: globalCallInOutTensorMap.has(funcHash),
    direction: layoutDirection,
    showTensor: showtensor === 'true',
    filePath: gd.layoutOptions['PyPTO.filePath'],
    threeMode: server.title === 'multiple graph',
  });

  let lastChangeTime: string | undefined;
  if (filePath) {
    lastChangeTime = await getMTime(filePath);
  }

  let cache: any;
  if (comGraphData?.isUsedDB) {
    cache = await getComGraphLayoutStore().find({ filePath: filePath, funcHash: funcHash });
  }

  if (renderMode === 'path' || !cache || lastChangeTime !== cache.lastChangeTime) {
    if (vscode.extensions.getExtension('hakan-6666.java-elk-extension') && server.query) {
      vscode.commands.executeCommand(
        'PyPTO.elkLayout',
        `${server.query._path}_${server.query.funcHash || ''}_${server.query.nodeMagic || ''}&&${JSON.stringify(gd.layoutOptions)}`,
        JSON.stringify(gd),
        'PyPto.Open.postLayoutData',
      );
    } else {
      layoutByLocal(server, gd, lastChangeTime!, funcHash, getComGraphData);
    }
  } else {
    postLayoutResult(server, cache.layoutResult, gd.layoutOptions['PyPTO.filePath'], getComGraphData);
  }
}

/**
 * 启动本地子进程执行 ELK 布局。
 * fork layoutWork.js，通过 IPC 通信获取布局结果。
 */
export function layoutByLocal(
  server: any,
  gd: any,
  lastChangeTime: string,
  funcHash: string,
  getComGraphData: GetComGraphDataFn,
  returnError?: ReturnErrorFn,
): void {
  const renderMode = gd.layoutOptions['PyPTO.renderMode'];
  const comGraphData = getComGraphData(server, gd);
  const filePath = comGraphData?.fsPath;
  const child = fork(path.join(__dirname, '../core/layoutWork.js'));

  child.send({ type: 'layout', graphData: gd });

  child.on('message', async (res: { type: string; message?: any; data?: any }) => {
    if (res.type === 'result') {
      const layoutJsonStr = JSON.stringify(res.data);
      if (comGraphData?.isUsedDB && renderMode !== 'path') {
        let finalFuncHash = funcHash;
        if (server.title === 'multiple graph') {
          finalFuncHash += '_threeMode';
        }
        await getComGraphLayoutStore().set({
          filePath: filePath,
          funcHash: finalFuncHash,
          lastChangeTime: lastChangeTime,
          layoutResult: layoutJsonStr,
        });
      }
      postLayoutResult(server, layoutJsonStr, gd.layoutOptions['PyPTO.filePath'], getComGraphData);
      child.kill();
    }
    if (res.type === 'error') {
      // 委托回基类的 returnError
      const onError = returnError || console.error;
      onError(
        server,
        'pypto.comGraph.errorMessage.layout',
        {},
        'pypto.comGraph.errorLogMessage.error',
        { logText: res.data },
        gd.layoutOptions['PyPTO.filePath'],
      );
      return;
    }
  });

  child.on('error', (err) => {
    console.error('子进程发生错误:', err);
    child.kill();
  });

  child.on('exit', () => {});
}

/**
 * 处理布局结果，合并 layoutOptions 并缓存。
 */
export async function renderLayout(
  layoutJsonStr: string,
  infoStr: string,
  server: any,
  getComGraphData: GetComGraphDataFn,
  globalCallInOutTensorMap: Map<any, any>,
): Promise<void> {
  const gd = JSON.parse(layoutJsonStr);
  if (gd.type === 'error') {
    const info = JSON.parse(infoStr);
    const originGd = gd.data;
    const comGraphData = getComGraphData(server, originGd);
    let funcHash = comGraphData?.funcHash!;
    const lastChangeTime = await getMTime(comGraphData?.fsPath);
    originGd.layoutOptions = { ...originGd.layoutOptions, ...info };
    layoutByLocal(server, originGd, lastChangeTime, funcHash, getComGraphData);
  }
  const info = JSON.parse(infoStr);
  gd.layoutOptions = { ...gd.layoutOptions, ...info };
  const comGraphData = getComGraphData(server, gd);
  const renderMode = gd.layoutOptions['PyPTO.renderMode'];
  const filePath = comGraphData?.fsPath;
  const layoutDirection = gd.layoutOptions['elk.direction'];
  const showtensor = gd.layoutOptions['PyPTO.showTensor'];
  let funcHash = comGraphData?.funcHash!;
  const lastChangeTime = await getMTime(filePath);

  funcHash = buildLayoutCacheKey(funcHash, {
    hasParent: globalCallInOutTensorMap.has(funcHash),
    direction: layoutDirection,
    showTensor: showtensor === 'true',
    filePath: gd.layoutOptions['PyPTO.filePath'],
    threeMode: server.title === 'multiple graph',
  });

  postLayoutResult(server, layoutJsonStr, gd.layoutOptions['PyPTO.filePath'], getComGraphData);

  if (comGraphData?.isUsedDB && renderMode !== 'path') {
    let finalFuncHash = funcHash;
    if (server.title === 'multiple graph') {
      finalFuncHash += '_threeMode';
    }
    await getComGraphLayoutStore().set({
      filePath: filePath,
      funcHash: finalFuncHash,
      lastChangeTime: lastChangeTime,
      layoutResult: layoutJsonStr,
    });
  }
}

/**
 * 将布局结果发送给前端。
 * 包含 filePath 以支持对比图场景（两个实例共享 LayoutResult ref，需要 filePath 区分）。
 */
export function postLayoutResult(
  server: any,
  jsonStr: string,
  filePath?: string,
  getComGraphData?: GetComGraphDataFn,
): void {
  server.setRef('LayoutResult', { data: JSON.parse(jsonStr), filePath });
}
