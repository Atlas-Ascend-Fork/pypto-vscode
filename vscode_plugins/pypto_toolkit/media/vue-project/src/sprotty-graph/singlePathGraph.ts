import { SEdge, SLabel, SModelRoot, SNode, SPort, SCompartment } from 'sprotty-protocol';
import { AttrReader, parseSymbolicOrIntList, parseExprList } from './parseSymbolicAttr';
import { comGraphStore } from '../service/com-graph-store';
import { generateColorList, getLighterColorByHex } from '../utils/color-list';

/* Extended SModelRoot with custom properties
*/
export interface ExtendedSModelRoot extends SModelRoot {
   colorBySubgraph?: boolean;
   filterSubgraphId?: number;
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
}

/**
 * Tensor node interface
 */
export interface AstgrTensorNode extends AstgrNode {
    type: 'node:tensor';
}

/**
 * Port reference for graph connections
 */
interface PortReference {
    nodeId: string;
    portId: string;
}

/**
 * Operation data structure
 */
interface Operation {
    kind: number;
    opmagic: number;
    opcode: string;
    ioperands: number[];
    ooperands: number[];
    semantic_label: string[];
    subgraphid?: number;
    calleehash?: string;
    sync_queue?: SyncQueue;
    latency?: number;
    offset?: number[];
    attr?: (number | (number | string)[])[];
}


/**
 * Function data structure containing all graph elements
 */
interface FunctionData {
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
 * Raw tensor data structure
 */
interface RawTensor {
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
interface Tensor {
    magic: number;
    rawtensor: any;
    offset: number[];
    nodetype: number;
    format: number;
    shape: number[];
    kind: number;
    validshape?: number[];
    dynvalidshape?: number[];
    semanticlabel?: string;
    mem_type?: {[key: string]: number};
    subgraphid?: number;
}

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
const DATATYPE_MAP: { [key: number]: string } = {
    0: 'int4', 1: 'int8', 2: 'int16', 3: 'int32', 
    4: 'int64', 5: 'fp8', 6: 'fp16', 7: 'fp32',
    8: 'bf16', 9: 'hf4', 10: 'hf8', 11: 'uint8',
    12: 'uint16', 13: 'uint32', 14: 'uint64', 15: 'bool',
    16: 'double'
};

interface TensorRowTensorItems {
    tensor: Tensor;
    rawTensor: RawTensor;
}

interface CallInOutItems {
    inTensors: TensorRowTensorItems[];
    outTensors: TensorRowTensorItems[];
}

export class singlePathDagBuilder {
    /*
    *   Node coloring data
    */
    opListMap = new Map<string, number>();
    tensorListMap = new Map<string, number>();
    op2CastMap = new Map<string, Map<string, number[]>>(); // opMagic, incast: tensorMagic, outcast: tensorMagic
    tensor2opMap = new Map<string, {inOp: Set<string>; outOp: Set<string>}>(); // opMagic, incast: tensorMagic, outcast: tensorMagic
    tensorMap = new Map<string, { nodeId: string }>();
    opIdMap = new Map<string, string>();
    baseColorList: string[];
    lightColorList: string[];
    nodeSet = new Set<string> ();
    isErrorReport = false;
    callInOutMap = new Map<string, CallInOutItems>();

    private initializeDataStructures() {
        return {
            nodes: [] as SNode[],
            edges: [] as SEdge[],
            // tensorMap: new Map<string, { nodeId: string }>(),
            portMap: new Map<string, PortReference>(),
            rawTensorProducers: new Map<string, PortReference[]>(),
            rawTensorConsumers: new Map<string, PortReference[]>()
        };
    }

    public createNodeListMap(funcData: FunctionData) {
        let actualData = funcData;
        
        // 存4个map？
        // 1、op2cast： opmagic : {'incast': [], 'outcast': []}
        // 2、tensor2Op： tensorMagic : {'inOp': [], 'outOp': []}
        // 3、incastMap: tensorMagic : outOp 如果空 就set ，如果非空就add
        // 4、outcastMap: tensorMagic: inOp
        // 错误的
        // 就2个map
        // 先tensor创建tensor2opMap
        // 然后op补全tensor2opMap和op2CastMap
        for (let tensorIndex = 0; tensorIndex < actualData.tensors.length; tensorIndex++) {
            const tensormagic = actualData.tensors[tensorIndex].magic.toString();
            const graphId = actualData.tensors[tensorIndex].subgraphid ?? -1;
            this.tensorListMap.set(tensormagic, tensorIndex);
            let nodeId = `tensor-${tensormagic}-${graphId}`;
            this.tensorMap.set(tensormagic, { nodeId });

            if(this.tensor2opMap.get(tensormagic)){
                this.tensor2opMap.set(tensormagic, {inOp: new Set<string>(), outOp: new Set<string>()});
            }
        }
        for (let opIndex = 0; opIndex < actualData.operations.length; opIndex++) {
            const opmagic = actualData.operations[opIndex].opmagic.toString();
            const ioperands = actualData.operations[opIndex].ioperands;
            const ooperands = actualData.operations[opIndex].ooperands;
            this.opListMap.set(opmagic, opIndex);
            if(!this.op2CastMap.has(opmagic)) {
                this.op2CastMap.set(opmagic, new Map([['incast', [...ioperands]], ['outcast', [...ooperands]]]));
            }
            for( let node of ioperands) {
                if(!this.tensor2opMap.has(node.toString())) {
                    this.tensor2opMap.set(node.toString(), {inOp: new Set<string>(), outOp: new Set<string>()}); 
                }
                this.tensor2opMap.get(node.toString()).outOp.add(opmagic);
            }
            for( let node of ooperands) {
                if(!this.tensor2opMap.has(node.toString())) {
                    this.tensor2opMap.set(node.toString(), {inOp: new Set<string>(), outOp: new Set<string>()});
                }
                this.tensor2opMap.get(node.toString()).inOp.add(opmagic);
            }
        }
    }

    private createTensorMaps(actualData: FunctionData) {
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

    private getTensorCommonAttr(labelAttr: string[], tensor: Tensor, rawTensor: RawTensor) {
        // Add shape information
        if (tensor?.shape) {
            const shapeStr = `[${tensor.shape.join(',')}]`;
            labelAttr.push(`shape: ${shapeStr}`);
        } else {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get tensor (${tensor.magic}) shape information.`);
        }

        if (rawTensor?.rawshape) {
            const rawShapeStr = `[${rawTensor.rawshape.join(',')}]`;
            labelAttr.push(`rawshape: ${rawShapeStr}`);
        } else {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get raw tensor (${rawTensor.rawmagic}) raw shape information.`);
        }

        // Add offset information if available
        if (tensor?.offset && Array.isArray(tensor.offset) && tensor.offset.length > 0) {
            const offsetStr = `[${tensor.offset.join(',')}]`;
            labelAttr.push(`offset: ${offsetStr}`);
        } else {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get tensor(${tensor.magic}) offset.`);
        }

        if (tensor?.mem_type) {
            const asisTypeStr = MEMTYPE_MAP[tensor.mem_type.asis] || 'MEM_UNKNOWN';
            const tobeTypeStr = MEMTYPE_MAP[tensor.mem_type.tobe] || 'MEM_UNKNOWN';
            labelAttr.push(`asis: ${asisTypeStr}`);
            labelAttr.push(`tobe: ${tobeTypeStr}`);
        } else {
            labelAttr.push(`asis: 'MEM_UNKNOWN'`);
            labelAttr.push(`tobe: 'MEM_UNKNOWN'`);
        }

        // Add datatype information
        if (rawTensor?.datatype !== undefined) {
            const datatypeStr = DATATYPE_MAP[rawTensor.datatype] || `dt${rawTensor.datatype}`;
            labelAttr.push(`datatype: ${datatypeStr}`);
        } else {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get raw tensor(${rawTensor.rawmagic}) data type.`);
        }
    }

