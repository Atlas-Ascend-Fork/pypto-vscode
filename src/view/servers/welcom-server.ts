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

import { viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { extensionContext } from '../../extension';
type Apis = never;
type Refs = { skipAllStep2: boolean, skipAllStep3:boolean};

// 定义持久化存储的 key，便于统一管理
const SKIP_ALL_STORAGE_KEY = 'welcomeView.skipAllStep2';
const SKIP_Step3_STORAGE_KEY = 'welcomeView.skipAllStep3';

@viewRefs(['skipAllStep2','skipAllStep3'])
export class WelcomeViewServer extends ViewServer<Apis, Refs> {
  static completeResultsStep: () => void;
  static reductionResultsStep: () => void;
  static completeTreeColumnStep: () => void;
  static reductionTreeColumnStep: () => void;
  private fileUri: vscode.Uri;
  public override created(ctx: ViewServerContext): void {
    //  初始化从持久化存储读取，无值则设为 false
    const initialSkipAll = extensionContext?.globalState.get<boolean>(SKIP_ALL_STORAGE_KEY, false);
    this.setRef('skipAllStep2', initialSkipAll);
    const initialskipAllStep3 = extensionContext?.globalState.get<boolean>(SKIP_Step3_STORAGE_KEY, false);
    this.setRef('skipAllStep3', initialskipAllStep3);

    WelcomeViewServer.completeResultsStep = () => {
      // 更新内存中的 ref 值
      this.setRef('skipAllStep2', true);
      // 持久化到 globalState
      extensionContext?.globalState.update(SKIP_ALL_STORAGE_KEY, true);
    };    
    WelcomeViewServer.reductionResultsStep = () => {      
      this.setRef('skipAllStep2', false);
      extensionContext?.globalState.update(SKIP_ALL_STORAGE_KEY, false);
    }
    WelcomeViewServer.completeTreeColumnStep = () => {
      this.setRef('skipAllStep3', true);
      extensionContext?.globalState.update(SKIP_Step3_STORAGE_KEY, true);
    };    
    WelcomeViewServer.reductionTreeColumnStep = () => {      
      this.setRef('skipAllStep3', false);
      extensionContext?.globalState.update(SKIP_Step3_STORAGE_KEY, false);
    }

  }
}
