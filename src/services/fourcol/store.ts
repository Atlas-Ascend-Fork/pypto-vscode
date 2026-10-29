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

// fourcol_cce_opmagic 表：cce_opmagic_map.json，(leafhash, opmagic) → CCE 文件 + 行号
export interface FourcolCceOpmagicItem {
  leafhash: string;
  opmagic: string;
  cce: string;
  line: number;
}

// fourcol_cce_label 表：cce_semantic_label.json，(leafhash, label) → CCE 文件 + 行号区间（可含嵌套 [start, end] 范围）
export interface FourcolCceLabelItem {
  leafhash: string;
  label: string;
  cce: string;
  line: unknown[];
}

// fourcol_op 表：program.json，(leafhash, opmagic) → py 落点（semantic_label.filename / lineno；op.file 不参与）
export interface FourcolOpItem {
  leafhash: string;
  opmagic: string;
  pyFile: string;
  pyBasename: string;
  pyLine: number;
}

const FOURCOL_CCE_OPMAGIC_ATTRIBUTES = defineAttributes<FourcolCceOpmagicItem>({
  leafhash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  opmagic: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  cce: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  line: { type: Number, isQuery: true, isPrimary: true, defaultValue: 0 },
});

const FOURCOL_CCE_LABEL_ATTRIBUTES = defineAttributes<FourcolCceLabelItem>({
  leafhash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  label: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  cce: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  line: { type: Array },
});

const FOURCOL_OP_ATTRIBUTES = defineAttributes<FourcolOpItem>({
  leafhash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  opmagic: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  pyFile: { type: String },
  pyBasename: { type: String, isQuery: true },
  pyLine: { type: Number, isQuery: true },
});

let cceOpmagicStore: Store<FourcolCceOpmagicItem, 'leafhash' | 'opmagic' | 'cce' | 'line'>;
let cceLabelStore: Store<FourcolCceLabelItem, 'leafhash' | 'label' | 'cce'>;
let opStore: Store<FourcolOpItem, 'leafhash' | 'opmagic' | 'pyBasename' | 'pyLine'>;

export function getFourcolCceOpmagicStore(): Store<FourcolCceOpmagicItem, 'leafhash' | 'opmagic' | 'cce' | 'line'> {
  if (!cceOpmagicStore) {
    cceOpmagicStore = new SqlStore('fourcol_cce_opmagic', FOURCOL_CCE_OPMAGIC_ATTRIBUTES);
  }
  return cceOpmagicStore;
}

export function getFourcolCceLabelStore(): Store<FourcolCceLabelItem, 'leafhash' | 'label' | 'cce'> {
  if (!cceLabelStore) {
    cceLabelStore = new SqlStore('fourcol_cce_label', FOURCOL_CCE_LABEL_ATTRIBUTES);
  }
  return cceLabelStore;
}

export function getFourcolOpStore(): Store<FourcolOpItem, 'leafhash' | 'opmagic' | 'pyBasename' | 'pyLine'> {
  if (!opStore) {
    opStore = new SqlStore('fourcol_op', FOURCOL_OP_ATTRIBUTES);
  }
  return opStore;
}
