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
  timelineData: string;
}

const MEMORY_TRACE_CACHE_ATTRIBUTES = defineAttributes<MemoryTraceCache>({
  filePath: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  totalCycles: { type: Number, isQuery: true },
  chipArch: { type: String, isQuery: true },
  mtime: { type: Number, isQuery: true },
  createdAt: { type: Number },
  timelineData: { type: String },
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

export interface FailBufferState {
  memId: number;
  ownerOpMagic: number;
  addrStart: number;
  size: number;
  status: number;
}
// memory_trace_events 表
export interface MemoryTraceEvent {
  id: number;
  filePath: string;
  eventType: string;
  coreType?: string;
  clock: number;
  cycleEnd?: number;
  size?: string;
  memType?: string;
  addrStart?: number;
  addrEnd?: number;
  inputMemIds?: number[];
  outputMemIds?: number[];
  freedMemIds?: number[];
  opMagic?: number;
  coreIdx?: number;
  ddrMemType?: string;
  ddrAddrStart?: number;
  ddrAddrEnd?: number;
  ddrSize?: number;
  reloadAllocOpMagic?: number;
  reloadCopyInOpMagic?: number;
  spillCopyoutOpMagic?: number;
  spillCopyoutSize?: number;
  spillTensorMagic?: number;
  spillDdrMemId?: number;
  triggerOpMagic?: number;
  triggerTensorSize?: number;
  requestSize?: number;
  kind?: string;
  magic?: number;
  dtype?: string;
  shape?: [];
  changes?: [];
  bufferSnapshot?: {
    capacity: number;
    occupiedSlices: FailBufferState[];
    freeIntervals: [];
  };
  action?: {
    targetBufferList: BufferState[];
    originBufferList: BufferState[];
    errorMemType?: [];
  };
}

const MEMORY_TRACE_EVENT_ATTRIBUTES = defineAttributes<MemoryTraceEvent>({
  id: { type: Number, isQuery: true, isPrimary: true },

  filePath: { type: String, isQuery: true, isPrimary: true },
  eventType: { type: String, isQuery: true },
  clock: { type: Number, isQuery: true },

  // ========== 基础可选字段 ==========
  coreType: { type: String },
  cycleEnd: { type: Number },
  size: { type: String },
  memType: { type: String },
  addrStart: { type: Number },
  addrEnd: { type: Number },

  // ========== 数组类型字段 ==========
  inputMemIds: { type: Array },
  outputMemIds: { type: Array },
  freedMemIds: { type: Array },

  // ========== 其他数字类型字段 ==========
  opMagic: { type: Number },
  coreIdx: { type: Number },
  reloadAllocOpMagic: { type: Number },
  reloadCopyInOpMagic: { type: Number },
  spillCopyoutOpMagic: { type: Number },
  triggerOpMagic: { type: Number },
  triggerTensorSize: { type: Number },

  // ========== 🆕 本次新增的字段 ==========
  // DDR 相关字段
  ddrMemType: { type: String },
  ddrAddrStart: { type: Number },
  ddrAddrEnd: { type: Number },
  ddrSize: { type: Number },

  // Spill 相关字段
  spillCopyoutSize: { type: Number },
  spillTensorMagic: { type: Number },
  spillDdrMemId: { type: Number },

  // 其他零散字段
  requestSize: { type: Number },
  kind: { type: String },
  magic: { type: Number },
  dtype: { type: String },
  shape: { type: Array },
  changes: { type: Array },

  // 复杂的嵌套对象（底层会自动进行 JSON 序列化/反序列化）
  bufferSnapshot: { type: Object },
  action: { type: Object },
});

let memoryTraceEventStore: Store<MemoryTraceEvent, 'id' | 'filePath', 'clock'>;

export function getMemoryTraceEventStore() {
  if (!memoryTraceEventStore) {
    memoryTraceEventStore = new SqlStore('memory_trace_events', MEMORY_TRACE_EVENT_ATTRIBUTES);
  }
  return memoryTraceEventStore;
}
