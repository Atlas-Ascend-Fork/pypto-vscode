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
import { SCompartment, SEdge, SLabel, SNode } from "sprotty-protocol";
import { AstgrNode, AstgrPort, AstgrTensorNode, FunctionData, MEMTYPE_MAP, MetadataLabel, Operation, OpReference, PortReference, RawTensor, Tensor } from "./jsonGraph.types";
import { AttrReader, parseExprList, parseSymbolicOrIntList } from "./parseSymbolicAttr";
import { t } from 'i18next';

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

function extractTensorIdFromEdge(edgeId: string | undefined, pattern: string): string | null {
    if (!edgeId?.includes(pattern)) {
        return null;
    }
    const match = edgeId.match(/tensor-(\d+)/);
    return match ? `tensor-${match[1]}` : null;
}

function extractInputOutputIdFromEdge(edgeId: string | undefined, pattern: string): string | null {
    if (!edgeId?.includes(pattern)) {
        return null;
    }
    const match = edgeId.match(new RegExp(`(${pattern.replace('-', '-')}-\\d+-tensor-\\d+)`));
    return match ? match[1] : null;
}

function collectConnectedTensorsAndIOs(
    edges: SEdge[],
    subgraphOperationIds: Set<string>,
    connectedTensorIds: Set<string>,
    connectedInputOutputIds: Set<string>
): void {
    for (const edge of edges) {
        let isConnectedToSubgraphOp = false;

        for (const opId of subgraphOperationIds) {
            if (edge.sourceId?.includes(opId) || edge.targetId?.includes(opId)) {
                isConnectedToSubgraphOp = true;
                break;
            }
        }

        if (!isConnectedToSubgraphOp) {
            continue;
        }

        const sourceTensorId = extractTensorIdFromEdge(edge.sourceId, 'tensor-');
        if (sourceTensorId) {
            connectedTensorIds.add(sourceTensorId);
        }

        const targetTensorId = extractTensorIdFromEdge(edge.targetId, 'tensor-');
        if (targetTensorId) {
            connectedTensorIds.add(targetTensorId);
        }

        const incastId = extractInputOutputIdFromEdge(edge.sourceId, 'incast');
        if (incastId) {
            connectedInputOutputIds.add(incastId);
        }

        const outcastId = extractInputOutputIdFromEdge(edge.targetId, 'outcast');
        if (outcastId) {
            connectedInputOutputIds.add(outcastId);
        }
    }
}

