/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { SEdge, SNode } from "sprotty-protocol";
import { AstgrNode, FunctionData, MEMTYPE_MAP, Operation, PortReference, RawTensor, Tensor } from "./jsonGraph.types";
import { AttrReader, parseExprList, parseSymbolicOrIntList } from "./parseSymbolicAttr";

/**
 * Determines if two operations should be coordinated together based on their sync_queue properties
 */
export function hasSameCoordinationScope(phaseOp: Operation, compOp: Operation): boolean {
    // PHASE operators (subgraphid: -1) coordinate with computational operations based on pipe_id
    const phasePipeId = phaseOp.sync_queue?.pipe_id ?? 0;
    const compPipeId = compOp.sync_queue?.pipe_id ?? 0;

    // PHASE operators with pipe_id 0 coordinate with computational operations with pipe_id 0
    return phasePipeId === compPipeId;
}

/**
 * Adds phase grouping information to nodes for layout hints
 */
export function addPhaseGroupingInfo(actualData: FunctionData, nodes: SNode[]): void {
    if (!actualData.operations || !Array.isArray(actualData.operations)) {
        return;
    }

    let currentPhase = 0;

    for (let opIndex = 0; opIndex < actualData.operations.length; opIndex++) {
        const op = actualData.operations[opIndex];
        const nodeId = `operation-magic-${op.opmagic}`;

        // Track phase transitions
        if (op.opcode === 'PHASE1') {
            currentPhase = 1;
        } else if (op.opcode === 'PHASE2') {
            currentPhase = 2;
        }

        // Find the corresponding node and add phase info
        const node = nodes.find(n => n.id === nodeId) as AstgrNode;
        if (node) {
            // Add phase information to node for potential layout grouping
            node.phase = currentPhase;

            // Add subgraph information for computational operations
            if (op.subgraphid && op.subgraphid !== -1) {
                node.subgraphId = op.subgraphid;
            }
        }
    }
}

/**
 * Checks if the function data has a valid structure
 */
export function hasValidStructure(funcData: FunctionData): boolean {
    return !!(funcData.rawtensors || funcData.tensors || funcData.operations);
}

/**
 * Initializes the data structures used for graph construction
 */
export function initializeDataStructures() {
    return {
        nodes: [] as SNode[],
        edges: [] as SEdge[],
        tensorMap: new Map<string, { nodeId: string }>(),
        portMap: new Map<string, PortReference>(),
        rawTensorProducers: new Map<string, PortReference[]>(),
        rawTensorConsumers: new Map<string, PortReference[]>()
    };
}

/**
 * Creates tensor maps for quick lookup
 */
export function createTensorMaps(actualData: FunctionData) {
    const rawTensorMap = new Map<string, RawTensor>();
    if (actualData.rawtensors && Array.isArray(actualData.rawtensors)) {
        for (const rt of actualData.rawtensors) {
            rawTensorMap.set(String(rt.rawmagic), rt);
        }
    }

    const tensorToRawTensorMap = new Map<string, string>();
    const magicToTensorMap = new Map<string, Tensor>();
    if (actualData.tensors && Array.isArray(actualData.tensors)) {
        for (const tensor of actualData.tensors) {
            tensorToRawTensorMap.set(String(tensor.magic), String(tensor.rawtensor));
            magicToTensorMap.set(String(tensor.magic), tensor);
        }
    }

    const inoutMap = new Map<string, Set<string>>();
    if (actualData.incasts && Array.isArray(actualData.incasts)) {
        const incastSet = inoutMap.get('incasts') || new Set<string>();
        for (const incast of actualData.incasts) {
            const tensorMagic = String(Array.isArray(incast) ? incast[0] : incast);
            incastSet.add(tensorMagic);
        }
        inoutMap.set('incasts', incastSet);
    }

    if (actualData.outcasts && Array.isArray(actualData.outcasts)) {
        const outcastSet = inoutMap.get('outcasts') || new Set<string>();
        for (const outcast of actualData.outcasts) {
            const tensorMagic = String(Array.isArray(outcast) ? outcast[0] : outcast);
            outcastSet.add(tensorMagic);
        }
        inoutMap.set('outcasts', outcastSet);
    }

    return { rawTensorMap, magicToTensorMap, tensorToRawTensorMap, inoutMap };
}

// 处理 copy 类操作
export function parseCopyOp(labelAttr: string[], reader: AttrReader, isCopyOut: boolean, version: string, diffType?: 'before' | 'after'): void {
    reader.readNumber(diffType); // skip isCopyOut flag (already known from opcode)
    const memType = reader.readNumber(diffType);
    const memTypeStr = MEMTYPE_MAP[memType] || 'MEM_UNKNOWN';

    const offsetSize = reader.readNumber(diffType);
    const offset = parseSymbolicOrIntList(reader, offsetSize, version, diffType);
    const shape = parseSymbolicOrIntList(reader, offsetSize, version, diffType);

    labelAttr.push(`shape: [${shape.join(',')}]`);
    if (isCopyOut) {
        labelAttr.push(`from: ${memTypeStr}`);
        labelAttr.push(`to offset: [${offset.join(',')}]`);
    } else {
        labelAttr.push(`from offset: [${offset.join(',')}]`);
        labelAttr.push(`to: ${memTypeStr}`);
    }
}

// 处理 convert 操作
export function parseConvertOp(labelAttr: string[], reader: AttrReader, diffType?: 'before' | 'after'): void {
    const fromMemType = reader.readNumber(diffType);
    const toMemType = reader.readNumber(diffType);

    const fromStr = MEMTYPE_MAP[fromMemType] || 'MEM_UNKNOWN';
    const toStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

    labelAttr.push(`from: ${fromStr}`);
    labelAttr.push(`to: ${toStr}`);
}

