/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
// 定义自定义PATH节点数据类型
export interface PassesType {
  firstError?: boolean; // 是否首错，显示首错标签用
  firstException?: boolean; // 是否首个异常，显示首异常标签用
  status?: string[]; // 状态数组，可能为 ['PASS'], ['FAIL'], ['EXCEPTION'], ['FAIL', 'EXCEPTION']
  passName: string;
  passIndex: string; // 序号由数据源提供
  hasHealthReport: boolean;
  graphFilePath: string;
  leafFunctions?: LeafFunctionType[];
  passStage: string;
}

interface Meta {
  leafFunctions?: LeafFunctionType[];
  calledRecords?: CalledRecordsType[];
  calleeRecords?: CalleeRecordsType[];
  passes?: PassesType[];
}

export interface LeafFunctionType {
  magic: number;
  magicName: string;
  hash: string;
  programId?: string;
}

export interface CalledRecordsType {
  callerHash: string;
  callerFunction: LeafFunctionType;
  calleeHash: string;
  calleeFunction: LeafFunctionType;
}

export interface CalleeRecordsType extends CalledRecordsType {}

/**
 * 控制流节点类型
 */
export interface GroupNode {
  nodeType: string;
  magic: number;
  magicName: string;
  hash: string;
  sourceCode?: {
    filePath: string;
    startLine: number;
    endLine: number;
  };
  children?: GroupNode[];
  meta?: Meta;
  x?: number;
  y?: number;
}

export interface ControlFlowNodesType {
  id: string;
  combo: string | null;
  parentId?: string;
  type: string;
  data: {
    source: GroupNode;
    name: string;
    leafFunctions?: {
      leafFunction: number;
      called: number;
      callee: number;
    };
    functionStats?: {
      leafFunction?: number;
      called?: number;
      callee?: number;
    };
    errorStats?: {
      NullPointer: number;
      Exception: number;
    };
    type?: string;
    deepRankSep?: number;
  };
  style: {
    x: number;
    y: number;
  };
}

export interface EdgesType {
  source: string;
  target: string;
  type?: string;
  style?: {
    lineWidth: number;
    opacity: number;
    radius?: number;
    stroke?: string;
    controlPoints?: [[number, number]];
    endArrow?: boolean;
    router: {
      type: string;
    };
  };
}

export interface CombsType {
  id: string;
  combo?: string;
  data: {
    nodeType: string;
    magic: number;
    magicName: string;
    hash: string;
    level: string;
    scale: number;
    sourceCode: {
      filePath: string;
      startLine: number;
      endLine: number;
      line?: number;
      language?: string;
    };
  };
  comboWidth: number; //记录loop宽度
  states: string[];
}

/**
 * 右侧panel类型
 */
// 详情项类型：表格展开行的字段-值映射
export interface DetailItem {
  label: string; // 字段名称
  value: string | number; // 字段值
  ext1?: string; // 可选补充信息
}

// 表格title类型
export interface TableTitleType {
  name: string;
  value: string;
  detailTitle: string;
}

// 表格列类型：定义表格列的配置
export interface TableColumn {
  field: string; // 字段名（对应数据key）
  label: string; // 列标题
  sortable?: boolean; // 是否支持排序
  sortDirection?: 'ASC' | 'DESC' | null; // 初始排序方向
  width?: number; // 列宽度
}

// 排序信息类型：存储当前排序状态
export interface SortInfo {
  field: string; // 排序字段
  direction: 'ASC' | 'DESC' | null; // 排序方向
}

// 表格行数据类型：表格每一行的具体数据
export interface TableRowData {
  id: string; // 唯一标识（字符串类型，符合DevUI表格规范）
  name?: string; // 名称（可选）
  frequency?: number;
  detail?: DetailItem[]; // 展开详情数据（可选）
  [key: string]: any; // 动态字段（适配不同表格需求）
}

// 页签数据类型：每个页签包含的列配置和表格数据
export interface TabData {
  name: string; // 页签名称
  columns: TableColumn[]; // 列配置
  data: TableRowData[]; // 表格数据
}

// 按钮数据类型：触发按钮对应的抽屉配置
export interface PanelData {
  title: string; // 抽屉标题
  tabs: TabData[]; // 抽屉内页签数据
}

// 排序配置类型：兼容旧状态，可后续统一为SortInfo
export interface SortOption {
  sortField: string;
  sortDirection: 'asc' | 'desc' | null;
}

export interface GroupItem {
  name: string;
  icon?: string; // 图标使用DevUI的类名
  members: MemberItem[];
}

export interface MemberItem extends PassesType {
  type: 'warning' | 'err' | 'success' | string;
  icon?: string; // 图标使用DevUI的类名
}

/**
 * 自定义节点类型
 */

// 定义自定义PATH节点数据类型
export interface PathCardData {
  level?: string;
  scale?: number;
  name?: string;
  functionStats?: {
    leafFunction?: number;
    called?: number;
    callee?: number;
  };
  errorStats?: Record<string, number>;
  source: GroupNode;
}

// 定义自定义IF节点数据类型
export interface IfCardData {
  name?: string;
}

// 控制流搜索模糊匹配列表item类型
export interface SearchSelectItem {
  data: CombsType;
  label: string;
  value: string;
}

// 定义预览状态接口
export interface PreviewState {
  isVisible: boolean;
  x: number;
  y: number;
  fileDir: string;
  codeStartLine: number;
  codeEndLine: number;
  language: string;
  line: number;
}

// 定义预览组件接受内容接口
export interface CodePreviewProps {
  config: PreviewState;
  theme: 'vs' | 'vs-dark';
}