function collectConnectedIOsByTensor(
    edges: SEdge[],
    connectedTensorIds: Set<string>,
    connectedInputOutputIds: Set<string>
): void {
    for (const edge of edges) {
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
}

function isEdgeRelevant(edge: SEdge, relevantNodeIds: Set<string>): boolean {
    let sourceRelevant = false;
    let targetRelevant = false;

    if (edge.sourceId) {
        for (const nodeId of relevantNodeIds) {
            if (edge.sourceId.includes(nodeId)) {
                sourceRelevant = true;
                break;
            }
        }
    }

    if (edge.targetId) {
        for (const nodeId of relevantNodeIds) {
            if (edge.targetId.includes(nodeId)) {
                targetRelevant = true;
                break;
            }
        }
    }

    return sourceRelevant && targetRelevant;
}

export function filterSubgraph(filterSubgraphId: number, nodes: SNode[], edges: SEdge[]): any[] {
    // First, find operation nodes that belong to the specified subgraph
    const subgraphOperationIds = new Set<string>();

    for (const node of nodes) {
        const astgrNode = node as AstgrNode;
        if (astgrNode.role === 'operation' && astgrNode.subgraphId === filterSubgraphId) {
            subgraphOperationIds.add(node.id);
        }
    }

    // Find all tensors that are connected to these subgraph operations
    const connectedTensorIds = new Set<string>();
    const connectedInputOutputIds = new Set<string>();

    collectConnectedTensorsAndIOs(edges, subgraphOperationIds, connectedTensorIds, connectedInputOutputIds);

    // Find which input/output nodes are actually connected to the subgraph
    collectConnectedIOsByTensor(edges, connectedTensorIds, connectedInputOutputIds);

    // Build the final set of relevant node IDs
    const relevantNodeIds = new Set<string>();
    subgraphOperationIds.forEach(id => relevantNodeIds.add(id));
    connectedTensorIds.forEach(id => relevantNodeIds.add(id));
    connectedInputOutputIds.forEach(id => relevantNodeIds.add(id));

    // Filter nodes and edges
    const filteredNodes = nodes.filter(node => relevantNodeIds.has(node.id));
    const filteredEdges = edges.filter(edge => isEdgeRelevant(edge, relevantNodeIds));

    return [filteredEdges, filteredNodes];
}

export function findIncastIndex(actualData: FunctionData, startNode: string): number | undefined {
    for (let idx = 0; idx < actualData.incasts!.length; idx++) {
        if (actualData.incasts![idx][0].toString() === startNode) {
            return idx;
        }
    }
    return undefined;
}

export function findOutcastIndex(actualData: FunctionData, startNode: string): number | undefined {
    for (let idx = 0; idx < actualData.outcasts!.length; idx++) {
        if (actualData.outcasts![idx][0].toString() === startNode) {
            return idx;
        }
    }
    return undefined;
}

export function removeEmptyNodesForTensor(nodes: SNode[], tensorMagic: string): void {
    for (let index = nodes.length - 1; index >= 0; index--) {
        if (nodes[index].id?.includes(tensorMagic) && nodes[index].id?.endsWith('empty')) {
            nodes.splice(index, 1);
        }
    }
}

export function buildTensorMetadataCompartment(nodeId: string, labelParts: string[]): SCompartment {
    return {
        type: 'compartment',
        id: `${nodeId}-metadata-compartment`,
        layout: 'vbox',
        layoutOptions: {
            hAlign: 'left',
            vGap: 4,
            paddingLeft: 0,
        },
        cssClasses: ['tensor-metadata-compartment'],
        children: labelParts.map((part, index) => {
            const splitedStr = part.split(':');
            let value = splitedStr[1];
            if (value.length > 32) {
                value = value.slice(0, 32) + '...';
            }
            return {
                type: 'label',
                id: `${nodeId}-label-meta-${index}`,
                originText: part,
                text: [splitedStr[0], value].join(':'),
                cssClasses: ['tensor-meta-label'],
                minZoomLevel: 0.4
            } as SLabel & MetadataLabel
        })
    } as SCompartment;
}

export function createEmptyNodeWithPort(nodeId: string, magic: string): AstgrNode {
    const children: (SCompartment | AstgrPort)[] = [];
    const truncatePortId = nodeId.replace(/(-in|-out)$/, '');
    const labelChildren: SLabel[] = [
        {
            type: 'label',
            id: `${magic}-label-main`,
            text: t('pypto.emptyNodeList'),
            magic: magic,
            size: {width: 110, height: 50},
            cssClasses: ['operation-main-label-empty'],
            isEmptyLabel: true,
            layoutOptions: {
                hAlign: 'center',
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 10,
                paddingRight: 0
            }
        } as SLabel
    ];
    children.push({
        type: 'compartment',
        id: `${magic}-labels-compartment`,
        layout: 'vbox',
        magic: magic,
        subgraphId: '',
        layoutOptions: {
            hAlign: 'center',
            vAlign: 'center',
            vGap: 10,
            paddingTop: 14,
            paddingBottom: 14,
            paddingLeft: 6,
            paddingRight: 9
        },
        size: {width: 110, height: 50},
        cssClasses: ['operation-labels-compartment'],
        children: [...labelChildren]
    } as SCompartment);
    const inPort: AstgrPort = { type: 'port', id: nodeId, role: 'input', size: { width: 8, height: 8 } };
    children.push(inPort);
    const outPortId = nodeId.replace(/-in$/, '-out');
    const outPort: AstgrPort = { type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8 } };
    children.push(outPort);
    return {
      type: 'node',
      id:  truncatePortId,
      magic: magic,
      role: 'output',
      compareType: 'none',
      codePath: '', 
      codeLine: undefined, 
      layout: 'vbox',
      layoutOptions: { hAlign: 'center', vAlign: 'top' },
      size: {width: 110, height: 50},
      cssClasses: ['operation-main-op-empty'],
      baseColor:'rgba(246, 158, 57, 0.2)',
      children,
      isEmptyNode: true
    };
}