// 处理 assemble/view 操作
export function parseAssembleViewOp(labelAttr: string[], reader: AttrReader, isAssemble: boolean, version: string, diffType?: 'before' | 'after'): void {
    const toMemType = reader.readNumber(diffType);
    const toMemStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

    const offsetSize = reader.readNumber(diffType);
    const offset: number[] = [];
    for (let i = 0; i < offsetSize; i++) {
        offset.push(reader.readNumber(diffType));
    }

    const dynOffsetSize = reader.readNumber(diffType);
    const dynOffsetParse = parseExprList(reader, dynOffsetSize, version, diffType);

    const dynShapeSize = reader.readNumber(diffType);
    const dynShapeParse = parseExprList(reader, dynShapeSize, version, diffType);

    labelAttr.push(`shape: [${dynShapeParse.join(',')}]`);
    if (isAssemble) {
        labelAttr.push(`from: ${toMemStr}`);
        labelAttr.push(`to offset: [${offset.join(',')}]`);
    } else {
        labelAttr.push(`from offset: [${offset.join(',')}]`);
        labelAttr.push(`to: ${toMemStr}`);
    }
}

export function filterSubgraph(filterSubgraphId: number, nodes: SNode[], edges: SEdge[], ): any[] {
    // Apply subgraph filtering if specified
    let filteredNodes = nodes;
    let filteredEdges = edges;

    // First, find operation nodes that belong to the specified subgraph
    const subgraphOperationIds = new Set<string>();

    for (const node of nodes) {
        const astgrNode = node as AstgrNode;

        // Include nodes that belong to the specified subgraph
        if (astgrNode.role === 'operation' && astgrNode.subgraphId === filterSubgraphId) {
            subgraphOperationIds.add(node.id);
        }
    }

    // Find all tensors that are connected to these subgraph operations
    const connectedTensorIds = new Set<string>();
    const connectedInputOutputIds = new Set<string>();

    for (const edge of edges) {
        let isConnectedToSubgraphOp = false;

        // Check if edge is connected to a subgraph operation
        for (const opId of subgraphOperationIds) {
            if (edge.sourceId?.includes(opId) || edge.targetId?.includes(opId)) {
                isConnectedToSubgraphOp = true;
                break;
            }
        }

        if (isConnectedToSubgraphOp) {
            // Extract tensor IDs from ports
            if (edge.sourceId?.includes('tensor-')) {
                const match = edge.sourceId.match(/tensor-(\d+)/);
                if (match) connectedTensorIds.add(`tensor-${match[1]}`);
            }
            if (edge.targetId?.includes('tensor-')) {
                const match = edge.targetId.match(/tensor-(\d+)/);
                if (match) connectedTensorIds.add(`tensor-${match[1]}`);
            }

            // Extract input/output node IDs from ports
            if (edge.sourceId?.includes('incast-')) {
                const match = edge.sourceId.match(/(incast-\d+-tensor-\d+)/);
                if (match) connectedInputOutputIds.add(match[1]);
            }
            if (edge.targetId?.includes('outcast-')) {
                const match = edge.targetId.match(/(outcast-\d+-tensor-\d+)/);
                if (match) connectedInputOutputIds.add(match[1]);
            }
        }
    }

    // Now find which input/output nodes are actually connected to the subgraph
    // by checking if they connect to the identified tensors
    for (const edge of edges) {
        // Check if edge connects incast/outcast to connected tensors
        if (edge.sourceId?.includes('incast-') && edge.targetId?.includes('tensor-')) {
            const tensorMatch = edge.targetId.match(/(tensor-\d+)/);
            const incastMatch = edge.sourceId.match(/(incast-\d+-tensor-\d+)/);
            if (tensorMatch && incastMatch && connectedTensorIds.has(tensorMatch[1])) {
                connectedInputOutputIds.add(incastMatch[1]);
            }
        }

        if (edge.sourceId?.includes('tensor-') && edge.targetId?.includes('outcast-')) {
            const tensorMatch = edge.sourceId.match(/(tensor-\d+)/);
            const outcastMatch = edge.targetId.match(/(outcast-\d+-tensor-\d+)/);
            if (tensorMatch && outcastMatch && connectedTensorIds.has(tensorMatch[1])) {
                connectedInputOutputIds.add(outcastMatch[1]);
            }
        }
    }

    // Build the final set of relevant node IDs
    const relevantNodeIds = new Set<string>();

    // Add subgraph operations
    subgraphOperationIds.forEach(id => relevantNodeIds.add(id));

    // Add connected tensors
    connectedTensorIds.forEach(id => relevantNodeIds.add(id));

    // Add only connected input/output nodes
    connectedInputOutputIds.forEach(id => relevantNodeIds.add(id));

    // Filter nodes
    filteredNodes = nodes.filter(node => relevantNodeIds.has(node.id));

    // Filter edges to only include those where both source and target nodes are relevant
    filteredEdges = edges.filter(edge => {
        let sourceRelevant = false;
        let targetRelevant = false;

        // Check if source port belongs to a relevant node
        if (edge.sourceId) {
            for (const nodeId of relevantNodeIds) {
                if (edge.sourceId.includes(nodeId)) {
                    sourceRelevant = true;
                    break;
                }
            }
        }

        // Check if target port belongs to a relevant node
        if (edge.targetId) {
            for (const nodeId of relevantNodeIds) {
                if (edge.targetId.includes(nodeId)) {
                    targetRelevant = true;
                    break;
                }
            }
        }

        return sourceRelevant && targetRelevant;
    });

    return [filteredEdges, filteredNodes]
}