    /**
     * 处理 copy 类操作
     * 一行没改
     */
    private parseCopyOp(labelAttr: string[], reader: AttrReader, isCopyOut: boolean): void {
        reader.readNumber(); // skip isCopyOut flag (already known from opcode)
        const memType = reader.readNumber();
        const memTypeStr = MEMTYPE_MAP[memType] || 'MEM_UNKNOWN';

        const offsetSize = reader.readNumber();
        const offset = parseSymbolicOrIntList(reader, offsetSize);
        const shape = parseSymbolicOrIntList(reader, offsetSize);

        labelAttr.push(`shape: [${shape.join(',')}]`);
        if (isCopyOut) {
            labelAttr.push(`from: ${memTypeStr}`);
            labelAttr.push(`to offset: [${offset.join(',')}]`);
        } else {
            labelAttr.push(`from offset: [${offset.join(',')}]`);
            labelAttr.push(`to: ${memTypeStr}`);
        }
    }

    /**
     * 处理 convert 操作
     * 一行没改
     */
    private parseConvertOp(labelAttr: string[], reader: AttrReader): void {
        const fromMemType = reader.readNumber();
        const toMemType = reader.readNumber();

        const fromStr = MEMTYPE_MAP[fromMemType] || 'MEM_UNKNOWN';
        const toStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

        labelAttr.push(`from: ${fromStr}`);
        labelAttr.push(`to: ${toStr}`);
    }

    /**
     * 处理 assemble/view 操作
     * 一行没改
     */
    private parseAssembleViewOp(labelAttr: string[], reader: AttrReader, isAssemble: boolean): void {
        const toMemType = reader.readNumber();
        const toMemStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

        const offsetSize = reader.readNumber();
        const offset: number[] = [];
        for (let i = 0; i < offsetSize; i++) {
            offset.push(reader.readNumber());
        }

        const dynOffsetSize = reader.readNumber();
        const dynOffsetParse = parseExprList(reader, dynOffsetSize);

        const dynShapeSize = reader.readNumber();
        const dynShapeParse = parseExprList(reader, dynShapeSize);

        labelAttr.push(`shape: [${dynShapeParse.join(',')}]`);
        if (isAssemble) {
            labelAttr.push(`from: ${toMemStr}`);
            labelAttr.push(`to offset: [${offset.join(',')}]`);
        } else {
            labelAttr.push(`from offset: [${offset.join(',')}]`);
            labelAttr.push(`to: ${toMemStr}`);
        }
    }

    /**
     * Parse operation attr by op code and fill into label.
     * 一行没改
     */
    private parseOperationAttr(labelAttr: string[], op: Operation): void {
        const attr = op.attr;
        const opcodeStr = op.opcode.toLowerCase();
    
        if (!Array.isArray(attr) || attr.length < 1) {
            (window as any).ascEventBus.emit('jsonParseError', `The attribution of operation ${op.opcode} is invalid.`);
        }
    
        const reader = new AttrReader(attr);
    
        switch (opcodeStr) {
            case 'copy_in':
                this.parseCopyOp(labelAttr, reader, opcodeStr === 'copy_in');
                break;
            case 'copy_out':
                this.parseCopyOp(labelAttr, reader, opcodeStr === 'copy_out');
                break;
            case 'convert':
                this.parseConvertOp(labelAttr, reader);
                break;
            case 'assemble':
                this.parseAssembleViewOp(labelAttr, reader, opcodeStr === 'assemble');
                break;
            case 'view':
                this.parseAssembleViewOp(labelAttr, reader, opcodeStr === 'view');
                break;
            default:
                // 可选：处理未知 opcode
                break;
        }
    }

    public opSearchForward(
        startNode: string, 
        actualData: FunctionData, 
        nodes: SNode[], 
        edges: SEdge[], 
        portMap: Map<string, PortReference>, 
        tensorToRawTensorMap: Map<string, string>,
        rawTensorProducers: Map<string, PortReference[]>,
        rawTensorConsumers: Map<string, PortReference[]>,
        rawTensorMap: Map<string, RawTensor>,
        inoutMap: Map<string, Set<string>>,
        showTensorNodes: boolean
    ) {
        if (!actualData.operations || !Array.isArray(actualData.operations)) {
            return;
        }

        const opIndex = this.opListMap.get(startNode);
        const op = actualData.operations[opIndex];
        const opmagic = op.opmagic.toString();
        
        // DONE : 保证全图去重set
        const graphId = op?.subgraphid ?? -1;
        const opId = `operation-${opIndex}-magic-${opmagic}-${graphId}`;

        if (this.opIdMap.get(opmagic) !== opId) {
            this.createPorts(startNode, op, edges, tensorToRawTensorMap, rawTensorConsumers, rawTensorProducers, showTensorNodes);
            this.createRegularOperationNode(op, opId, nodes);
        }

        const ioperands = [...new Set(op.ioperands)];
        for (let incastNode of ioperands) {
            let tensorNodeId = this.tensorMap.get(incastNode.toString())?.nodeId;
            if (this.nodeSet.has(tensorNodeId)) {
                continue;
            }
            console.log("dxl test opSearchForward op magic", startNode);
            console.log("dxl test opSearchForward op.ioperands", op.ioperands);
            console.log("dxl test opSearchForward 2 tensorSearchForward");
            this.tensorSearchForward(String(incastNode), actualData, nodes, edges, portMap, 
                                     tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                     inoutMap, showTensorNodes);
        }
        // const ooperands = [...new Set(op.ooperands)];
        // for (let outcastNode of ooperands) {
        //     let tensorNodeId = this.tensorMap.get(outcastNode.toString())?.nodeId;
        //     if (this.nodeSet.has(tensorNodeId)) {
        //         continue;
        //     }
        //     console.log("dxl test opSearchForward op magic", startNode);
        //     console.log("dxl test opSearchForward op.ioperands", op.ioperands);
        //     console.log("dxl test opSearchForward 2 tensorSearchForward");
        //     this.tensorSearchBackward(String(outcastNode), actualData, nodes, edges, portMap, 
        //                               tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
        //                               inoutMap, showTensorNodes);
        // }
    }
    
