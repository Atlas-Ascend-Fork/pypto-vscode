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
import { OutputDirectory } from './directory-tree';
import type { AccuracyToolCompList } from '../../core/sqliteCache';

/**
 * 运行数据声明文件
 */
export interface RunDataManifest {
  /** 运行类型（例：simulation、onChip） */
  runtype?: string;

  /** 源码路径 */
  pto_src_file?: string;

  /** 控制流路径 */
  program_file?: string;

  /** 计算图目录 */
  compute_graph_path?: string;

  /** 泳道图目录 */
  swim_graph_path?: string;

  /** 精度工具目录 */
  flow_verify_path?: string;

  /** 精度工具目录 */
  verify_path?: string;
}

export type OutputRecord = Omit<OutputDetail, 'directoryTree'>;

export interface OutputDetail {
  /** 标题 */
  title: string;

  /** 执行时间 */
  executeTime: string;

  /** rundata文件夹地址 */
  directoryPath: string;

  /** 文件目录树 */
  directoryTree: OutputDirectory | null;

  /** 源代码文件地址 */
  sourceFilePath: string | null;

  /** 控制流文件地址 */
  controlFlowFilePath: string | null;

  /** 泳道图文件地址 */
  swimlaneGraphFilePath: string | null;

  /** 计算图目录地址 */
  computeGraphDirPath: string | null;

  /** 是否存在ope校验 */
  hasOpeCheck: boolean;

  /** ope校验目录路径 */
  opeCheckDirPath: AccuracyToolCompList[] | null;

  /** 精度工具文件地址 */
  flowVerifyPath: string | null;

   /** 是否存在task校验 */
   hasTaskCheck: boolean;

   /** ope校验目录路径 */
   taskCheckDirPath: AccuracyToolCompList[] | null;
}
