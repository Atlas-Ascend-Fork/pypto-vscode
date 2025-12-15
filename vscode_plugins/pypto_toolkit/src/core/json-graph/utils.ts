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
export function parseCopyOp(labelAttr: string[], reader: AttrReader, isCopyOut: boolean, version: string): void {
    reader.readNumber(); // skip isCopyOut flag (already known from opcode)
    const memType = reader.readNumber();
    const memTypeStr = MEMTYPE_MAP[memType] || 'MEM_UNKNOWN';

    const offsetSize = reader.readNumber();
    const offset = parseSymbolicOrIntList(reader, offsetSize, version);
    const shape = parseSymbolicOrIntList(reader, offsetSize, version);

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
export function parseConvertOp(labelAttr: string[], reader: AttrReader): void {
    const fromMemType = reader.readNumber();
    const toMemType = reader.readNumber();

    const fromStr = MEMTYPE_MAP[fromMemType] || 'MEM_UNKNOWN';
    const toStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

    labelAttr.push(`from: ${fromStr}`);
    labelAttr.push(`to: ${toStr}`);
}

// 处理 assemble/view 操作
export function parseAssembleViewOp(labelAttr: string[], reader: AttrReader, isAssemble: boolean, version: string): void {
    const toMemType = reader.readNumber();
    const toMemStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

    const offsetSize = reader.readNumber();
    const offset: number[] = [];
    for (let i = 0; i < offsetSize; i++) {
        offset.push(reader.readNumber());
    }

    const dynOffsetSize = reader.readNumber();
    const dynOffsetParse = parseExprList(reader, dynOffsetSize, version);

    const dynShapeSize = reader.readNumber();
    const dynShapeParse = parseExprList(reader, dynShapeSize, version);

    labelAttr.push(`shape: [${dynShapeParse.join(',')}]`);
    if (isAssemble) {
        labelAttr.push(`from: ${toMemStr}`);
        labelAttr.push(`to offset: [${offset.join(',')}]`);
    } else {
        labelAttr.push(`from offset: [${offset.join(',')}]`);
        labelAttr.push(`to: ${toMemStr}`);
    }
}