    public opSearchBackward(        
        startNode: string, 
        actualData: FunctionData, 
        nodes: SNode[], 
        edges: SEdge[], 
        portMap: Map<string, PortReference>, 
        tensorToRawTensorMap: Map<string, string>,
        rawTensorProducers: Map<string, PortReference[]>,
        rawTensorConsumers: Map<string, PortReference[]>,
        rawTensorMap: Map<string, RawTensor>,
        inoutMap: Map<string, Set<string>>,
        showTensorNodes: boolean
    ) {
        if (!actualData.operations || !Array.isArray(actualData.operations)) {
            return;
        }

        const opIndex = (this.opListMap.get(startNode)) as unknown as number;
        const op = actualData.operations[opIndex];
        const opmagic = op.opmagic.toString();
        
        // DONE : 保证全图去重set
        const graphId = op?.subgraphid ?? -1;
        const opId = `operation-${opIndex}-magic-${opmagic}-${graphId}`;
        console.log("dxl test opSearchBackward this.opIdMap", this.opIdMap);

        if (this.opIdMap.get(opmagic) !== opId) {
            this.createPorts(startNode, op, edges, tensorToRawTensorMap, rawTensorConsumers, rawTensorProducers, showTensorNodes);
            this.createRegularOperationNode(op, opId, nodes);
        }

        // const ioperands = [...new Set(op.ioperands)];
        // for (let incastNode of ioperands) {
        //     let tensorNodeId = this.tensorMap.get(incastNode.toString())?.nodeId;
        //     if (this.nodeSet.has(tensorNodeId)) {
        //         continue;
        //     }
        //     console.log("dxl test opSearchBackward op magic", startNode);
        //     console.log("dxl test opSearchBackward op.ioperands", op.ioperands);
        //     console.log("dxl test opSearchBackward 2 tensorSearchForward");
        //     this.tensorSearchForward(String(incastNode), actualData, nodes, edges, portMap, 
        //                              tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
        //                              inoutMap, showTensorNodes);
        // }
        const ooperands = [...new Set(op.ooperands)];
        for (let outcastNode of ooperands) {
            let tensorNodeId = this.tensorMap.get(outcastNode.toString())?.nodeId;
            if (this.nodeSet.has(tensorNodeId)) {
                continue;
            }
            console.log("dxl test opSearchBackward op magic", startNode);
            console.log("dxl test opSearchBackward op.ooperands", op.ooperands);
            console.log("dxl test opSearchBackward 2 tensorSearchBackward");
            this.tensorSearchBackward(String(outcastNode), actualData, nodes, edges, portMap, 
                                      tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                      inoutMap, showTensorNodes);
        }
    }

    /**
     * Creates a Sprotty graph model from function data
     * @param funcData - The function data containing operations, tensors, etc.
     * @param showTensorNodes - Whether to show tensor nodes in the graph
     * @param showSyncNodes - Whether to show synchronization nodes in the graph
     * @param colorBySubgraph - Whether to color nodes by subgraph
     * @param filterSubgraphId - Filter to show only nodes from specific subgraph (undefined = show all)
     * @returns The Sprotty graph model
     */
    public createSinglePathGraph(startNode: string, funcData: FunctionData, showTensorNodes: boolean = true, isDark = true, colorBySubgraph: boolean = false, filterSubgraphId?: number) {
        const colorList = generateColorList(360, isDark);
        this.baseColorList = colorList.baseColorList;
        this.lightColorList = colorList.lightColorList;

        let actualData = funcData;
        if (!this.hasValidStructure(funcData)) {
            actualData = this.extractNestedData(funcData);
        }
        this.createNodeListMap(actualData);

        const { nodes, edges, portMap, rawTensorProducers, rawTensorConsumers} = this.initializeDataStructures();
        const { rawTensorMap, magicToTensorMap, tensorToRawTensorMap, inoutMap } = this.createTensorMaps(actualData);

        console.log("dxl test createSinglePathGraph tensor2opMap ",  this.tensor2opMap)
        console.log("dxl test createSinglePathGraph tensorListMap ",  this.tensorListMap)

        if(this.opListMap.has(startNode)) {
            // tensorType = 'operation';
            this.opSearchForward(startNode, actualData, nodes, edges, 
                                 portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, 
                                 rawTensorMap, inoutMap, showTensorNodes);
            this.opSearchBackward(startNode, actualData, nodes, edges, 
                                  portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, 
                                  rawTensorMap, inoutMap, showTensorNodes);
        } else {
            // tensorType = 'tensor';
            this.tensorSearchForward(startNode, actualData, nodes, edges, portMap, 
                                     tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                     inoutMap, showTensorNodes);
            this.tensorSearchBackward(startNode, actualData, nodes, edges, portMap, 
                                      tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                      inoutMap, showTensorNodes);
        }

        //record call input output nodes
        this.createCallInOutTensorMap(actualData, rawTensorMap, magicToTensorMap);

        console.log("dxl test createSinglePathGraph nodes ", nodes)
        console.log("dxl test createSinglePathGraph edges ", edges)
        console.log("dxl test createSinglePathGraph edges ", portMap)

        // Create fan-out connections when tensor nodes are hidden
        if (!showTensorNodes) {
            for (const [rawTensorId, producers] of rawTensorProducers.entries()) {
                const consumers = rawTensorConsumers.get(rawTensorId) || [];
                
                // Connect each producer to each consumer (fan-out)
                for (let prodIndex = 0; prodIndex < producers.length; prodIndex++) {
                    const producer = producers[prodIndex];
                    for (let consIndex = 0; consIndex < consumers.length; consIndex++) {
                        const consumer = consumers[consIndex];
                        edges.push({
                            type: 'edge',
                            id: `edge-fanout-${rawTensorId}-prod${prodIndex}-${producer.portId}-to-cons${consIndex}-${consumer.portId}`,
                            sourceId: producer.portId,
                            targetId: consumer.portId
                        });
                    }
                }
            }
        }

        // Apply subgraph filtering if specified
        let filteredNodes = nodes;
        let filteredEdges = edges;

        if (filterSubgraphId !== undefined) {
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
        }

        return {
            type: 'graph',
            id: 'root',
            children: [...filteredEdges, ...filteredNodes],
            colorBySubgraph, // Add the flag to the root model
            filterSubgraphId // Add the filter setting to the root model
        };
    }

    /**
     * Checks if the function data has a valid structure
     */
    private hasValidStructure(funcData: FunctionData): boolean {
        return !!(funcData.rawtensors || funcData.tensors || funcData.operations);
    }

    /**
     * Extracts nested data from the function data structure
     */
    private extractNestedData(funcData: FunctionData): FunctionData {
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
                if (this.hasValidStructure(nestedData)) {
                    return nestedData;
                }
            }
        }
        
