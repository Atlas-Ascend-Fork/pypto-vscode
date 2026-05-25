import { defineAttributes, SqlStore, Store } from './store';

/**
 * 计算图
 */

// com_graph_layout 表
export interface ComGraphLayoutCache {
    filePath: string;
    funcHash: string;
    lastChangeTime: string;
    layoutResult: string;
}

const COM_GRAPH_LAYOUT_ATTRIBUTES = defineAttributes<ComGraphLayoutCache>({
    filePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    funcHash: { type: String, isQuery: true, isPrimary: true },
    lastChangeTime: { type: String, isQuery: true },
    layoutResult: { type: String },
});

let comGraphLayoutStore: Store<ComGraphLayoutCache, 'filePath' | 'funcHash', 'lastChangeTime'>;

export function getComGraphLayoutStore() {
    if (!comGraphLayoutStore) {
        comGraphLayoutStore = new SqlStore('com_graph_layout', COM_GRAPH_LAYOUT_ATTRIBUTES);
    }
    return comGraphLayoutStore;
}

// com_graph_final_result 表
export interface ComGraphFinalResultCache {
    filePath: string;
    funcHash: string;
    lastChangeTime: string;
    finalResult: string;
}

const COM_GRAPH_FINAL_RESULT_ATTRIBUTES = defineAttributes<ComGraphFinalResultCache>({
    filePath: { type: String, isQuery: true, isPrimary: true },
    funcHash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    lastChangeTime: { type: String, isQuery: true },
    finalResult: { type: String },
});

let comGraphFinalResultStore: Store<ComGraphFinalResultCache, 'filePath' | 'funcHash', 'lastChangeTime'>;

export function getComGraphFinalResultStore() {
    if (!comGraphFinalResultStore) {
        comGraphFinalResultStore = new SqlStore('com_graph_final_result', COM_GRAPH_FINAL_RESULT_ATTRIBUTES);
    }
    return comGraphFinalResultStore;
}

// com_graph_func_data 表
export interface ComGraphFuncDataCache {
    filePath: string;
    funcHash: string;
    lastChangeTime: string;
    data: string;
    callHashArr: string;
    firstEntryHash: string;
}

const COM_GRAPH_FUNC_DATA_ATTRIBUTES = defineAttributes<ComGraphFuncDataCache>({
    filePath: { type: String, isQuery: true, isPrimary: true },
    funcHash: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    lastChangeTime: { type: String, isQuery: true },
    data: { type: String },
    callHashArr: { type: String },
    firstEntryHash: { type: String },
});

let comGraphFuncDataStore: Store<ComGraphFuncDataCache, 'filePath' | 'funcHash', 'lastChangeTime'>;

export function getComGraphFuncDataStore() {
    if (!comGraphFuncDataStore) {
        comGraphFuncDataStore = new SqlStore('com_graph_func_data', COM_GRAPH_FUNC_DATA_ATTRIBUTES);
    }
    return comGraphFuncDataStore;
}

// com_graph_file_hash_map 表
export interface ComGraphFileHashMapCache {
    filePath: string;
    data: string;
}

const COM_GRAPH_FILE_HASH_MAP_ATTRIBUTES = defineAttributes<ComGraphFileHashMapCache>({
    filePath: { type: String, isQuery: true, isPrimary: true },
    data: { type: String },
});

let comGraphFileHashMapStore: Store<ComGraphFileHashMapCache, 'filePath'>;

export function getComGraphFileHashMapStore() {
    if (!comGraphFileHashMapStore) {
        comGraphFileHashMapStore = new SqlStore('com_graph_file_hash_map', COM_GRAPH_FILE_HASH_MAP_ATTRIBUTES);
    }
    return comGraphFileHashMapStore;
}

// com_graph_file_callee_op_attr 表
export interface ComGraphFileCalleeOpAttrCache {
    calleehash: string;
    opMagic: string;
    opSubgraphid: string;
    opAttr: string;
    ioperands: string;
}

const COM_GRAPH_FILE_CALLEE_OP_ATTR_ATTRIBUTES = defineAttributes<ComGraphFileCalleeOpAttrCache>({
    calleehash: { type: String, isQuery: true, isPrimary: true },
    opMagic: { type: String, isQuery: true, isPrimary: true },
    opSubgraphid: { type: String, isQuery: true, isPrimary: true },
    opAttr: { type: String },
    ioperands: { type: String },
});

