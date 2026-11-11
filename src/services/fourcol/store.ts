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
import { defineAttributes, SqlStore, Store } from '../../core/store';

// fourcol_cce_opmagic 表：cce_opmagic_map.json，(programId, leafhash, opmagic) → CCE 文件 + 行号
export interface FourcolCceOpmagicItem {
  /** 数据归属 program（= dataDir 规范化绝对路径，见 ADR 0002） */
  programId: string;
  leafhash: string;
  opmagic: string;
  cce: string;
  line: number;
}

// fourcol_cce_label 表：cce_semantic_label.json，(programId, leafhash, label) → CCE 文件 + 行号区间（可含嵌套 [start, end] 范围）
export interface FourcolCceLabelItem {
  /** 数据归属 program（= dataDir 规范化绝对路径，见 ADR 0002） */
  programId: string;
  leafhash: string;
  label: string;
  cce: string;
  line: unknown[];
}

// fourcol_py_semantic 表：program.json，(programId, leafhash, opmagic) → py 语义标签声明行（块级）
export interface FourcolPySemanticItem {
  /** 数据归属 program（= dataDir 规范化绝对路径，见 ADR 0002） */
  programId: string;
  leafhash: string;
  opmagic: string;
  /** 声明行锚：semantic_label.filename / lineno（标签声明行） */
  pyFile: string;
  pyBasename: string;
  pyLine: number;
  /** op 自带语义标签名：semantic_label.label（op 键查 label 的唯一来源，覆盖率 100%） */
  label: string;
  /** op 所属子图（program.json operations[].subgraphid，缺省 -1） */
  subgraphid: number;
}

// fourcol_py_impl 表：program.json，(programId, leafhash, opmagic) → py 实现行（行级，op.file/op.line）
export interface FourcolPyImplItem {
  /** 数据归属 program（= dataDir 规范化绝对路径，见 ADR 0002） */
  programId: string;
  leafhash: string;
  opmagic: string;
  /** 实现行锚：op.file / op.line（op 所在 py 语句行，绝对路径匹配） */
  pyFile: string;
  pyBasename: string;
  pyLine: number;
  /** op 自带语义标签名：semantic_label.label（op 无 semantic_label 时为 ''） */
  label: string;
  /** op 所属子图（program.json operations[].subgraphid，缺省 -1） */
  subgraphid: number;
}

// fourcol_cce_file 表：全部 CCE 文件清单（kernel_aicore 目录扫描 ∪ JSON 引用）
export interface FourcolCceFileItem {
  /** 数据归属 program（= dataDir 规范化绝对路径，见 ADR 0002） */
  programId: string;
  fileName: string;
}

// fourcol_meta 表：加载指纹等元信息
export interface FourcolMetaItem {
  key: string;
  value: string;
}

const FOURCOL_CCE_OPMAGIC_ATTRIBUTES = defineAttributes<FourcolCceOpmagicItem>({
  programId: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  leafhash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  opmagic: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  cce: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  line: { type: Number, isQuery: true, isPrimary: true, defaultValue: 0 },
});

const FOURCOL_CCE_LABEL_ATTRIBUTES = defineAttributes<FourcolCceLabelItem>({
  programId: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  leafhash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  label: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  cce: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  line: { type: Array },
});

const FOURCOL_PY_SEMANTIC_ATTRIBUTES = defineAttributes<FourcolPySemanticItem>({
  programId: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  leafhash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  opmagic: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  pyFile: { type: String },
  pyBasename: { type: String, isQuery: true },
  pyLine: { type: Number, isQuery: true },
  label: { type: String, defaultValue: '' },
  subgraphid: { type: Number, defaultValue: -1 },
});

const FOURCOL_PY_IMPL_ATTRIBUTES = defineAttributes<FourcolPyImplItem>({
  programId: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  leafhash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  opmagic: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  pyFile: { type: String, isQuery: true },
  pyBasename: { type: String },
  pyLine: { type: Number, isQuery: true },
  label: { type: String, defaultValue: '' },
  subgraphid: { type: Number, defaultValue: -1 },
});

const FOURCOL_CCE_FILE_ATTRIBUTES = defineAttributes<FourcolCceFileItem>({
  programId: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  fileName: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
});

const FOURCOL_META_ATTRIBUTES = defineAttributes<FourcolMetaItem>({
  key: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  value: { type: String, isQuery: true },
});

let cceOpmagicStore: Store<FourcolCceOpmagicItem, 'programId' | 'leafhash' | 'opmagic' | 'cce' | 'line'>;
let cceLabelStore: Store<FourcolCceLabelItem, 'programId' | 'leafhash' | 'label' | 'cce'>;
let pySemanticStore: Store<FourcolPySemanticItem, 'programId' | 'leafhash' | 'opmagic' | 'pyBasename' | 'pyLine'>;
let pyImplStore: Store<FourcolPyImplItem, 'programId' | 'leafhash' | 'opmagic' | 'pyFile' | 'pyLine'>;

export function getFourcolCceOpmagicStore(): Store<FourcolCceOpmagicItem, 'programId' | 'leafhash' | 'opmagic' | 'cce' | 'line'> {
  if (!cceOpmagicStore) {
    cceOpmagicStore = new SqlStore('fourcol_cce_opmagic', FOURCOL_CCE_OPMAGIC_ATTRIBUTES, { memoryOnly: true });
  }
  return cceOpmagicStore;
}

export function getFourcolCceLabelStore(): Store<FourcolCceLabelItem, 'programId' | 'leafhash' | 'label' | 'cce'> {
  if (!cceLabelStore) {
    cceLabelStore = new SqlStore('fourcol_cce_label', FOURCOL_CCE_LABEL_ATTRIBUTES, { memoryOnly: true });
  }
  return cceLabelStore;
}

export function getFourcolPySemanticStore(): Store<FourcolPySemanticItem, 'programId' | 'leafhash' | 'opmagic' | 'pyBasename' | 'pyLine'> {
  if (!pySemanticStore) {
    pySemanticStore = new SqlStore('fourcol_py_semantic', FOURCOL_PY_SEMANTIC_ATTRIBUTES, { memoryOnly: true });
  }
  return pySemanticStore;
}

export function getFourcolPyImplStore(): Store<FourcolPyImplItem, 'programId' | 'leafhash' | 'opmagic' | 'pyFile' | 'pyLine'> {
  if (!pyImplStore) {
    pyImplStore = new SqlStore('fourcol_py_impl', FOURCOL_PY_IMPL_ATTRIBUTES, { memoryOnly: true });
  }
  return pyImplStore;
}

let cceFileStore: Store<FourcolCceFileItem, 'programId' | 'fileName'>;
let metaStore: Store<FourcolMetaItem, 'key'>;

export function getFourcolCceFileStore(): Store<FourcolCceFileItem, 'programId' | 'fileName'> {
  if (!cceFileStore) {
    cceFileStore = new SqlStore('fourcol_cce_file', FOURCOL_CCE_FILE_ATTRIBUTES, { memoryOnly: true });
  }
  return cceFileStore;
}

export function getFourcolMetaStore(): Store<FourcolMetaItem, 'key'> {
  if (!metaStore) {
    metaStore = new SqlStore('fourcol_meta', FOURCOL_META_ATTRIBUTES);
  }
  return metaStore;
}