        return funcData;
    }

    private createCallInOutTensorMap(
        actualData: FunctionData,
        rawTensorMap: Map<string, RawTensor>,
        magicToTensorMap: Map<string, Tensor>,
    ):void {
        if (!actualData.operations || !Array.isArray(actualData.operations)) {
            return;
        }

        for (let opIndex = 0; opIndex < actualData.operations.length; opIndex++) {
            const op = actualData.operations[opIndex];
            if (op.opcode === 'CALL') {
                let callInOutTensor: CallInOutItems = {
                    inTensors: [],
                    outTensors: []
                };
                for (const v of op.ioperands) {
                    const tensor = magicToTensorMap.get(String(v));
                    if (!tensor) {
                        continue;
                    }
                    const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
                    callInOutTensor.inTensors.push({tensor, rawTensor});
                }
                for (const v of op.ooperands) {
                    const tensor = magicToTensorMap.get(String(v));
                    if (!tensor) {
                        continue;
                    }
                    const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
                    callInOutTensor.outTensors.push({tensor, rawTensor});
                }
                this.callInOutMap.set(op.calleehash, callInOutTensor);
            }
        }

        const dataObj = Object.fromEntries(this.callInOutMap.entries());
        vscode.postMessage({
            command:'callInOutTensorMap',
            paramObj: dataObj,
        });
    }

    /**
     * Creates a regular op node
     * 这个函数, 现在没有连边逻辑
     */
    private createRegularOperationNode(
        op: Operation,
        opId: string,
        nodes: SNode[],
    ): void {
        // Extract additional information from the operation
        const subgraphId = op.subgraphid !== undefined ? op.subgraphid : -1;
        if (op.opmagic === undefined || typeof op.opmagic !== 'number') {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get operation ${op.opcode} magic.`);
        }

        const opmagic = String(op.opmagic);
        const hasAttrValue = op.attr !== undefined && (Array.isArray(op.attr) && op.attr.length > 0)? true : false;
        let opName = op.opcode === 'CALL'? 'CALL: ' : `TILE_${op.opcode}`;
        const children: (SCompartment | AstgrPort)[] = [];
        // opId = opId + `-${subgraphId}`;
        if (op.opcode === 'CALL') {
            let funcName = undefined;
            if ('calleeMap' in comGraphStore.data && op.calleehash in comGraphStore.data.calleeMap) {
                funcName = comGraphStore.data.calleeMap[op.calleehash].func_magicname;
            }
            opName += funcName ?? "Not found function";
        }
        const codePath = op.file;
        const codeLine = op.line;

        // Create labels compartment containing main and metadata labels
        const labelChildren: SLabel[] = [
            // Main label with larger font for operation name
            {
                type: 'label',
                id: `${opId}-label-main`,
                text: opName,
                magic: opmagic,
                subgraphId: subgraphId,
                cssClasses: ['operation-main-label'],
                layoutOptions: {
                    hAlign: 'left',
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    paddingRight: 20
                }
            } as SLabel
        ];

        let baseColor = subgraphId >= 0 ? this.baseColorList[subgraphId % 360] : `var(--devui-op-node-base-color)`;
        let lightColor = subgraphId >= 0 ? this.lightColorList[subgraphId % 360] : `var(--devui-op-node-light-color)`;
        try {
            const userColor = comGraphStore.data.operationColorFunc && comGraphStore.data.operationColorFunc(op, this.baseColorList);
            if (userColor) {
                baseColor = userColor;
                lightColor = getLighterColorByHex(baseColor);
            }
        } catch (error) {
            console.error(`Need to use default color, because ${error}`);
        }
        
        const labelParts: string[] = [];
        try {
            const result = comGraphStore.data.operationAttrFunc && comGraphStore.data.operationAttrFunc(op);
            if (result) {
                labelParts.push(...result);
            }
        } catch (error) {
            console.error(`User define is invalid, ${error}`);
        }

        const notCallChildren: any = {
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
                    paddingRight: 50
            },
            children: []
        }
        if (labelParts.length > 0) {
            for (let metaIdx = 0; metaIdx < labelParts.length; metaIdx++) {
                const splitedStr = labelParts[metaIdx].split(':');
                let value = splitedStr[1];
                if (value.length > 32) {
                    value = value.slice(0, 32) + '...';
                }
                notCallChildren.children.push({
                    type: 'label',
                    id: `${opId}-label-meta-${metaIdx}`,
                    originText: labelParts[metaIdx], // Use pipe separator for compact display
                    text: [splitedStr[0], value].join(':'),
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
            labelChildren.push(notCallChildren);
        } else {
            // Add metadata label if there's metadata
            if (hasAttrValue) {
                // Create a more informative label
                this.parseOperationAttr(labelParts, op);
                if (labelParts.length > 0) {
                    for (let metaIdx = 0; metaIdx < labelParts.length; metaIdx++) {
                        const splitedStr = labelParts[metaIdx].split(':');
                        let value = splitedStr[1];
                        if (value.length > 32) {
                            value = value.slice(0, 32) + '...';
                        }
                        notCallChildren.children.push({
                            type: 'label',
                            id: `${opId}-label-meta-${metaIdx}`,
                            originText: labelParts[metaIdx], // Use pipe separator for compact display
                            text: [splitedStr[0], value].join(':'),
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
                    labelChildren.push(notCallChildren);
                }
            }

            if (op.opcode === 'CALL') {
                labelParts.push(`InCast: [${op.ioperands.join(',')}]`);
                labelParts.push(`OutCast: [${op.ooperands.join(',')}]`);
                const callChildren: any = {
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
                }
                for (let metaIdx = 0; metaIdx < labelParts.length; metaIdx++) {
                    const splitedStr = labelParts[metaIdx].split(':');
                    let value = splitedStr[1];
                    if (value.length > 32) {
                        value = value.slice(0, 32) + '...';
                    }
                    (callChildren.children as any[]).push({
                        type: 'label',
                        id: `${opId}-label-meta-${metaIdx}`,
                        originText: labelParts[metaIdx], // Use pipe separator for compact display
                        text: [splitedStr[0], value].join(':'),
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
                labelChildren.push(callChildren)
            }
        }

        // Add the labels compartment
        children.push({
            type: 'compartment',
            id: `${opId}-labels-compartment`,
            layout: 'vbox',
            magic: opmagic,
            subgraphId: subgraphId,
            layoutOptions: {
                hAlign: 'center',
                vAlign: 'center',
                vGap: 10,
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 6,
                paddingRight: 34
            },
            cssClasses: ['operation-labels-compartment'],
            children: [...labelChildren]
        } as SCompartment);

        // Create input ports
        // this.createInputPorts(op, opId, children, edges, portMap, tensorToRawTensorMap, rawTensorConsumers, showTensorNodes);
        const ioperandsUnique = [...new Set(op.ioperands)];
        const inportId = `${opId}-in`;
        if (ioperandsUnique.length > 0) {
            children.push({
                type: 'port',
                id: inportId,
                role: 'input',
                size: { width: 8, height: 8 }
            });
        }
        
        // Create output ports
        // this.createOutputPorts(op, opId, children, edges, portMap, tensorToRawTensorMap, rawTensorProducers, showTensorNodes);
        const ooperandsUnique = [...new Set(op.ooperands)];
        const outportId = `${opId}-out`;
        if (ooperandsUnique.length > 0) {
            children.push({
                type: 'port',
                id: outportId,
                role: 'output',
                size: { width: 8, height: 8 }
            });
        }

        const node: AstgrNode = {
            type: 'node',
            role: 'operation',
            id: opId,
            magic: opmagic,
            hasAttr: hasAttrValue,
            compareType: op.compareType,
            baseColor: baseColor,
            lightColor: lightColor,
            codePath: codePath,
            codeLine: codeLine,
            children,
            layout: 'vbox',
            layoutOptions: {
                hAlign: 'center',
                vAlign: 'top'
            },
            ...(op.opcode === 'CALL' && op.calleehash && { 
                calleehash: String(op.calleehash)
            })
        };
        nodes.push(node);
        this.opIdMap.set(opmagic, opId);
    }

    /**
     * Creates ports for an operation node
     */
    private createPorts(startNode: string, op: Operation, edges: SEdge[], 
                        tensorToRawTensorMap: Map<string, string>, rawTensorConsumers: Map<string, PortReference[]>, rawTensorProducers: Map<string, PortReference[]>,
                        showTensorNodes: boolean) {
        const opIndex = (this.opListMap.get(startNode)) as unknown as number;
        const opmagic = op.opmagic.toString();

        const graphId = op?.subgraphid ?? -1;
        // const nodeId = `tensor-${opmagic}-${graphId}`;
        const opId = `operation-${opIndex}-magic-${opmagic}-${graphId}`;

        // tensorMap.set(tensorMagic, { nodeId });
        const ioperandsUnique = [...new Set(op.ioperands)];
        ioperandsUnique.forEach((iop: number, index: number) => {
            const tensorMagic = String(iop);
            if (showTensorNodes) {
                let tensorNodeId = this.tensorMap.get(tensorMagic)?.nodeId;
                edges.push({
                    type: 'edge',
                    id: `edge-${tensorMagic}-to-${opId}-${index}`,
                    // sourceId: `${nodeId}-out`,
                    sourceId: `${tensorNodeId}-out`,
                    targetId: `${opId}-in`
                });
            } else {
                const portId = `${opId}-in`;
                const rawTensorId = tensorToRawTensorMap.get(tensorMagic);
                if (rawTensorId) {
                    if (!rawTensorConsumers.has(rawTensorId)) {
                        rawTensorConsumers.set(rawTensorId, []);
                    }
                    rawTensorConsumers.get(rawTensorId)!.push({ nodeId: opId, portId });
                }
            }

        });

        const ooperandsUnique = [...new Set(op.ooperands)];
        ooperandsUnique.forEach((oop: number, index: number) => {
            const tensorMagic = String(oop);
            if (showTensorNodes) {
                let tensorNodeId = this.tensorMap.get(tensorMagic).nodeId;
                    edges.push({
                        type: 'edge',
                        id: `edge-${opId}-to-${tensorMagic}-${index}`,
                        sourceId: `${opId}-out`,
                        // targetId: `${nodeId}-in`
                        targetId: `${tensorNodeId}-in`
                    });
            } else {
                const portId = `${opId}-out`;
                const rawTensorId = tensorToRawTensorMap.get(tensorMagic);
                if (rawTensorId) {
                    // portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId: opId, portId });
                    
                    if (!rawTensorProducers.has(rawTensorId)) {
                        rawTensorProducers.set(rawTensorId, []);
                    }
                    rawTensorProducers.get(rawTensorId)!.push({ nodeId: opId, portId });
                }
            }
        });
    }

    /**
     * Creates an parentIncastNode
     * 相比原函数啥也没改
     */
    private createParentIncastNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        index,
        inPortId,
    ): void {
        const tensor = actualData.inouttensors.inTensors[index].tensor;
        const rawTensor = actualData.inouttensors.inTensors[index].rawTensor;
        if (!tensor || !rawTensor) {
            return;
        }
        const tensorMagic = tensor.magic;
        const slotId = [];

        // Get the raw tensor ID and then lookup the tensor name
        let tensorName = rawTensor?.symbol || "In";
        tensorName = `${tensorMagic} ${tensorName} (${rawTensor.rawmagic})`
        // Create metadata parts for the tensor
        const metadataParts: string[] = [];
        try {
            const evalTensor = {...tensor};
            evalTensor.rawtensor = rawTensor;
            const result = comGraphStore.data.tensorAttrFunc(evalTensor);
            if (result) {
                metadataParts.push(...result);
            } else {
                this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
            }
        } catch (error) {
            this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
        }
        const graphId = -1;
        const nodeId = `parent-incast-${index}-tensor-${index}-${graphId}`;
        const portId = `${nodeId}-out`;
        const node: AstgrTensorNode = {
            type: 'node:tensor',
            id: nodeId,
            magic: `${tensorMagic}`,
            role: 'input',
            layout: 'vbox',
            layoutOptions: {
                hAlign: 'left',
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 5,
                paddingRight: 14
            },
            children: [
                // Labels compartment with vbox layout
                {
                    type: 'compartment',
                    id: `${nodeId}-labels-compartment`,
                    layout: 'vbox',
                    layoutOptions: {
                        hAlign: 'center',
                        vAlign: 'center',
                        vGap: 10
                    },
                    children: [
                        {
                            type: 'label',
                            id: `${nodeId}-label-main`,
                            text: tensorName,
                            magic: `${tensorMagic}`,
                            slotId: slotId,
                            cssClasses: ['input-main-label'],
                            layoutOptions: {
                                hAlign: 'left',
                                paddingTop: 0,
                                paddingBottom: 0,
                                paddingLeft: 0,
                                paddingRight: 0
                            },
                        } as SLabel,
                        // Metadata compartment with individual labels
                        ...(metadataParts.length > 0 ? [{
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
                            cssClasses: ['input-metadata-compartment'],
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
                                    cssClasses: ['input-meta-label'],
                                    minZoomLevel: 0.4
                                } as SLabel & MetadataLabel
                            })
                        } as SCompartment] : [])
                    ]
                } as SCompartment,
                {
                    type: 'port',
                    id: portId,
                    role: 'output',
                    size: { width: 8, height: 8 }
                } as AstgrPort
            ]
        };
        nodes.push(node);

        edges.push({
            type: 'edge',
            sourceId: portId,
            id: `edge-${tensorMagic}-to-incast-${index}`,
            targetId: inPortId,
            role: 'parent'
        });
    }

    /**
     * Creates an incast node
     * 相比原函数，删掉了一层for循环；portMap直接塞个producer; 增加了去重逻辑；
     */
    private createIncastNode(
        startNode: string,
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        rawTensorProducers: Map<string, PortReference[]>,
        rawTensorMap: Map<string, RawTensor>,
        showTensorNodes: boolean
    ): void {
        if (!actualData.incasts || !Array.isArray(actualData.incasts)) {
            return;
        }

        // for (let incastIndex = 0; incastIndex < actualData.incasts.length; incastIndex++) {

        let incastIndex;
        let slotId = [];
        for (let idx = 0; idx < actualData.incasts.length; idx++) {
            if (actualData.incasts[idx][0].toString() === startNode) {
                incastIndex = idx;
                const incast = actualData.incasts[incastIndex];
                if (Array.isArray(incast) && incast.length > 1) {
                    const temp = Array.isArray(incast[1]) ? incast[1] : [incast[1]];
                    slotId.push(...temp);
                }
                break;
            }
        }

        // Get the raw tensor ID and then lookup the tensor name
        const incastNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors[incastNodeIndex];
        const tensorMagic = tensor.magic.toString();
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor.rawmagic === undefined || typeof rawTensor.rawmagic !== 'number') {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get raw tensor magic.`);
        }

        const graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;

        // check duplicate Nodes
        if (this.nodeSet.has(nodeId)) {
            console.log("dxl test createIncastNode nodeset", this.nodeSet);
            const new_graphId = -2;
            nodeId = `tensor-${tensorMagic}-${new_graphId}`;
            this.nodeSet.add(nodeId);
            if (!this.isErrorReport) {
                (window as any).ascEventBus.emit('message_notice',
                    `${(window as any).ascLang === 'en' ? 'Duplicate Magic values in the node, the comgraph will continue rendering. Please check data' :
                    '节点存在magic重复, 计算图不会继续兼容渲染，请排查数据'}`);
                this.isErrorReport = true;
            }
            return;
        }

        let tensorName = rawTensor?.symbol || "In";
        tensorName = `${tensorMagic} ${tensorName} (${rawTensor.rawmagic})`

        // Create metadata parts for the tensor
        const metadataParts: string[] = [];
        try {
            const evalTensor = {...tensor};
            evalTensor.rawtensor = rawTensor;
            const result = comGraphStore.data.tensorAttrFunc(evalTensor);
            if (result) {
                metadataParts.push(...result);
            } else {
                this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
            }
        } catch (error) {
            this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
        }

        const portId = `tensor-${tensorMagic}-${graphId}-out`;
        const portIdIn = `tensor-${tensorMagic}-${graphId}-in`;
        const inPort: AstgrPort = {type: 'port', id: portIdIn, role: 'input', size: { width: 8, height: 8}};
        
        const node: AstgrTensorNode = {
            type: 'node:tensor',
            id: nodeId,
            compareType: tensor.compareType,
            magic: `${tensorMagic}`,
            role: 'input',
            layout: 'vbox',
            layoutOptions: {
                hAlign: 'left',
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 5,
                paddingRight: 14
            },
            children: [
                // Labels compartment with vbox layout
                {
                    type: 'compartment',
                    id: `${nodeId}-labels-compartment`,
                    layout: 'vbox',
                    layoutOptions: {
                        hAlign: 'center',
                        vAlign: 'center',
                        vGap: 10
                    },
                    children: [
                        {
                            type: 'label',
                            id: `${nodeId}-label-main`,
                            text: tensorName,
                            magic: `${tensorMagic}`,
                            slotId: slotId,
                            cssClasses: ['input-main-label'],
                            layoutOptions: {
                                hAlign: 'left',
                                paddingTop: 0,
                                paddingBottom: 0,
                                paddingLeft: 0,
                                paddingRight: 0
                            },
                        } as SLabel,
                        // Metadata compartment with individual labels
                        ...(metadataParts.length > 0 ? [{
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
                            cssClasses: ['input-metadata-compartment'],
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
                                    cssClasses: ['input-meta-label'],
                                    minZoomLevel: 0.4
                                } as SLabel & MetadataLabel
                            })
                        } as SCompartment] : [])
                    ]
                } as SCompartment,
                {
                    type: 'port',
                    id: portId,
                    role: 'output',
                    size: { width: 8, height: 8 }
                } as AstgrPort
            ]
        };
        node.children.push(inPort);
        this.nodeSet.add(nodeId);
        if (actualData.inouttensors) { // 第一次渲染走不进来 不管
            nodes.push(node);
            this.createParentIncastNodes(actualData, nodes, edges, incastIndex, portIdIn);
        } else {
        nodes.push(node);
        }
        if (showTensorNodes) {
            // Connect to tensor node's input port
            // const tensorPort = portMap.get(`producer-${tensorMagic}`);
            // if (tensorPort) {
            portMap.set(`producer-${tensorMagic}`, { nodeId, portId });
            // }
        } else {
            // Register incast as producer for direct connections
            const rawTensorId = `${rawTensor.rawmagic}`;
            if (rawTensorId) {
                portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId, portId });
                
                if (!rawTensorProducers.has(rawTensorId)) {
                    rawTensorProducers.set(rawTensorId, []);
                }
                rawTensorProducers.get(rawTensorId)!.push({ nodeId, portId });
            }
        }
        // }
    }

    /**
     * Creates an parentOutcastNode
     * 相比原函数啥也没改
     */
    private createParentOutCastNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        index,
        outPortId
    ): void{
        const tensor = actualData.inouttensors.outTensors[index].tensor;
        const rawTensor = actualData.inouttensors.outTensors[index].rawTensor;
        if (!tensor || !rawTensor) {
            return;
        }
        const tensorMagic = String(tensor.magic);

        const slotId = [];

        const uniqueKey = `m${tensorMagic}_s${slotId}`;
        // Get the raw tensor ID and then lookup the tensor name
        let tensorName = rawTensor?.symbol || "Out";

        tensorName = `${tensorMagic} ${tensorName} (${rawTensor.rawmagic})`
        // Create metadata parts for the tensor
        const metadataParts: string[] = [];
        try {
            const evalTensor = {...tensor};
            evalTensor.rawtensor = rawTensor;
            const result = comGraphStore.data.tensorAttrFunc(evalTensor);
            if (result) {
                metadataParts.push(...result);
            } else {
                this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
            }
        } catch (error) {
            this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
        }
        const graphId = -1;
        const nodeId = `parent-outcast-${index}-tensor-${index}-${graphId}`;
        const portId = `${nodeId}-in`;

        const node: AstgrTensorNode = {
            type: 'node:tensor',
            id: nodeId,
            magic: `${tensorMagic}`,
            role: 'output',
            layout: 'vbox',
            layoutOptions: {
                hAlign: 'left',
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 5,
                paddingRight: 14
            },
            children: [
                // Labels compartment with vbox layout
                {
                    type: 'compartment',
                    id: `${nodeId}-labels-compartment`,
                    layout: 'vbox',
                    layoutOptions: {
                        hAlign: 'center',
                        vAlign: 'center',
                        vGap: 10
                    },
                    children: [
                        {
                            type: 'label',
                            id: `${nodeId}-label-main`,
                            text: tensorName,
                            magic: `${tensorMagic}`,
                            slotId: slotId,
                            cssClasses: ['output-main-label'],
                            layoutOptions: {
                                hAlign: 'left',
                                paddingTop: 0,
                                paddingBottom: 0,
                                paddingLeft: 0,
                                paddingRight: 0
                            },
                        } as SLabel,
                        // Metadata compartment with individual labels
                        ...(metadataParts.length > 0 ? [{
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
                            cssClasses: ['output-metadata-compartment'],
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
                                    cssClasses: ['output-meta-label'],
                                    minZoomLevel: 0.4
                                } as SLabel & MetadataLabel
                            })
                        } as SCompartment] : [])
                    ]
                } as SCompartment,
                {
                    type: 'port',
                    id: portId,
                    role: 'input',
                    size: { width: 8, height: 8 }
                } as AstgrPort
            ]
        };
        nodes.push(node);

        edges.push({
            type: 'edge',
            id: `edge-${tensorMagic}-to-outcast-${index}`,
            sourceId: outPortId,
            targetId: portId,
            role: 'parent'
        });
    }

    /**
     * Creates outcast (output) nodes
     * 相比原函数，删除一层for循环；portMap直接塞个producer; 增加去重逻辑
     */
    private createOutcastNode(
        startNode: string,
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        rawTensorConsumers: Map<string, PortReference[]>,
        rawTensorMap: Map<string, RawTensor>,
        showTensorNodes: boolean
    ): void {
        if (!actualData.outcasts || !Array.isArray(actualData.outcasts)) {
            return;
        }

        // const outcastUnique : Set<string> = new Set<string>();
        // for (let outcastIndex = 0; outcastIndex < actualData.outcasts.length; outcastIndex++) {
        let outcastIndex;
        let slotId = [];
        for (let idx = 0; idx < actualData.outcasts.length; idx++) {
            if (actualData.outcasts[idx][0].toString() === startNode) {
                outcastIndex = idx;
                const outcast = actualData.outcasts[outcastIndex];
                if (Array.isArray(outcast) && outcast.length > 1) {
                    const temp = Array.isArray(outcast[1]) ? outcast[1] : [outcast[1]];
                    slotId.push(...temp);
                }
                break;
            }
        }

        // Get the raw tensor ID and then lookup the tensor name
        const outcastNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors[outcastNodeIndex];
        const tensorMagic = tensor.magic.toString();
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor.rawmagic === undefined || typeof rawTensor.rawmagic !== 'number') {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get raw tensor magic.`);
        }

        let graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;
        // check duplicate Nodes
        if (this.nodeSet.has(nodeId)) {
            console.log("dxl test createOutcastNode nodeset", this.nodeSet);
            graphId = -2;
            nodeId = `tensor-${tensorMagic}-${graphId}`;
            this.nodeSet.add(nodeId);
            if (!this.isErrorReport) {
                (window as any).ascEventBus.emit('message_notice',
                    `${(window as any).ascLang === 'en' ? 'Duplicate Magic values in the node, the comgraph will continue rendering. Please check data' :
                    '节点存在magic重复, 计算图不会继续兼容渲染，请排查数据'}`);
                this.isErrorReport = true;
            }
            return;
        }

        let tensorName = rawTensor?.symbol || "Out";
        tensorName = `${tensorMagic} ${tensorName} (${rawTensor.rawmagic})`

        // Create metadata parts for the tensor
        const metadataParts: string[] = [];
        try {
            const evalTensor = {...tensor};
            evalTensor.rawtensor = rawTensor;
            const result = comGraphStore.data.tensorAttrFunc(evalTensor);
            if (result) {
                metadataParts.push(...result);
            } else {
                this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
            }
        } catch (error) {
            this.getTensorCommonAttr(metadataParts, tensor, rawTensor);
        }

        const portId = `tensor-${tensorMagic}-${graphId}-in`;
        const outPortId = `tensor-${tensorMagic}-${graphId}-out`;
        const outPort: AstgrPort = {type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8}};
        
        const node: AstgrTensorNode = {
            type: 'node:tensor',
            id: nodeId,
            compareType: tensor.compareType,
            magic: `${tensorMagic}`,
            role: 'output',
            layout: 'vbox',
            layoutOptions: {
                hAlign: 'left',
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 5,
                paddingRight: 14
            },
            children: [
                // Labels compartment with vbox layout
                {
                    type: 'compartment',
                    id: `${nodeId}-labels-compartment`,
                    layout: 'vbox',
                    layoutOptions: {
                        hAlign: 'center',
                        vAlign: 'center',
                        vGap: 10
                    },
                    children: [
                        {
                            type: 'label',
                            id: `${nodeId}-label-main`,
                            text: tensorName,
                            magic: `${tensorMagic}`,
                            slotId: slotId,
                            cssClasses: ['output-main-label'],
                            layoutOptions: {
                                hAlign: 'left',
                                paddingTop: 0,
                                paddingBottom: 0,
                                paddingLeft: 0,
                                paddingRight: 0
                            },
                        } as SLabel,
                        // Metadata compartment with individual labels
                        ...(metadataParts.length > 0 ? [{
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
                            cssClasses: ['output-metadata-compartment'],
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
                                    cssClasses: ['output-meta-label'],
                                    minZoomLevel: 0.4
                                } as SLabel & MetadataLabel
                            })
                        } as SCompartment] : [])
                    ]
                } as SCompartment,
                {
                    type: 'port',
                    id: portId,
                    role: 'input',
                    size: { width: 8, height: 8 }
                } as AstgrPort
            ]
        };
        node.children.push(outPort);
        this.nodeSet.add(nodeId);
        if (actualData.inouttensors) {
            nodes.push(node);
            this.createParentOutCastNodes(actualData, nodes, edges, outcastIndex, outPortId);
        } else {
            nodes.push(node);
        }

        if (showTensorNodes) {
            // Connect to tensor node's output port
            // const tensorPort = portMap.get(`consumer-${tensorMagic}`);
            // if (tensorPort) {
            portMap.set(`consumer-${tensorMagic}`, { nodeId, portId });
            // }
        } else {
            // Register outcast as consumer for direct connections
            const rawTensorId = `${rawTensor.rawmagic}`;
            if (rawTensorId) {
                portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId });
                
                if (!rawTensorConsumers.has(rawTensorId)) {
                    rawTensorConsumers.set(rawTensorId, []);
                }
                rawTensorConsumers.get(rawTensorId)!.push({ nodeId, portId });
            }
        }
        // }
    }

    /**
     * Creates tensor nodes and registers their ports
     * 增加了去重部分
     */
    private createTensorNode(
        startNode: string,
        actualData: FunctionData,
        nodes: SNode[],
        portMap: Map<string, PortReference>,
        rawTensorMap: Map<string, RawTensor>,
        inoutMap: Map<string, Set<string>>
    ): void {
        if (!actualData.tensors || !Array.isArray(actualData.tensors)) {
            return;
        }

        const tensorIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors[tensorIndex];
        console.log("dxl test createTensorNode startNode", startNode);
        console.log("dxl test createTensorNode tensor", tensor);

        if (tensor.magic === undefined || typeof tensor.magic !== 'number') {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get tensor magic.`);
        }

        const tensorMagic = String(tensor.magic);
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor.rawmagic === undefined || typeof rawTensor.rawmagic !== 'number') {
            (window as any).ascEventBus.emit('jsonParseError', `Can not get raw tensor magic.`);
        }

        let symbol = rawTensor?.symbol || "Tensor";
        symbol = `${tensorMagic} ${symbol} (${rawTensor.rawmagic})`;

        const graphId = tensor?.subgraphid ?? -1;
        let baseColor = graphId >= 0 ? this.baseColorList[graphId % 360] : `var(--devui-tensor-node-base-color)`;
        let lightColor = graphId >= 0 ? this.lightColorList[graphId % 360] : `var(--devui-tensor-node-light-color)`;

        try {
            const userColor = comGraphStore.data.tensorColorFunc && comGraphStore.data.tensorColorFunc(tensor, this.baseColorList);
            if (userColor) {
                baseColor = userColor;
                lightColor = getLighterColorByHex(baseColor);
            }
        } catch (error) {
            console.error(`Need to use default color, because ${error}`);
        }

        let nodeId = `tensor-${tensorMagic}-${graphId}`;
        // check duplicate Nodes
        if (this.nodeSet.has(nodeId)) {
            console.log("dxl test createTensorNode nodeset", this.nodeSet);
            const new_graphId = -2;
            nodeId = `tensor-${tensorMagic}-${new_graphId}`;
            this.nodeSet.add(nodeId);
            if (!this.isErrorReport) {
                (window as any).ascEventBus.emit('message_notice',
                    `${(window as any).ascLang === 'en' ? 'Duplicate Magic values in the node, the comgraph will continue rendering. Please check data' :
                    '节点存在magic重复, 计算图不会继续兼容渲染，请排查数据'}`);
                this.isErrorReport = true;
            }
            return;
        }
        
        this.tensorMap.set(tensorMagic, { nodeId });

        // Create more detailed label information
        const labelParts: string[] = [];
        try {
            const evalTensor = {...tensor};
            evalTensor.rawtensor = rawTensor;
            const result = comGraphStore.data.tensorAttrFunc && comGraphStore.data.tensorAttrFunc(evalTensor);
            if (result) {
                labelParts.push(...result);
            } else {
                this.getTensorCommonAttr(labelParts, tensor, rawTensor);
            }
        } catch (error) {
            this.getTensorCommonAttr(labelParts, tensor, rawTensor);
        }

        // Create ports for the tensor node
        const inputPort: AstgrPort = {
            type: 'port',
            id: `${nodeId}-in`,
            role: 'input',
            size: { width: 8, height: 8 }
        };

        const outputPort: AstgrPort = {
            type: 'port',
            id: `${nodeId}-out`,
            role: 'output',
            size: { width: 8, height: 8 }
        };

        const isIncast = inoutMap.get('incasts')?.has(tensorMagic) ?? false;
        const isOutcast = inoutMap.get('outcasts')?.has(tensorMagic) ?? false;
        if (tensor.nodetype === 0 && !isIncast && !isOutcast) {
            const tensorNode: AstgrTensorNode = {
                type: 'node:tensor',
                role: 'tensor',
                compareType: tensor.compareType,
                id: nodeId,
                magic: `${tensor.magic}`,
                subgraphId: graphId,
                baseColor: baseColor,
                lightColor: lightColor,
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
                            ...(labelParts.length > 0 ? [{
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
                                    let value  = splitedStr[1];
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
                            } as SCompartment] : [])
                        ]
                    } as SCompartment,
                    inputPort,
                    outputPort
                ]
            };
            nodes.push(tensorNode);
            this.nodeSet.add(nodeId);
        }

        // Register ports in portMap
        portMap.set(`producer-${tensorMagic}`, { nodeId, portId: outputPort.id });
        portMap.set(`consumer-${tensorMagic}`, { nodeId, portId: inputPort.id });
        
        // Also register by rawtensor ID for consistency
        const rawTensorId = String(tensor.rawtensor);
        portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId, portId: outputPort.id });
        portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId: inputPort.id });

        console.log("dxl test createTensorNode tensorIndex " + tensorIndex + " startNode " + startNode);
        console.log("dxl test createTensorNode tensor", tensor)
        console.log("dxl test createTensorNode nodes", nodes)
    }

    /**
     * Creates an tensor node
     * 原地创建个节点
     * 前向搜个op
     * 跳 op 的前向搜索去
     */
    private tensorSearchForward(        
        startNode: string, 
        actualData: FunctionData, 
        nodes: SNode[], 
        edges: SEdge[], 
        portMap: Map<string, PortReference>, 
        tensorToRawTensorMap: Map<string, string>,
        rawTensorProducers: Map<string, PortReference[]>,
        rawTensorConsumers: Map<string, PortReference[]>,
        rawTensorMap: Map<string, RawTensor>,
        inoutMap: Map<string, Set<string>>,
        showTensorNodes: boolean) 
    {
        // 在这里朴素地遍历节点然后直接给推到port和edges
        if (actualData.incasts?.some(([n]) => n === Number(startNode)) ) {
        // if (actualData.incasts?.includes(Number(startNode))) {
            console.log("dxl test opSearchForward  incast", startNode);
            this.createIncastNode(startNode, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
            // return;
        }

        console.log("dxl test opSearchForward  tensor", startNode);
        this.createTensorNode(startNode, actualData, nodes, portMap, rawTensorMap, inoutMap);
        if(!this.tensor2opMap.get(startNode)){
            // 不会有这种情况 毕竟我在前面兜底了
            return;
        }
        const inOpList = this.tensor2opMap.get(startNode).inOp;

        for(let op of inOpList) {
            console.log("dxl test tensorSearchForward startNode " + startNode);
            console.log("dxl test tensorSearchForward inOpList ", inOpList);
            console.log("dxl test tensorSearchForward op", op);
            console.log("dxl test tensorSearchForward 2 opSearchForward");
            this.opSearchForward(op, actualData, nodes, edges, portMap, 
                                 tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                 inoutMap, showTensorNodes);
        }
    }

    /**
     * Creates an tensor node
     * 原地创建个节点
     * 前向搜个op
     * 跳 op 的前向搜索去
     */
    private tensorSearchBackward(        
        startNode: string, 
        actualData: FunctionData, 
        nodes: SNode[], 
        edges: SEdge[], 
        portMap: Map<string, PortReference>, 
        tensorToRawTensorMap: Map<string, string>,
        rawTensorProducers: Map<string, PortReference[]>,
        rawTensorConsumers: Map<string, PortReference[]>,
        rawTensorMap: Map<string, RawTensor>,
        inoutMap: Map<string, Set<string>>,
        showTensorNodes: boolean) 
    {
        // if (actualData.outcasts?.includes(Number(startNode))) {
        console.log("dxl test tensorSearchBackward startNode " + startNode);
        if (actualData.outcasts?.some(([n]) => n === Number(startNode)) ) {
            this.createOutcastNode(startNode, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
            // return; // TODO : 是否是互斥的？
        }

        this.createTensorNode(startNode, actualData, nodes, portMap, rawTensorMap, inoutMap);

        if(!this.tensor2opMap.get(startNode)){
            // 不会有这种情况 毕竟我在前面兜底了
            return;
        }
        const outOpList = this.tensor2opMap.get(startNode).outOp;

        for(let op of outOpList) {
            console.log("dxl test tensorSearchBackward startNode " + startNode);
            console.log("dxl test tensorSearchBackward inOpList ", outOpList);
            console.log("dxl test tensorSearchForward op", op);
            console.log("dxl test tensorSearchBackward 2 opSearchBackward");
            this.opSearchBackward(op, actualData, nodes, edges, portMap, 
                                  tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                  inoutMap, showTensorNodes);
        }
    }
    
}

