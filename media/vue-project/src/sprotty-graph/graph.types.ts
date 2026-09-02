/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { SNode, SPort } from "sprotty-protocol";

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
}

/**
 * Port interface for ASTGR nodes
 */
export interface AstgrPort extends SPort {
    role: 'input' | 'output';
}

export type MetadataLabel = {
    minZoomLevel: number
}

export const MEMTYPE_MAP: { [key: number]: string } = {
    0: 'MEM_UB', 1: 'MEM_L1', 2: 'MEM_L0A', 3: 'MEM_L0B', 4: 'MEM_L0C', 5: 'MEM_FIX',
    6: 'MEM_FIX_QUANT_PRE', 7: 'MEM_FIX_RELU_PRE', 8: 'MEM_FIX_RELU_POST', 9: 'MEM_FIX_QUANT_POST',
    10: 'MEM_FIX_ELT_ANTIQ', 11: 'MEM_FIX_MTE2_ANTIQ', 12: 'MEM_BT', 13: 'MEM_L2', 14: 'MEM_L3',
    15: 'MEM_DEVICE_DDR', 16: 'MEM_HOST1', 17: 'MEM_FAR1', 18: 'MEM_FAR2', 19: 'MEM_WORKSPACE',
    20: 'MEM_VECTOR_REG', 21: 'MEM_UNKNOW'
};