let comGraphFileCalleeOpAttrStore: Store<ComGraphFileCalleeOpAttrCache, 'calleehash' | 'opMagic' | 'opSubgraphid'>;

export function getComGraphFileCalleeOpAttrStore() {
    if (!comGraphFileCalleeOpAttrStore) {
        comGraphFileCalleeOpAttrStore = new SqlStore('com_graph_file_callee_op_attr', COM_GRAPH_FILE_CALLEE_OP_ATTR_ATTRIBUTES);
    }
    return comGraphFileCalleeOpAttrStore;
}

// ============================================
// 内存追踪缓存
// ============================================

// memory_trace_cache 表
export interface MemoryTraceCache {
    filePath: string;
    totalCycles: number;
    chipArch: string;
    mtime: number; // 文件修改时间，用于缓存验证
    createdAt: number;
}

const MEMORY_TRACE_CACHE_ATTRIBUTES = defineAttributes<MemoryTraceCache>({
    filePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
    totalCycles: { type: Number, isQuery: true },
    chipArch: { type: String, isQuery: true },
    mtime: { type: Number, isQuery: true },
    createdAt: { type: Number },
});

let memoryTraceCacheStore: Store<MemoryTraceCache, 'filePath', 'createdAt'>;

export function getMemoryTraceCacheStore() {
    if (!memoryTraceCacheStore) {
        memoryTraceCacheStore = new SqlStore('memory_trace_cache', MEMORY_TRACE_CACHE_ATTRIBUTES);
    }
    return memoryTraceCacheStore;
}

export interface BufferState {
  memId: number;
  memType: string;
  addrStart: number;
  size: number;
  status: number;
}
// memory_trace_events 表
export interface MemoryTraceEvent {
    id: string;
      filePath: string,
      eventType: string;
      coreType?: string;
      clock: number;
      cycleEnd?: number;
      size?: string;
      memType?: string;
      addrStart?: number;
      addrEnd?: number;
      inputMemIds?:number[];
      outputMemIds?:number[];
      freedMemIds?:number[];
      opMagic?:number;
      coreIdx?:number;
      reloadAllocOpMagic?:number;
      reloadCopyInOpMagic?:number;
      spillCopyoutOpMagic?:number;
      triggerOpMagic?:number;
      triggerTensorSIze?:number;
      kind?:string;
      magic?:number;
      dtype?:string;
      shape?:[];
      action?:{
        targetBufferList:BufferState[],
        originBufferList:BufferState[]
      };
}

const MEMORY_TRACE_EVENT_ATTRIBUTES = defineAttributes<MemoryTraceEvent>({
    id: { type: String, isPrimary: true },
    
    filePath: { type: String, isQuery: true },
    eventType: { type: String, isQuery: true },
    clock: { type: Number, isQuery: true },
    
    // 基础可选字段
    coreType: { type: String },
    cycleEnd: { type: Number },
    size: { type: String },
    memType: { type: String },
    addrStart: { type: Number },
    addrEnd: { type: Number },
    
    // 数组类型字段（底层通常会自动处理为 JSON 字符串存储）
    inputMemIds: { type: Array },
    outputMemIds: { type: Array },
    freedMemIds: { type: Array },
    
    // 其他数字类型字段
    opMagic: { type: Number },
    coreIdx: { type: Number },
    reloadAllocOpMagic: { type: Number },
    reloadCopyInOpMagic: { type: Number },
    spillCopyoutOpMagic: { type: Number },
    triggerOpMagic: { type: Number },
    triggerTensorSIze: { type: Number },
    
    // 复杂的嵌套对象
    action: { type: Object },
});

let memoryTraceEventStore: Store<MemoryTraceEvent, 'id', 'clock' | 'filePath'>;

export function getMemoryTraceEventStore() {
    if (!memoryTraceEventStore) {
        memoryTraceEventStore = new SqlStore('memory_trace_events', MEMORY_TRACE_EVENT_ATTRIBUTES, { version: 2 });
    }
    return memoryTraceEventStore;
}

