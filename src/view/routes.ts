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
import path from 'node:path';

import * as vscode from 'vscode';
import { t } from 'i18next';

import { hismartliteEx } from '../hismarliteEx';
import { EditorViewRaw } from '../core/editorView';
import { ComputeGraphServer } from './servers/com-graph-server';
import { ThreeColumnServer } from './servers/three-column-server';
import { SwimGraphServer } from './servers/swim-graph-server';
import { RunConfigViewServer } from './servers/run-config-view-server';
import { WelcomeViewServer } from './servers/welcom-server';
import { ControlFlowViewServer } from './servers/controlFlow-server';
import { MemoryTraceServer } from './servers/memory-trace-server';
import { GmMemoryVisualServer } from './servers/gm-memory-visual-server';
import { OpCheckViewServer } from './servers/opcheck-server';
import { TaskCheckViewServer } from './servers/taskcheck-server';
import { WaveformServer } from './servers/waveform-server';
export type EditorViewRoutes = Record<string, Omit<EditorViewRaw, 'viewType'>>;
export const routes: EditorViewRoutes = {
  // 控制流
  controlFlow: {
    title: () => t('PyPTOToolkit.workspace.controlFlowName'),
    viewServer: ControlFlowViewServer,
  },
  // 计算图
  computeGraph: {
    title: 'Compute Graph',
    viewServer: ComputeGraphServer,
  },
  // 对比图
  diffGraph: {
    title: 'Diff Compute Graph',
    viewServer: ComputeGraphServer,
  },
  // 三栏视图
  threeColumnGraph: {
    title: 'Three Column Graph',
    viewServer: ThreeColumnServer,
  },
  swimGraph: {
    title: 'Swim Graph',
    viewServer: SwimGraphServer,
  },
  // gm内存可视化
  gmMemoryVisual: {
    title: 'GmMemoryVisual',
    viewServer: GmMemoryVisualServer,
  },
  // 编辑运行配置
  editRunConfig: {
    title: () => t('PyPTOToolkit.workspace.ptoNewConfig'),
    viewServer: RunConfigViewServer,
    iconPath: () => vscode.Uri.file(path.join(hismartliteEx.extensionPath, 'webview-dist', 'static-assets', 'xml.svg')),
  },

  // 欢迎页面
  welcome: {
    title: ()=>t('PyPTOToolkit.welcome.page'),
    viewServer: WelcomeViewServer,
  },

  // 内存追踪
  memoryTrace: {
    title: 'Memory Trace',
    viewServer: MemoryTraceServer,
  },

  // OpCheck
  opCheck: {
    title: 'OpCheck',
    viewServer: OpCheckViewServer,
  },

  // TaskCheck
  taskCheck: {
    title: 'TaskCheck',
    viewServer: TaskCheckViewServer,
  },

  // 波形图
  waveform: {
    title: 'Waveform',
    viewServer: WaveformServer,
  },
};