export function createTokenNode(nodeId: string, tokenMagic: string): AstgrNode {
    const children: (SCompartment | AstgrPort)[] = [];
    const labelChildren: SLabel[] = [
        {
            type: 'label',
            id: `${tokenMagic}-token-label-main`,
            text: `Token: ${tokenMagic}`,
            magic: tokenMagic,
            cssClasses: ['operation-main-label'],
            isTokenLabel: true,
            layoutOptions: {
                hAlign: 'center',
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 10,
                paddingRight: 0
            }
        } as SLabel
    ];
    children.push({
        type: 'compartment',
        id: `${tokenMagic}-token-labels-compartment`,
        layout: 'vbox',
        magic: tokenMagic,
        subgraphId: '',
        layoutOptions: {
            hAlign: 'center',
            vAlign: 'center',
            vGap: 10,
            paddingTop: 14,
            paddingBottom: 14,
            paddingLeft: 6,
            paddingRight: 9
        },
        cssClasses: ['operation-labels-compartment'],
        children: [...labelChildren]
    } as SCompartment);
    const inPort: AstgrPort = { type: 'port', id: nodeId, role: 'input', size: { width: 8, height: 8 } };
    children.push(inPort);
    const outPortId = nodeId.replace(/-in$/, '-out');
    const outPort: AstgrPort = { type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8 } };
    children.push(outPort);
    const retid = nodeId.replace(/(-in|-out)$/, '');
    return {
        type: 'node',
        id: retid,
        magic: '',
        role: 'operation',
        compareType: 'none',
        codePath: '',
        codeLine: undefined,
        layout: 'vbox',
        layoutOptions: { hAlign: 'center', vAlign: 'top' },
        baseColor: 'var(--devui-token-node-base-color)',
        children,
        isEmptyNode: true,
        isTokenNode: true,
    };
}

export function getCastNodeState(
    tensor: Tensor,
    rawTensor: RawTensor | undefined,
    nodeRole: "operation" | "tensor" | "input" | "output" | "sync",
    errNodeList?: any,
    wrongRawMagicList?: any
): { isError: boolean; baseColor: any; lightColor: any; isAccuracyError: boolean; isAccuracyException: boolean } {
    let isError = false;
    let baseColor;
    let lightColor;
    if (errNodeList?.has(tensor.magic)) {
        isError = true;
        baseColor = 'rgba(231, 67, 74, 1)';
        lightColor = 'rgba(250, 189, 193, 1)';
    }
    let isAccuracyError = false;
    let isAccuracyException = false;
    const errorRawMagicList = wrongRawMagicList?.errorRawMagicList;
    const exceptionRawMagicList = wrongRawMagicList?.exceptionRawMagicList;
    if (errorRawMagicList?.includes(String(rawTensor?.rawmagic)) && (nodeRole === 'output')) {
        isAccuracyError = true;
        baseColor = 'rgba(185, 54, 59, 1)';
        lightColor = 'rgba(231, 67, 74, 1)';
    }
    if (exceptionRawMagicList?.includes(String(rawTensor?.rawmagic)) && (nodeRole === 'output')) {
        isAccuracyException = true;
        baseColor = 'rgba(185, 54, 59, 1)';
        lightColor = 'rgba(231, 67, 74, 1)';
    }
    return { isError, baseColor, lightColor, isAccuracyError, isAccuracyException };
}

export function buildCastMetadataCompartment(nodeId: string, nodeRole: string, metadataParts: string[]): SCompartment {
    return {
        type: 'compartment',
        id: `${nodeId}-metadata-compartment`,
        layout: 'vbox',
        layoutOptions: {
            hAlign: 'left',
            vGap: 3,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0
        },
        cssClasses: [`${nodeRole}-metadata-compartment`],
        children: metadataParts.map((part, index) => {
            const splitedStr = part.split(':');
            let value = splitedStr[1];
            if (value.length > 32) {
                value = value.slice(0, 32) + '...';
            }
            return {
                type: 'label',
                id: `${nodeId}-label-meta-${index}`,
                originText: part,
                text: [splitedStr[0], value].join(':'),
                cssClasses: [`${nodeRole}-meta-label`],
                minZoomLevel: 0.4
            } as SLabel & MetadataLabel
        })
    } as SCompartment;
}

