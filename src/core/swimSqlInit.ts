/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { defineAttributes, SqlStore, Store } from './store';

// swimgraph_parsed_info表
export interface swimGraphPasedInfoCache {
    filePath: string;
    lastChangeTime: string;
    dynTopoLastChangeTime: string;
    pmuLastChangeTime: string;
    infoPath: string;
}

const SWIM_GRAPH_PARSED_INFO_ATTRIBUTES = defineAttributes<swimGraphPasedInfoCache>({
    filePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    lastChangeTime: { type: String },
    dynTopoLastChangeTime: { type: String },
    pmuLastChangeTime: { type: String },
    infoPath: { type: String },
});

let swimGraphPasedInfoStore: Store<swimGraphPasedInfoCache, 'filePath'>;

export function getSwimGraphParsedInfoStore() {
    if(!swimGraphPasedInfoStore) {
        swimGraphPasedInfoStore = new SqlStore('swim_graph_parsed_info', SWIM_GRAPH_PARSED_INFO_ATTRIBUTES);
    }
    return swimGraphPasedInfoStore;
}