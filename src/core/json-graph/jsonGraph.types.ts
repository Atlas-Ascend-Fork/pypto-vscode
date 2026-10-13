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
import { SModelRoot, SNode, SPort } from "sprotty-protocol";

/**
 * Extended SModelRoot with custom properties
 */
export interface ExtendedSModelRoot extends SModelRoot {
    colorBySubgraph?: boolean;
    filterSubgraphId?: number;
}

/**
 * Base interface for all ASTGR nodes extending SNode with role-specific properties
 */
export interface AstgrNode extends SNode {
    magic: string;
    role: 'input' | 'operation' | 'tensor' | 'output' | 'sync';
    calleehash?: string; // For CALL operations that reference subgraph functions
    opcode?: string; // Store the operation code
    pipeId?: number; // For sync operations, store pipe_id
    trigPipe?: number; // For sync operations, store trig_pipe
    eventId?: number; // For sync operations, store event_id
    phase?: number; // Execution phase (PHASE1, PHASE2, etc.)
    subgraphId?: number; // Subgraph ID for computational operations
    latency?: number; // Operation execution latency
    opmagic?: string; // Operation magic number for identification
    kind?: number; // Operation kind
    isCube?: boolean; // Whether operation uses CUBE processing
    semanticLabel?: string; // Semantic label for the operation
    coreType?: number; // Core type from sync_queue
    gmBufId?: number; // Global memory buffer ID
    hasAttr?: boolean;
    compareType?: any;
    baseColor?: string;
    lightColor?: string;
    codePath?: string;
    codeLine?: string | number;
    isError?: boolean;
    isEmptyNode?: boolean;
    isAccuracyError?: boolean;
    isAccuracyException?: boolean;
    isTokenNode?: boolean;
}

/**
 * Port interface for ASTGR nodes
 */
export interface AstgrPort extends SPort {
    role: 'input' | 'output';
}

/**
 * Input node interface
 */
export interface AstgrInputNode extends AstgrNode {
    type: 'node:input';
}

/**
 * Output node interface
 */
export interface AstgrOutputNode extends AstgrNode {
    type: 'node:output';
}

/**
 * Tensor node interface
 */
export interface AstgrTensorNode extends AstgrNode {
    type: 'node:tensor';
    compareType?: string;
    baseColor?: string;
    lightColor?: string;
    isError?: boolean;
    isMiddle?: boolean;
    isAccuracyError?: boolean;
    isAccuracyException?: boolean;
    rawMagic?: string;
}

/**
 * Synchronization node interface
 */
export interface AstgrSyncNode extends AstgrNode {
    type: 'node:sync';
}

/**
 * Raw tensor data structure
 */
export interface RawTensor {
    kind: number;
    rawmagic: number;
    rawshape: number[];
    datatype: number;
    symbol?: string;
    ori_rawshape?: number[];
    tensorIndex?: number;
    tensorSubscript?: number;
}

/**
 * Tensor data structure
 */
export interface Tensor {
    magic: number;
    rawtensor: any;
    offset: number[];
    nodetype: number;
    format: number;
    shape: number[];
    kind: number;
    validshape?: number[];
    dynvalidshape?: number[];
    semantic_label: {
        filename?: string;
        label?: string;
        lineno?: number;
    };
    mem_type?: { [key: string]: number };
    subgraphid?: number;
    compareType?: string
}

/**
 * Sync queue configuration
 */
export interface SyncQueue {
    pipe_id?: number;
    trig_pipe?: number;
    event_id?: number;
    core_type?: number;
    gm_buf_id?: number;
    tri_core_type?: number;
    offset?: number[];
}

/**
 * SemanticLab configuration
 */
export interface SemanticLab {
    color: string; 
}
/**
 * Operation data structure
 */
export interface Operation {
    kind: number;
    opmagic: number;
    opcode: string;
    ioperands: number[];
    ooperands: number[];
    itokens?: string[];
    otokens?: string[];
    semantic_label: {
        filename?: string;
        label?: string;
        lineno?: number;
    };
    subgraphid?: number;
    calleehash?: string;
    sync_queue?: SyncQueue;
    latency?: number;
    offset?: number[];
    func_magicname?: string;
    compareType: any;
    file?: string;
    line?: string;
    attr?: (number | (number | string)[])[];
    mixSubgraphCore?: string;
}

/**
 * Function data structure containing all graph elements
 */
export interface FunctionData {
    func_magicname?: string;
    rawtensors?: RawTensor[];
    tensors?: Tensor[];
    operations?: Operation[];
    incasts?: (number | number[])[];
    outcasts?: number[][];
    functions?: FunctionData[];
    inouttensors?: CallInOutItems;
}

/**
 * Operation reference for sync coordination
 */
export interface OpReference {
    index: number;
    op: Operation;
}

/**
 * Port reference for graph connections
 */
export interface PortReference {
    nodeId: string;
    portId: string;
}

export type MetadataLabel = {
    minZoomLevel: number
}

/**
 * Global mapping of format enum values to string representations
 */
export const FORMAT_MAP: { [key: number]: string } = {
    0: 'ND', 1: 'NZ'
};

/**
 * Global mapping of memory type enum values to string representations
 */
export const MEMTYPE_MAP: { [key: number]: string } = {
    0: 'MEM_UB', 1: 'MEM_L1', 2: 'MEM_L0A', 3: 'MEM_L0B', 4: 'MEM_L0C', 5: 'MEM_FIX',
    6: 'MEM_FIX_QUANT_PRE', 7: 'MEM_FIX_RELU_PRE', 8: 'MEM_FIX_RELU_POST', 9: 'MEM_FIX_QUANT_POST',
    10: 'MEM_FIX_ELT_ANTIQ', 11: 'MEM_FIX_MTE2_ANTIQ', 12: 'MEM_BT', 13: 'MEM_L2', 14: 'MEM_L3',
    15: 'MEM_DEVICE_DDR', 16: 'MEM_HOST1', 17: 'MEM_FAR1', 18: 'MEM_FAR2', 19: 'MEM_WORKSPACE',
    20: 'MEM_VECTOR_REG', 21: 'MEM_UNKNOW'
};

/**
 * Global mapping of datatype enum values to string representations
 */
export const DATATYPE_MAP: { [key: number]: string } = {
    0: 'int4', 1: 'int8', 2: 'int16', 3: 'int32',
    4: 'int64', 5: 'fp8', 6: 'fp16', 7: 'fp32',
    8: 'bf16', 9: 'hf4', 10: 'hf8', 11: 'uint8',
    12: 'uint16', 13: 'uint32', 14: 'uint64', 15: 'bool',
    16: 'double'
};

export interface TensorRowTensorItems {
    tensor: Tensor;
    rawTensor: RawTensor;
}

export interface CallInOutItems {
    inTensors: TensorRowTensorItems[];
    outTensors: TensorRowTensorItems[];
}