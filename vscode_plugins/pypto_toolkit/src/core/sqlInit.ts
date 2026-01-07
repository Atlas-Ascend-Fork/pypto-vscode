import { defineAttributes, SqlStore, Store } from './store';

/**
 * 计算图
 */

// com_graph_layout 表
export interface comGraphLayoutCache {
    filePath: string;
    funcHash: string;
    lastChangeTime: string;
    layoutResult: string;
}

const COM_GRAPH_LAYOUT_ATTRIBUTES = defineAttributes<comGraphLayoutCache>({
    filePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    funcHash: { type: String, isQuery: true, isPrimary: true },
    lastChangeTime: { type: String, isQuery: true },
    layoutResult: { type: String },
});

let comGraphLayoutStore: Store<comGraphLayoutCache, 'filePath' | 'funcHash', 'lastChangeTime'>;

export function getComGraphLayoutStore() {
    if (!comGraphLayoutStore) {
        comGraphLayoutStore = new SqlStore('com_graph_layout', COM_GRAPH_LAYOUT_ATTRIBUTES);
    }
    return comGraphLayoutStore;
}

// com_graph_final_result 表
export interface comGraphFinalResultCache {
    filePath: string;
    funcHash: string;
    lastChangeTime: string;
    finalResult: string;
}

const COM_GRAPH_FINAL_RESULT_ATTRIBUTES = defineAttributes<comGraphFinalResultCache>({
    filePath: { type: String, isQuery: true, isPrimary: true },
    funcHash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    lastChangeTime: { type: String, isQuery: true },
    finalResult: { type: String },
});

let comGraphFinalResultStore: Store<comGraphFinalResultCache, 'filePath' | 'funcHash', 'lastChangeTime'>;

export function getComGraphFinalResultStore() {
    if (!comGraphFinalResultStore) {
        comGraphFinalResultStore = new SqlStore('com_graph_final_result', COM_GRAPH_FINAL_RESULT_ATTRIBUTES);
    }
    return comGraphFinalResultStore;
}

// com_graph_func_data 表
export interface comGraphFuncDataCache {
    filePath: string;
    funcHash: string;
    lastChangeTime: string;
    data: string;
    callHashArr: string;
}

const COM_GRAPH_FUNC_DATA_ATTRIBUTES = defineAttributes<comGraphFuncDataCache>({
    filePath: { type: String, isQuery: true, isPrimary: true },
    funcHash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    lastChangeTime: { type: String, isQuery: true },
    data: { type: String },
    callHashArr: { type: String },
});

let comGraphFuncDataStore: Store<comGraphFuncDataCache, 'filePath' | 'funcHash', 'lastChangeTime'>;

export function getComGraphFuncDataStore() {
    if (!comGraphFuncDataStore) {
        comGraphFuncDataStore = new SqlStore('com_graph_func_data', COM_GRAPH_FUNC_DATA_ATTRIBUTES);
    }
    return comGraphFuncDataStore;
}

// com_graph_file_hash_map 表
export interface comGraphFileHashMapCache {
    filePath: string;
    data: string;
}

const COM_GRAPH_FILE_HASH_MAP_ATTRIBUTES = defineAttributes<comGraphFileHashMapCache>({
    filePath: { type: String, isQuery: true, isPrimary: true },
    data: { type: String },
});

let comGraphFileHashMapStore: Store<comGraphFileHashMapCache, 'filePath'>;

export function getComGraphFileHashMapStore() {
    if (!comGraphFileHashMapStore) {
        comGraphFileHashMapStore = new SqlStore('com_graph_file_hash_map', COM_GRAPH_FILE_HASH_MAP_ATTRIBUTES);
    }
    return comGraphFileHashMapStore;
}

// com_graph_file_callee_op_attr 表
export interface comGraphFileCalleeOpAttrCache {
    calleehash: string;
    opMagic: string;
    opSubgraphid: string;
    opAttr: string;
    ioperands: string;
}

const COM_GRAPH_FILE_CALLEE_OP_ATTR_ATTRIBUTES = defineAttributes<comGraphFileCalleeOpAttrCache>({
    calleehash: { type: String, isQuery: true, isPrimary: true },
    opMagic: { type: String, isQuery: true, isPrimary: true },
    opSubgraphid: { type: String, isQuery: true, isPrimary: true },
    opAttr: { type: String },
    ioperands: { type: String },
});

let comGraphFileCalleeOpAttrStore: Store<comGraphFileCalleeOpAttrCache, 'calleehash' | 'opMagic' | 'opSubgraphid'>;

export function getComGraphFileCalleeOpAttrStore() {
    if (!comGraphFileCalleeOpAttrStore) {
        comGraphFileCalleeOpAttrStore = new SqlStore('com_graph_file_callee_op_attr', COM_GRAPH_FILE_CALLEE_OP_ATTR_ATTRIBUTES);
    }
    return comGraphFileCalleeOpAttrStore;
}