export function buildMetaLabels(
    opId: string,
    labelParts: string[],
    subgraphId: number,
    opmagic: string
): any {
    const compartment: any = {
        type: 'compartment',
        id: `${opId}-main-labels-compartment`,
        layout: 'vbox',
        text: '',
        magic: opmagic,
        subgraphId: subgraphId,
        layoutOptions: {
            hAlign: 'left',
            vGap: 3,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0
        },
        children: []
    };

    for (let metaIdx = 0; metaIdx < labelParts.length; metaIdx++) {
        const splitedStr = labelParts[metaIdx].split(':');
        let value = splitedStr[1] ?? '';
        if (value.length > 32) {
            value = value.slice(0, 32) + '...';
        }
        compartment.children.push({
            type: 'label',
            id: `${opId}-label-meta-${metaIdx}`,
            originText: labelParts[metaIdx],
            text: [splitedStr[0] ?? '', value].join(':'),
            cssClasses: ['operation-meta-label'],
            layoutOptions: {
                hAlign: 'left',
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0
            },
            minZoomLevel: 0.4
        } as SLabel & MetadataLabel);
    }
    return compartment;
}

export function buildCallLabels(
    opId: string,
    labelParts: string[],
    subgraphId: number,
    opmagic: string
): any {
    const compartment: any = {
        type: 'compartment',
        id: `${opId}-main-labels-compartment`,
        layout: 'vbox',
        text: '',
        magic: opmagic,
        subgraphId: subgraphId,
        layoutOptions: {
            hAlign: 'left',
            vGap: 5,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 40
        },
        children: []
    };

    for (let metaIdx = 0; metaIdx < labelParts.length; metaIdx++) {
        const splitedStr = labelParts[metaIdx].split(':');
        let value = splitedStr[1] ?? '';
        if (value.length > 32) {
            value = value.slice(0, 32) + '...';
        }
        compartment.children.push({
            type: 'label',
            id: `${opId}-label-meta-${metaIdx}`,
            originText: labelParts[metaIdx],
            text: [splitedStr[0] ?? '', value].join(':'),
            cssClasses: ['operation-meta-label'],
            layoutOptions: {
                hAlign: 'left',
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0
            },
            minZoomLevel: 0.4
        });
    }
    return compartment;
}

export function getCodePath(op: Operation): string | undefined {
    return (op.file && op.file !== '' ? op.file : undefined) ??
           (op.semantic_label?.filename && op.semantic_label?.filename !== '' ? op.semantic_label?.filename : undefined);
}

export function getCodeLine(op: Operation): number | undefined {
    const lineNum = op.line && op.line !== '' ? parseInt(op.line, 10) : undefined;
    return (lineNum !== undefined && !isNaN(lineNum) ? lineNum : undefined) ??
           (op.semantic_label?.lineno && op.semantic_label?.lineno >= 0 ? op.semantic_label?.lineno : undefined);
}

export function extractNestedData(funcData: FunctionData): FunctionData {
    // Check if data is nested under functions array
    if (funcData.functions && Array.isArray(funcData.functions) && funcData.functions.length > 0) {
        return funcData.functions[0];
    }

    // Try to find a property that contains the expected structure
    const keys = Object.keys(funcData) as (keyof FunctionData)[];
    for (const key of keys) {
        const value = funcData[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const nestedData = value as FunctionData;
            if (hasValidStructure(nestedData)) {
                return nestedData;
            }
        }
    }

    return funcData;
}

