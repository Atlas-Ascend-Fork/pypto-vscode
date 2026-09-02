/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
