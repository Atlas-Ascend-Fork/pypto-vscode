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
import { vscode } from './vscode';

/**
 * 增量更新state
 * @deprecated 尽量避免使用state缓存，容易导致全局冲突
 * @param newState 
 */
export function pushState(newState: object): void {
  const originalState = vscode.value.getState();
  vscode.value.setState({ ...originalState, ...newState });
}

/**
 * 获取state
 */
export function pullState(): any {
  return vscode.value.getState();
}