export function createSyncControlFlowEdges(actualData: FunctionData, nodes: SNode[], edges: SEdge[]): void {
    if (!actualData.operations || !Array.isArray(actualData.operations)) {
        return;
    }

    // Group sync operations by pipe_id and trig_pipe
    const syncOps: { [key: string]: OpReference[] } = {};
    const phaseOps: OpReference[] = [];
    const computationalOps: OpReference[] = [];

    for (let opIndex = 0; opIndex < actualData.operations.length; opIndex++) {
        const op = actualData.operations[opIndex];
        if (['SYNC_SRC', 'SYNC_DST', 'BAR.V'].includes(op.opcode)) {
            const syncQueue = op.sync_queue || {};
            const pipeId = syncQueue.pipe_id || 0;
            const trigPipe = syncQueue.trig_pipe || 0;
            const key = `pipe-${pipeId}-trig-${trigPipe}`;

            if (!syncOps[key]) {
                syncOps[key] = [];
            }
            syncOps[key].push({ index: opIndex, op });
        } else if (['PHASE1', 'PHASE2'].includes(op.opcode)) {
            // Track phase operations for sequential control flow
            phaseOps.push({ index: opIndex, op });
        } else if (op.subgraphid && op.subgraphid !== -1) {
            // Track computational operations that have actual work
            computationalOps.push({ index: opIndex, op });
        }
    }

    // Create control flow edges between related sync operations
    for (const [key, ops] of Object.entries(syncOps)) {
        if (ops.length >= 2) {
            // Sort by operation index to get execution order
            ops.sort((a, b) => a.index - b.index);

            // Create edges between consecutive sync operations in the same pipeline
            for (let i = 0; i < ops.length - 1; i++) {
                const srcOp = ops[i];
                const tgtOp = ops[i + 1];

                const srcId = `operation-${srcOp.index}-magic-${srcOp.op.opmagic}`;
                const tgtId = `operation-${tgtOp.index}-magic-${tgtOp.op.opmagic}`;

                edges.push({
                    type: 'edge:control',
                    id: `control-flow-${key}-${srcOp.index}-to-${tgtOp.index}`,
                    sourceId: srcId,
                    targetId: tgtId
                });
            }
        }
    }

    // Create sequential control flow edges for phase operations
    if (phaseOps.length >= 2) {
        // Sort phase operations by index to get execution order
        phaseOps.sort((a, b) => a.index - b.index);

        // Create edges between consecutive phase operations
        for (let i = 0; i < phaseOps.length - 1; i++) {
            const srcPhase = phaseOps[i];
            const tgtPhase = phaseOps[i + 1];

            const srcId = `operation-${srcPhase.index}-magic-${srcPhase.op.opmagic}`;
            const tgtId = `operation-${tgtPhase.index}-magic-${tgtPhase.op.opmagic}`;

            edges.push({
                type: 'edge:control',
                id: `phase-flow-${srcPhase.index}-to-${tgtPhase.index}`,
                sourceId: srcId,
                targetId: tgtId
            });
        }
    }

    // Create coordination edges between sync operations and computational operations
    createSyncCoordinationEdges(actualData, syncOps, computationalOps, edges);

    // Create coordination edges between phase operations and computational operations
    createPhaseCoordinationEdges(phaseOps, computationalOps, edges);
}

/**
 * Creates coordination edges between sync operations and computational operations
 */
export function createSyncCoordinationEdges(
    actualData: FunctionData,
    syncOps: { [key: string]: OpReference[] },
    computationalOps: OpReference[],
    edges: SEdge[]
): void {
    // For each computational operation, find nearby sync operations that coordinate it
    for (const compOp of computationalOps) {
        const compOpId = `operation-${compOp.index}-magic-${compOp.op.opmagic}`;

        // Find sync operations that occur just before and after this computational operation
        const beforeSyncOps: OpReference[] = [];
        const afterSyncOps: OpReference[] = [];

        // Look for sync operations in a reasonable range before and after this operation
        for (const syncOpList of Object.values(syncOps)) {
            for (const syncOp of syncOpList) {
                const distance = Math.abs(syncOp.index - compOp.index);

                // Only consider sync operations that are close to this computational operation
                if (distance <= 5) { // Adjust this threshold as needed
                    if (syncOp.index < compOp.index) {
                        beforeSyncOps.push(syncOp);
                    } else if (syncOp.index > compOp.index) {
                        afterSyncOps.push(syncOp);
                    }
                }
            }
        }

        // Connect the closest preceding sync operation to this computational operation
        if (beforeSyncOps.length > 0) {
            const closestBefore = beforeSyncOps.reduce((closest, current) =>
                (compOp.index - current.index) < (compOp.index - closest.index) ? current : closest
            );
            const beforeSyncId = `operation-${closestBefore.index}-magic-${closestBefore.op.opmagic}`;

            edges.push({
                type: 'edge:control',
                id: `sync-coord-before-${closestBefore.index}-to-${compOp.index}`,
                sourceId: beforeSyncId,
                targetId: compOpId
            });
        }

        // Connect this computational operation to the closest following sync operation
        if (afterSyncOps.length > 0) {
            const closestAfter = afterSyncOps.reduce((closest, current) =>
                (current.index - compOp.index) < (closest.index - compOp.index) ? current : closest
            );
            const afterSyncId = `operation-${closestAfter.index}-magic-${closestAfter.op.opmagic}`;

            edges.push({
                type: 'edge:control',
                id: `sync-coord-after-${compOp.index}-to-${closestAfter.index}`,
                sourceId: compOpId,
                targetId: afterSyncId
            });
        }
    }
}

/**
 * Creates coordination edges between phase operations and computational operations
 */
