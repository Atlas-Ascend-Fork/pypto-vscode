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
export interface DevUITreeNode {
  id: string;
  label: string;
  type: 'dir' | 'file';
  date?: string;
  expanded: boolean;
  isLeaf: boolean; // 新增：标识是否为叶子节点（文件为true，文件夹为false）
  children?: DevUITreeNode[];

  selected?: boolean;
  checked?: boolean;
  showSingleDelete?: boolean; // 显示单个删除按钮

  disableSelect?: boolean;
  disableCheck?: boolean;
  disableToggle?: boolean;

  // 从接口继承的属性
  absolutePath?: string;
  outputPath?: string;
  pathName?: string;
  directoryPath?: string;

  [key: string]: unknown;
}
