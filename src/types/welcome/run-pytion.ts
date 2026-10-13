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
import { ExecException } from 'child_process';

// 定义输出结果的结构化类型
export interface PythonExecuteResult {
  success: boolean; // 是否执行成功
  stdout: string; // 标准输出
  stderr: string; // 错误输出
  error?: ExecException; // 执行异常（失败时存在）
}