export function createPhaseCoordinationEdges(
    phaseOps: OpReference[],
    computationalOps: OpReference[],
    edges: SEdge[]
): void {
    if (phaseOps.length === 0) {
        return;
    }

    // Sort phase operations by index
    phaseOps.sort((a, b) => a.index - b.index);

    // For each phase transition, connect to nearby computational operations
    for (let i = 0; i < phaseOps.length; i++) {
        const phaseOp = phaseOps[i];
        const phaseOpId = `operation-${phaseOp.index}-magic-${phaseOp.op.opmagic}`;

        // Find computational operations that occur after this phase marker
        // and before the next phase marker (if any)
        const nextPhaseIndex = i + 1 < phaseOps.length ? phaseOps[i + 1].index : Number.MAX_SAFE_INTEGER;

        // Since PHASE operators are global coordination points (subgraphid: -1),
        // they coordinate with computational operations across all subgraphs
        const associatedCompOps = computationalOps.filter(compOp =>
            compOp.index > phaseOp.index && compOp.index < nextPhaseIndex &&
            hasSameCoordinationScope(phaseOp.op, compOp.op)
        );

        // Connect phase marker to the first computational operations in this phase
        const firstCompOps = associatedCompOps
            .filter(compOp => compOp.index - phaseOp.index <= 5) // Only operations close to the phase marker
            .sort((a, b) => a.index - b.index)
            .slice(0, 3); // Limit to first 3 operations to avoid visual clutter

        for (const compOp of firstCompOps) {
            const compOpId = `operation-${compOp.index}-magic-${compOp.op.opmagic}`;

            edges.push({
                type: 'edge:control',
                id: `phase-coord-${phaseOp.index}-to-${compOp.index}`,
                sourceId: phaseOpId,
                targetId: compOpId
            });
        }

        // Also connect from the last computational operations in the previous phase to this phase marker
        if (i > 0) {
            const prevPhaseIndex = phaseOps[i - 1].index;
            const prevPhaseCompOps = computationalOps.filter(compOp =>
                compOp.index > prevPhaseIndex && compOp.index < phaseOp.index &&
                hasSameCoordinationScope(phaseOp.op, compOp.op)
            );

            const lastCompOps = prevPhaseCompOps
                .filter(compOp => phaseOp.index - compOp.index <= 5) // Only operations close to the phase marker
                .sort((a, b) => b.index - a.index) // Sort in descending order
                .slice(0, 3); // Limit to last 3 operations

            for (const compOp of lastCompOps) {
                const compOpId = `operation-${compOp.index}-magic-${compOp.op.opmagic}`;

                edges.push({
                    type: 'edge:control',
                    id: `phase-coord-${compOp.index}-to-${phaseOp.index}`,
                    sourceId: compOpId,
                    targetId: phaseOpId
                });
            }
        }
    }
}

export function buildTensorNodeObject(
    nodeId: string,
    tensor: Tensor,
    tensorMagic: string,
    symbol: string,
    graphId: number,
    colors: { baseColor: string; lightColor: string },
    labelParts: string[],
    inputPort: AstgrPort,
    outputPort: AstgrPort
): AstgrTensorNode {
    return {
        type: 'node:tensor',
        role: 'tensor',
        compareType: tensor.compareType!,
        semanticLabel: tensor.semantic_label?.label ?? '',
        id: nodeId,
        magic: `${tensor.magic}`,
        subgraphId: graphId,
        baseColor: colors.baseColor,
        lightColor: colors.lightColor,
        layout: 'vbox',
        layoutOptions: {
            hAlign: 'left',
            paddingTop: 4,
            paddingBottom: 0,
            paddingLeft: 5,
            paddingRight: 6
        },
        children: [
            // Parent compartment containing all labels
            {
                type: 'compartment',
                id: `${nodeId}-labels-compartment`,
                layout: 'vbox',
                layoutOptions: {
                    hAlign: 'center',
                    vAlign: 'center',
                    vGap: 10,
                    paddingRight: 30
                },
                cssClasses: ['tensor-labels-compartment'],
                children: [
                    // Main label with larger font for tensor symbol
                    {
                        type: 'label',
                        id: `${nodeId}-label-main`,
                        text: symbol,
                        magic: `${tensor.magic}`,
                        subgraphId: graphId,
                        cssClasses: ['tensor-main-label'],
                        layoutOptions: {
                            hAlign: 'left',
                            paddingTop: 0,
                            paddingBottom: 0,
                            paddingLeft: 0,
                            paddingRight: 0
                        },
                    } as SLabel
                    ,
                    // Metadata compartment with individual labels
                    ...(labelParts.length > 0 ? [buildTensorMetadataCompartment(nodeId, labelParts)] : [])
                ]
            } as SCompartment,
            inputPort,
            outputPort
        ]
    };
}

