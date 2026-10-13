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

/**
 * Webview 与扩展宿主通信的 API（内联自 @types/vscode-webview，避免依赖长期未更新的类型包）。
 */
export interface WebviewApi<InitialState = unknown> {
  postMessage(message: unknown): void;
  getState(): InitialState | undefined;
  setState<T extends InitialState | undefined>(newState: T): void;
}
