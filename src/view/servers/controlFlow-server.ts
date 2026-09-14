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
import * as os from 'os';
import { exec } from 'child_process';

import { t } from 'i18next';
import * as vscode from 'vscode';

import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { IControlFlowViewServer, IControlFlowApis, IControlFlowRefs } from './view-server-interface';
import { getResDataSum, getPassInfoOfSinglePath, setCurAccuFilePath } from '../../common/accurancyAnylasis';

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

    @viewApi()
    public executeRemoteCommand = async (): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> => {
      if (os.platform() !== 'linux') {
        vscode.window.showErrorMessage(t('pypto.remoteTool.linuxOnly'));
        return { success: false, stdout: '', stderr: t('pypto.remoteTool.linuxOnly'), exitCode: -1 };
      }

      const envCheck = await new Promise<boolean>((resolve) => {
        exec('remote_tool.sh -h', { encoding: 'utf8', timeout: 5000 }, (error) => {
          resolve(!error);
        });
      });
      if (!envCheck) {
        vscode.window.showErrorMessage(t('pypto.remoteTool.notTargetEnv'));
        return { success: false, stdout: '', stderr: t('pypto.remoteTool.notTargetEnv'), exitCode: -1 };
      }

      const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const userHome = process.env.PYPTO_HOME || process.env.HOME || process.env.USERPROFILE;

      if (!workspace || !userHome) {
        const missingVars = [!workspace && 'workspace folder', !userHome && 'PYPTO_HOME/HOME/USERPROFILE'].filter(Boolean).join(', ');
        vscode.window.showErrorMessage(t('pypto.remoteTool.envVarMissing', { vars: missingVars }));
        return { success: false, stdout: '', stderr: `Environment variables missing: ${missingVars}`, exitCode: -1 };
      }

      const pullDir = `${workspace},${userHome}/.pypto`;
      const mkdirPaths = `${workspace} ${userHome}/.pypto`;
      const execCommand = `remote_tool.sh exec --command 'mkdir -p ${mkdirPaths}' --pull-dir '${pullDir}'`;

      const result = await new Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }>(
        (resolve) => {
          exec(
            execCommand,
            {
              encoding: 'utf8',
              timeout: 300000,
              maxBuffer: 1024 * 1024 * 10,
            },
            (error, stdout, stderr) => {
              const exitCode = error ? (error as any).code ?? 1 : 0;
              resolve({
                success: !error,
                stdout: (stdout as string).trim(),
                stderr: (stderr as string).trim(),
                exitCode: typeof exitCode === 'number' ? exitCode : 1,
              });
            },
          );
        },
      );

      if (result.success) {
        vscode.window.showInformationMessage(t('pypto.remoteTool.execSuccess'));
      } else {
        vscode.window.showErrorMessage(
          t('pypto.remoteTool.execFailed', { exitCode: result.exitCode, stderr: result.stderr || 'Unknown error' }),
        );
      }

      return result;
    };
}