export function buildTensorNodesObject(
    nodeId: string,
    tensor: Tensor,
    tensorMagic: string,
    symbol: string,
    graphId: number,
    colors: { baseColor: string; lightColor: string },
    isError: boolean,
    labelParts: string[],
    inputPort: AstgrPort,
    outputPort: AstgrPort
): AstgrTensorNode {
    return {
        type: 'node:tensor',
        role: 'tensor',
        compareType: tensor.compareType,
        semanticLabel: tensor.semantic_label?.label ?? '',
        id: nodeId,
        magic: `${tensor.magic}`,
        subgraphId: graphId,
        baseColor: colors.baseColor,
        lightColor: colors.lightColor,
        isError: isError,
        layout: 'vbox',
        layoutOptions: {
            hAlign: 'left',
            paddingTop: 4,
            paddingBottom: 0,
            paddingLeft: 5,
            paddingRight: 6
        },
        children: [
            // Parent compartment containing all labels
            {
                type: 'compartment',
                id: `${nodeId}-labels-compartment`,
                layout: 'vbox',
                layoutOptions: {
                    hAlign: 'center',
                    vAlign: 'center',
                    vGap: 10,
                    paddingRight: 30
                },
                cssClasses: ['tensor-labels-compartment'],
                children: [
                    // Main label with larger font for tensor symbol
                    {
                        type: 'label',
                        id: `${nodeId}-label-main`,
                        text: symbol,
                        magic: `${tensor.magic}`,
                        subgraphId: graphId,
                        cssClasses: ['tensor-main-label'],
                        layoutOptions: {
                            hAlign: 'left',
                            paddingTop: 0,
                            paddingBottom: 0,
                            paddingLeft: 0,
                            paddingRight: 0
                        },
                    } as SLabel
                    ,
                    // Metadata compartment with individual labels
                    ...(labelParts.length > 0 ? [buildTensorMetadataCompartment(nodeId, labelParts)] : [])
                ]
            } as SCompartment,
            inputPort,
            outputPort
        ]
    };
}

export function extractTensorMagicFromPortId(portId: string | undefined): string | undefined {
    if (!portId) {
        return undefined;
    }
    const match = portId.match(/^tensor-(\d+)/);
    return match ? match[1] : undefined;
}

function isEdgeConnectedToEmptyOutput(edge: SEdge, emptyOutputSet: Set<string>): boolean {
    const sourceTensorMagic = extractTensorMagicFromPortId(edge.sourceId);
    if (sourceTensorMagic !== undefined && emptyOutputSet.has(sourceTensorMagic)) {
        return true;
    }
    const targetTensorMagic = extractTensorMagicFromPortId(edge.targetId);
    return targetTensorMagic !== undefined && emptyOutputSet.has(targetTensorMagic);
}

export function markEmptyNodeEdgesAsDashed(edges: SEdge[], emptyOutputSet: Set<string>): void {
    for (const edge of edges) {
        if (isEdgeConnectedToEmptyOutput(edge, emptyOutputSet)) {
            (edge as any).cssClasses = ['dashed-edge'];
        }
    }
}

function isCopyOutOrAssembleOp(op: Operation): boolean {
    return op.opcode === 'COPY_OUT' || op.opcode === 'ASSEMBLE';
}

function shouldCreateEmptyNodeForOp(op: Operation | undefined): op is Operation {
    if (!op) {
        return false;
    }
    if (!isCopyOutOrAssembleOp(op)) {
        return false;
    }
    return !!(op.ooperands && Array.isArray(op.ooperands));
}

export function createEmptyNodesForSearch(
    actualData: FunctionData,
    nodes: SNode[],
    edges: SEdge[],
    showTensorNodes: boolean,
    tensorToRawTensorMap: Map<string, string>,
    rawTensorConsumers: Map<string, PortReference[]>,
    pathNodesSet: Set<string>,
    opListMap: Map<string, number>,
    outcastUnique: Set<string>,
    tensorNodeMap: Map<string, { nodeId: string }>,
    emptyOutputSet: Set<string>,
    emptyNodesList: Set<string>
): void {
    if (!actualData.operations || !Array.isArray(actualData.operations)) {
        return;
    }
    for (const opMagic of pathNodesSet) {
        const opIndex = opListMap.get(opMagic);
        if (opIndex === undefined) {
            continue;
        }
        const op = actualData.operations[opIndex];
        if (!shouldCreateEmptyNodeForOp(op)) {
            continue;
        }
        createEmptyNodesForSingleOp(op, nodes, edges, showTensorNodes, tensorToRawTensorMap, rawTensorConsumers,
            outcastUnique, tensorNodeMap, emptyOutputSet, emptyNodesList);
    }
    markEmptyNodeEdgesAsDashed(edges, emptyOutputSet);
}

function createEdgeForEmptyNode(
    opId: string,
    portId: string,
    tensorMagic: string,
    callTargetId: string | undefined,
    emptyOutputSet: Set<string>,
    edges: SEdge[]
): void {
    const targetId = callTargetId ? callTargetId : `tensor-${tensorMagic}-0-in`;
    edges.push({
        type: 'edge',
        id: `edge-${opId}-to-${tensorMagic}-empty`,
        sourceId: portId,
        targetId,
        ...(!emptyOutputSet.has(tensorMagic) ? {} : { cssClasses: ['dashed-edge'] })
    });
}

function registerEmptyNodeConsumer(
    tensorMagic: string,
    portId: string,
    tensorToRawTensorMap: Map<string, string>,
    rawTensorConsumers: Map<string, PortReference[]>,
    emptyNodesList: Set<string>
): void {
    const rawTensorId = tensorToRawTensorMap.get(tensorMagic);
    if (!rawTensorId) {
        return;
    }
    const emptyNodeId = `tensor-${tensorMagic}-0`;
    const emptyPortId = `tensor-${tensorMagic}-0-in`;
    if (!rawTensorConsumers.has(rawTensorId)) {
        rawTensorConsumers.set(rawTensorId, []);
    }
    rawTensorConsumers.get(rawTensorId)!.push({ nodeId: emptyNodeId, portId: emptyPortId });
    emptyNodesList.add(portId);
}

function processEmptyNodeForTensor(
    opId: string,
    portId: string,
    tensorMagic: string,
    showTensorNodes: boolean,
    tensorToRawTensorMap: Map<string, string>,
    rawTensorConsumers: Map<string, PortReference[]>,
    tensorNodeMap: Map<string, { nodeId: string }>,
    emptyOutputSet: Set<string>,
    emptyNodesList: Set<string>,
    nodes: SNode[],
    edges: SEdge[]
): void {
    let callTargetId: string | undefined;
    if (showTensorNodes) {
        const tensorNodeId = tensorNodeMap.get(tensorMagic)?.nodeId;
        callTargetId = tensorNodeId ? `${tensorNodeId}-in` : undefined;
    }

    const emptyNode: AstgrNode = createEmptyNodeWithPort(
        callTargetId ? callTargetId : `tensor-${tensorMagic}-0-in`,
        tensorMagic
    );
    nodes.push(emptyNode);

    if (showTensorNodes) {
        createEdgeForEmptyNode(opId, portId, tensorMagic, callTargetId, emptyOutputSet, edges);
    } else {
        registerEmptyNodeConsumer(tensorMagic, portId, tensorToRawTensorMap, rawTensorConsumers, emptyNodesList);
    }

    emptyOutputSet.add(tensorMagic);
}

function createEmptyNodesForSingleOp(
    op: Operation,
    nodes: SNode[],
    edges: SEdge[],
    showTensorNodes: boolean,
    tensorToRawTensorMap: Map<string, string>,
    rawTensorConsumers: Map<string, PortReference[]>,
    outcastUnique: Set<string>,
    tensorNodeMap: Map<string, { nodeId: string }>,
    emptyOutputSet: Set<string>,
    emptyNodesList: Set<string>
): void {
    const subgraphId = op.subgraphid !== undefined ? op.subgraphid : -1;
    const opId = `operation-magic-${op.opmagic}-${subgraphId}`;
    const portId = `${opId}-out`;

    for (const oop of [...new Set(op.ooperands)]) {
        const tensorMagic = String(oop);
        if (outcastUnique.has(tensorMagic)) {
            continue;
        }
        processEmptyNodeForTensor(opId, portId, tensorMagic, showTensorNodes, tensorToRawTensorMap,
            rawTensorConsumers, tensorNodeMap, emptyOutputSet, emptyNodesList, nodes, edges);
        outcastUnique.add(tensorMagic);
    }
}