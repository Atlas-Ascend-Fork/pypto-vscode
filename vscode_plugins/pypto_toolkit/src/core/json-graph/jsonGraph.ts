import { SEdge, SLabel, SModelRoot, SNode, SPort, SCompartment } from 'sprotty-protocol';
import { AttrReader, parseSymbolicOrIntList, parseExprList } from './parseSymbolicAttr';
import { generateColorList, getLighterColorByHex } from '../../color-list';
import { getIDELang } from '../../lang';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';

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
    codeLine?: string;
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
  semantic_label: {
    filename?: string;
    label?: string;
    lineno?: number;
  };
  mem_type?: {[key: string]: number};
  subgraphid?: number;
  compareType?: string
}

/**
 * Sync queue configuration
 */
interface SyncQueue {
    pipe_id?: number;
    trig_pipe?: number;
    event_id?: number;
    core_type?: number;
    gm_buf_id?: number;
    tri_core_type?: number;
    offset?: number[];
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
 * Operation reference for sync coordination
 */
interface OpReference {
    index: number;
    op: Operation;
}

/**
 * Port reference for graph connections
 */
interface PortReference {
    nodeId: string;
    portId: string;
}

export type MetadataLabel = {
    minZoomLevel: number
}

/**
 * Global mapping of format enum values to string representations
 */
const FORMAT_MAP: { [key: number]: string } = {
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

declare const vscode: any;

/**
 * Builder class for creating Sprotty graphs from ASCPP DAG data
 */
export class AscppDagBuilder {
    /*
    *   Node coloring data
    */
    baseColorList: string[];
    lightColorList: string[];
    nodeSet = new Set<string> ();
    isErrorReport = false;
    comGraphData;
    server;
    callInOutTensorMap: ((data) => any) | undefined;
    callInOutMap = new Map<string, CallInOutItems>();
    /*
    *   SinglePath Search Data
    */
    opListMap = new Map<string, number>();
    tensorListMap = new Map<string, number>();
    op2CastMap = new Map<string, Map<string, number[]>>(); // opMagic, incast: tensorMagic, outcast: tensorMagic
    tensor2opMap = new Map<string, {inOp: Set<string>; outOp: Set<string>}>(); // opMagic, incast: tensorMagic, outcast: tensorMagic
    tensorNodeMap = new Map<string, { nodeId: string }>();
    opIdMap = new Map<string, string>();
    singlePathNodeSet = new Set<string> ();
    pathNodesSet = new Set<string> ();
    version: string = '2.0';

    constructor(comGraphData: any, server: any, version: string, callInOutTensorMap?: (data) => any) {
        this.comGraphData = comGraphData;
        this.callInOutTensorMap = callInOutTensorMap
        this.server = server;
        this.version = version;
    }

    /**
     * Extracts available subgraph IDs from function data
     * @param funcData - The function data containing operations
     * @returns Array of unique subgraph IDs (excluding -1)
     */
    public getAvailableSubgraphs(funcData: FunctionData): number[] {
        // Handle potential data structure variations
        let actualData = funcData;
        // Check if the data might be nested under a property
        if (!this.hasValidStructure(funcData)) {
            actualData = this.extractNestedData(funcData);
        }

        const subgraphs = new Set<number>();
        
        // Extract subgraph IDs from operations
        if (actualData.operations && Array.isArray(actualData.operations)) {
            for (const op of actualData.operations) {
                if (op.subgraphid !== undefined && op.subgraphid !== -1) {
                    subgraphs.add(op.subgraphid);
                }
            }
        }
        
        return Array.from(subgraphs).sort((a, b) => a - b);
    }

    /**
     * Extracts node ID from port ID
     * @param portId - The port ID (e.g., "operation-0-magic-123-out")
     * @returns The node ID (e.g., "operation-0-magic-123")
     */
    private extractNodeIdFromPortId(portId: string): string {
        // Remove port suffixes like "-in", "-out", "-input-0", "-output-0"
        return portId.replace(/-(?:in|out|input-\d+|output-\d+)$/, '');
    }

    /**
     * Creates a Sprotty graph model from function data
     * @param funcData - The function data containing operations, tensors, etc.
     * @param showTensorNodes - Whether to show tensor nodes in the graph
     * @param showSyncNodes - Whether to show synchronization nodes in the graph
     * @param colorBySubgraph - Whether to color nodes by subgraph
     * @param filterSubgraphId - Filter to show only nodes from specific subgraph (undefined = show all)
     * @param nodeMagic - Whether to show single node and its relative nodes in the graph (undefined = show all)
     * @returns The Sprotty graph model
     */
    public createSprottyGraph(funcData: FunctionData, showTensorNodes: boolean = true, showSyncNodes: boolean = false, colorBySubgraph: boolean = false, isDark = true, 
                              filterSubgraphId?: number, nodeMagic?: string): ExtendedSModelRoot {
        // Handle potential data structure variations
        let actualData = funcData;
        const colorList = generateColorList(360, isDark);
        this.baseColorList = colorList.baseColorList;
        this.lightColorList = colorList.lightColorList;
        // Check if the data might be nested under a property
        if (!this.hasValidStructure(funcData)) {
            actualData = this.extractNestedData(funcData);
        }

        // Initialize data structures
        const { nodes, edges, tensorMap, portMap, rawTensorProducers, rawTensorConsumers } = this.initializeDataStructures();
        const { rawTensorMap, magicToTensorMap, tensorToRawTensorMap, inoutMap } = this.createTensorMaps(actualData);

        if (nodeMagic) {
            const startNode  = nodeMagic.toString();
            this.createNodeListMap(actualData);
            if(this.opListMap.has(startNode)) {
                // tensorType = 'operation';
                this.opSearchForward(startNode, actualData, nodes, edges, portMap, 
                                     tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                     magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
                this.opSearchBackward(startNode, actualData, nodes, edges, portMap, 
                                      tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                      magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
            } else {
                // tensorType = 'tensor';
                this.tensorSearchForward(startNode, actualData, nodes, edges, portMap, 
                                         tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                         magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
                this.tensorSearchBackward(startNode, actualData, nodes, edges, portMap, 
                                          tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                          magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
            }
            this.server.setRef('PathNodesSet', { data: Array.from(this.pathNodesSet) });
        } else {
            // Create tensor nodes if enabled
            if (showTensorNodes) {
                this.createTensorNodes(actualData, nodes, portMap, rawTensorMap, tensorMap, inoutMap);
            }

            // Create input and output nodes
            this.createIncastNodes(actualData, nodes, edges, portMap, magicToTensorMap, rawTensorMap, rawTensorProducers, showTensorNodes);
            this.createOutcastNodes(actualData, nodes, edges, portMap, magicToTensorMap, rawTensorMap, rawTensorConsumers, showTensorNodes);

            // Create operation nodes
            this.createOperationNodes(actualData, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, showSyncNodes);
        }

        //record call input output nodes
        this.createCallInOutTensorMap(actualData, rawTensorMap, magicToTensorMap);

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

        // Create phase grouping information for layout hints
        this.addPhaseGroupingInfo(actualData, nodes);

        // Create control flow edges for synchronization operations only if sync nodes are shown
        if (showSyncNodes) {
            this.createSyncControlFlowEdges(actualData, nodes, edges);
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
        const bottomNode: SEdge = {
            type: 'bottom',
            id: 'node-bottom-edge',
        };
        return {
            type: 'graph',
            id: 'root',
            children: [bottomNode, ...filteredEdges, ...filteredNodes],
            colorBySubgraph, // Add the flag to the root model
            filterSubgraphId // Add the filter setting to the root model
        };
    }

    /**
     * Initializes the data structures used for graph construction
     */
    private initializeDataStructures() {
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

    public createNodeListMap(funcData: FunctionData) {
        let actualData: any = funcData;

        for (let tensorIndex = 0; tensorIndex < actualData.tensors.length; tensorIndex++) {
            const tensormagic = actualData.tensors[tensorIndex].magic.toString();
            const graphId = actualData.tensors[tensorIndex].subgraphid ?? -1;
            this.tensorListMap.set(tensormagic, tensorIndex);
            let nodeId = `tensor-${tensormagic}-${graphId}`;
            this.tensorNodeMap.set(tensormagic, { nodeId });

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
                this.tensor2opMap.get(node.toString())!.outOp.add(opmagic);
            }
            for( let node of ooperands) {
                if(!this.tensor2opMap.has(node.toString())) {
                    this.tensor2opMap.set(node.toString(), {inOp: new Set<string>(), outOp: new Set<string>()});
                }
                this.tensor2opMap.get(node.toString())!.inOp.add(opmagic);
            }
        }
    }

    private getTensorCommonAttr(labelAttr: string[], tensor: Tensor, rawTensor: RawTensor) {
        // Add shape information
        if (tensor?.shape) {
            const shapeStr = `[${tensor.shape.join(',')}]`;
            labelAttr.push(`shape: ${shapeStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get tensor (${tensor.magic}) shape information.` : `无法获取tensor (${tensor.magic}) 的shape信息`)
        }

        if (rawTensor?.rawshape) {
            const rawShapeStr = `[${rawTensor.rawshape.join(',')}]`;
            labelAttr.push(`rawshape: ${rawShapeStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor (${rawTensor.rawmagic}) raw shape information.` : `无法获取raw tensor (${rawTensor.rawmagic}) 的raw shape信息`)
        }

        // Add offset information if available
        if (tensor?.offset && Array.isArray(tensor.offset) && tensor.offset.length > 0) {
            const offsetStr = `[${tensor.offset.join(',')}]`;
            labelAttr.push(`offset: ${offsetStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get tensor (${tensor.magic}) offset.` : `无法获取tensor (${tensor.magic}) 的offset信息`)
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
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor (${rawTensor.rawmagic}) data type.` : `无法获取raw tensor (${rawTensor.rawmagic}) 的data type信息`)
        }
    }

    /**
     * Creates an op node and search forward
     */
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
        magicToTensorMap: Map<string, Tensor>,
        tensorMap: Map<string, { nodeId: string }>,
        inoutMap: Map<string, Set<string>>,
        showTensorNodes: boolean
    ) {
        if (!actualData.operations || !Array.isArray(actualData.operations)) {
            return;
        }

        const opIndex = this.opListMap.get(startNode);
        const op = actualData.operations[opIndex!];
        const opmagic = op.opmagic.toString();
        
        // DONE : 保证全图去重set
        const graphId = op?.subgraphid ?? -1;
        const opId = `operation-magic-${opmagic}`;

        if (this.opIdMap.get(opmagic) !== `${opId}-${graphId}`) {
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, startNode);
        }

        const ioperands = [...new Set(op.ioperands)];
        for (let incastNode of ioperands) {
            let tensorNodeId = this.tensorNodeMap.get(incastNode.toString())?.nodeId;
            if (this.singlePathNodeSet.has(tensorNodeId!)) {
                continue;
            }
            this.tensorSearchForward(String(incastNode), actualData, nodes, edges, portMap, 
                                     tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                     magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
        }
    }
    
    /**
     * Creates an op node and search backward
     */
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
        magicToTensorMap: Map<string, Tensor>,
        tensorMap: Map<string, { nodeId: string }>,
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
        const opId = `operation-magic-${opmagic}`;

        if (this.opIdMap.get(opmagic) !== `${opId}-${graphId}`) {
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, startNode);
        }

        const ooperands = [...new Set(op.ooperands)];
        for (let outcastNode of ooperands) {
            let tensorNodeId = this.tensorNodeMap.get(outcastNode.toString())?.nodeId;
            if (this.singlePathNodeSet.has(tensorNodeId!)) {
                continue;
            }
            this.tensorSearchBackward(String(outcastNode), actualData, nodes, edges, portMap, 
                                      tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                      magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
        }
    }

    private createIncastNode(
        startNode: string,
        tensor: Tensor,
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

        let incastIndex;
        let slotId: any[] = [];
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
        const tensorMagic = tensor.magic.toString();
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor magic.`: `无法获取raw tensor magic.`)
        }

        const graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;

        // check duplicate Nodes
        if (this.singlePathNodeSet.has(nodeId)) {
            const new_graphId = -2;
            nodeId = `tensor-${tensorMagic}-${new_graphId}`;
            this.singlePathNodeSet.add(nodeId);
            return;
        }

        let tensorName = rawTensor?.symbol || "In";
        tensorName = `${tensorMagic} ${tensorName} (${rawTensor!.rawmagic})`
        const portId = `tensor-${tensorMagic}-${graphId}-out`;
        const portIdIn = `tensor-${tensorMagic}-${graphId}-in`;
        const inPort: AstgrPort = {type: 'port', id: portIdIn, role: 'input', size: { width: 8, height: 8}};
        
        const node: AstgrTensorNode = this.createCastNode (tensor, rawTensor, nodeId, portId, tensorMagic, tensorName, slotId, 'input');

        node.children!.push(inPort);
        this.singlePathNodeSet.add(nodeId);
        this.pathNodesSet.add(tensorMagic);
        if (actualData.inouttensors) {
            nodes.push(node);
            this.createParentIncastNodes(actualData, nodes, edges, incastIndex, portIdIn);
        } else {
        nodes.push(node);
        }
        if (showTensorNodes) {
            portMap.set(`producer-${tensorMagic}`, { nodeId, portId });
        } else {
            // Register incast as producer for direct connections
            const rawTensorId = `${rawTensor!.rawmagic}`;
            if (rawTensorId) {
                portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId, portId });
                
                if (!rawTensorProducers.has(rawTensorId)) {
                    rawTensorProducers.set(rawTensorId, []);
                }
                rawTensorProducers.get(rawTensorId)!.push({ nodeId, portId });
            }
        }
    }

    private createOutcastNode(
        startNode: string,
        tensor: Tensor,
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

        let outcastIndex;
        let slotId: any[] = [];
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
        const tensorMagic = tensor.magic.toString();
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor magic.` : `无法获取 raw tensor magic.`)
        }

        let graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;
        // check duplicate Nodes
        if (this.singlePathNodeSet.has(nodeId)) {
            graphId = -2;
            nodeId = `tensor-${tensorMagic}-${graphId}`;
            this.singlePathNodeSet.add(nodeId);
            return;
        }

        let tensorName = rawTensor?.symbol || "Out";
        tensorName = `${tensorMagic} ${tensorName} (${rawTensor!.rawmagic})`
        const portId = `tensor-${tensorMagic}-${graphId}-in`;
        const outPortId = `tensor-${tensorMagic}-${graphId}-out`;
        const outPort: AstgrPort = {type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8}};

        const node: AstgrTensorNode = this.createCastNode(tensor, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'output');
        node.children!.push(outPort);
        this.singlePathNodeSet.add(nodeId);
        this.pathNodesSet.add(tensorMagic);
        
        if (actualData.inouttensors) {
            nodes.push(node);
            this.createParentOutCastNodes(actualData, nodes, edges, outcastIndex, outPortId);
        } else {
            nodes.push(node);
        }

        if (showTensorNodes) {
            portMap.set(`consumer-${tensorMagic}`, { nodeId, portId });
        } else {
            const rawTensorId = `${rawTensor!.rawmagic}`;
            if (rawTensorId) {
                portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId });
                
                if (!rawTensorConsumers.has(rawTensorId)) {
                    rawTensorConsumers.set(rawTensorId, []);
                }
                rawTensorConsumers.get(rawTensorId)!.push({ nodeId, portId });
            }
        }
    }

    /**
     * Creates an tensor node and search forward
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
        magicToTensorMap: Map<string, Tensor>,
        tensorMap: Map<string, { nodeId: string }>,
        inoutMap: Map<string, Set<string>>,
        showTensorNodes: boolean) 
    {
        const castNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors![castNodeIndex!];
        if(tensor.nodetype === 1) {
            this.createIncastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else if (tensor.nodetype === 2) {
            this.createOutcastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else {
            this.createTensorNode(startNode, tensor, actualData, nodes, portMap, rawTensorMap, inoutMap);
        }

        if(!this.tensor2opMap.get(startNode.toString())){
            return;
        }
        const inOpList = this.tensor2opMap.get(startNode.toString())?.inOp;

        for(let op of inOpList!) {
            this.opSearchForward(op.toString(), actualData, nodes, edges, portMap, 
                                 tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                 magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
        }
    }

    /**
     * Creates an tensor node and search backward
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
        magicToTensorMap: Map<string, Tensor>,
        tensorMap: Map<string, { nodeId: string }>,
        inoutMap: Map<string, Set<string>>,
        showTensorNodes: boolean) 
    {
        const castNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors![castNodeIndex!];
        if (actualData.outcasts?.some(([n]) => n === Number(startNode)) ) {
            this.createOutcastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else if (actualData.incasts?.some((t) => t[0] === Number(startNode))) {
            this.createIncastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else {
            this.createTensorNode(startNode, tensor, actualData, nodes, portMap, rawTensorMap, inoutMap);
        }

        if(!this.tensor2opMap.get(startNode.toString())){
            return;
        }

        const outOpList = this.tensor2opMap.get(startNode.toString())?.outOp;

        for(let op of outOpList!) {
            this.opSearchBackward(op.toString(), actualData, nodes, edges, portMap, 
                                  tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap, 
                                  magicToTensorMap, tensorMap, inoutMap, showTensorNodes);
        }
    }

    private createTensorNode(
        startNode: string,
        tensor: Tensor,
        actualData: FunctionData,
        nodes: SNode[],
        portMap: Map<string, PortReference>,
        rawTensorMap: Map<string, RawTensor>,
        inoutMap: Map<string, Set<string>>
    ): void {
        if (!actualData.tensors || !Array.isArray(actualData.tensors)) {
            return;
        }

        if (tensor.magic === undefined || typeof tensor.magic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server, getIDELang() === 'en' ? `Can not get tensor magic.`: `无法获取 tensor magic.`)
        }

        const tensorMagic = String(tensor.magic);
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor magic.`: `无法获取 raw tensor magic.`)
        }

        let symbol = rawTensor?.symbol || "Tensor";
        symbol = `${tensorMagic} ${symbol} (${rawTensor!.rawmagic})`;

        const graphId = tensor?.subgraphid ?? -1;
        let baseColor = graphId >= 0 ? this.baseColorList[graphId % 360] : `var(--devui-tensor-node-base-color)`;
        let lightColor = graphId >= 0 ? this.lightColorList[graphId % 360] : `var(--devui-tensor-node-light-color)`;

        try {
            const userColor = this.comGraphData.tensorColorFunc && this.comGraphData.tensorColorFunc(tensor, this.baseColorList);
            if (userColor) {
                baseColor = userColor;
                lightColor = getLighterColorByHex(baseColor);
            }
        } catch (error) {
            console.error(`Need to use default color, because ${error}`);
        }

        let nodeId = `tensor-${tensorMagic}-${graphId}`;
        // check duplicate Nodes
        if (this.singlePathNodeSet.has(nodeId)) {
            const new_graphId = -2;
            nodeId = `tensor-${tensorMagic}-${new_graphId}`;
            this.singlePathNodeSet.add(nodeId);
            return;
        }
        
        this.tensorNodeMap.set(tensorMagic, { nodeId });

        // Create more detailed label information
        const labelParts: string[] = [];
        try {
            const evalTensor = {...tensor};
            evalTensor.rawtensor = rawTensor;
            const result = this.comGraphData.tensorAttrFunc && this.comGraphData.tensorAttrFunc(evalTensor);
            if (result) {
                labelParts.push(...result);
            } else {
                this.getTensorCommonAttr(labelParts, tensor, rawTensor!);
            }
        } catch (error) {
            this.getTensorCommonAttr(labelParts, tensor, rawTensor!);
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
                compareType: tensor.compareType!,
                semanticLabel: tensor.semantic_label?.label ?? '',
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
            this.singlePathNodeSet.add(nodeId);
            this.pathNodesSet.add(tensorMagic);
        }

        // Register ports in portMap
        portMap.set(`producer-${tensorMagic}`, { nodeId, portId: outputPort.id });
        portMap.set(`consumer-${tensorMagic}`, { nodeId, portId: inputPort.id });
        
        // Also register by rawtensor ID for consistency
        const rawTensorId = String(tensor.rawtensor);
        portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId, portId: outputPort.id });
        portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId: inputPort.id });
    }

    /**
     * Creates tensor nodes and registers their ports
     */
    private createTensorNodes(
        actualData: FunctionData,
        nodes: SNode[],
        portMap: Map<string, PortReference>,
        rawTensorMap: Map<string, RawTensor>,
        tensorMap: Map<string, { nodeId: string }>,
        inoutMap: Map<string, Set<string>>,
        nodeMagic?: string | undefined
    ): void {
        if (!actualData.tensors || !Array.isArray(actualData.tensors)) {
            return;
        }

        for (const tensor of actualData.tensors) {
            if (tensor.magic === undefined || typeof tensor.magic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get tensor magic.` : `无法获取tensor magic`)
            }

            const tensorMagic = String(tensor.magic);
            const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor magic.` : '无法获取raw tensor magic')
            }

            let symbol = rawTensor?.symbol || "Tensor";
            symbol = `${tensorMagic} ${symbol} (${rawTensor!.rawmagic})`;
            
            // Create more detailed label information
            const labelParts: string[] = [];
            try {
                const evalTensor = {...tensor};
                evalTensor.rawtensor = rawTensor;
                const result = this.comGraphData.tensorAttrFunc && this.comGraphData.tensorAttrFunc(evalTensor);
                if (result) {
                    labelParts.push(...result);
                } else {
                    this.getTensorCommonAttr(labelParts, tensor, rawTensor!);
                }
            } catch (error) {
                this.getTensorCommonAttr(labelParts, tensor, rawTensor!);
            }
            const graphId = tensor?.subgraphid ?? -1;
            let baseColor = graphId >= 0 ? this.baseColorList[graphId % 360] : `var(--devui-tensor-node-base-color)`;
            let lightColor = graphId >= 0 ? this.lightColorList[graphId % 360] : `var(--devui-tensor-node-light-color)`;

            try {
                const userColor = this.comGraphData.tensorColorFunc && this.comGraphData.tensorColorFunc(tensor, this.baseColorList);
                if (userColor) {
                    baseColor = userColor;
                    lightColor = getLighterColorByHex(baseColor);
                }
            } catch (error) {
                console.error(`Need to use default color, because ${error}`);
            }

            let nodeId = `tensor-${tensorMagic}-${graphId}`;
            tensorMap.set(tensorMagic, { nodeId });

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

            if (nodeMagic) {
                // check duplicate Nodes in single path
                if (this.singlePathNodeSet.has(nodeId)) {
                    const new_graphId = -2;
                    nodeId = `tensor-${tensorMagic}-${new_graphId}`;
                    this.singlePathNodeSet.add(nodeId);
                    return;
                }
            }

            const isIncast = inoutMap.get('incasts')?.has(tensorMagic) ?? false;
            const isOutcast = inoutMap.get('outcasts')?.has(tensorMagic) ?? false;
            if (tensor.nodetype === 0 && !isIncast && !isOutcast) {
                const tensorNode: AstgrTensorNode = {
                    type: 'node:tensor',
                    role: 'tensor',
                    compareType: tensor.compareType,
                    semanticLabel: tensor.semantic_label?.label ?? '',
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
                this.nodeSet.add(nodeId);
                nodes.push(tensorNode);
            }

            // Register ports in portMap
            portMap.set(`producer-${tensorMagic}`, { nodeId, portId: outputPort.id });
            portMap.set(`consumer-${tensorMagic}`, { nodeId, portId: inputPort.id });
            
            // Also register by rawtensor ID for consistency
            const rawTensorId = String(tensor.rawtensor);
            portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId, portId: outputPort.id });
            portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId: inputPort.id });
        }
    }

    /**
     * Create a cast Node
     */
    private createCastNode(tensor: Tensor, rawTensor: RawTensor | undefined, 
                            nodeId: string, portId: string, tensorMagic: string, tensorName: string, slotId: string[], 
                            nodeRole: "operation" | "tensor" | "input" | "output" | "sync") : AstgrTensorNode {
        // Create metadata parts for the tensor
        const metadataParts: string[] = [];
        try {
            const evalTensor = {...tensor};
            evalTensor.rawtensor = rawTensor;
            const result = this.comGraphData.tensorAttrFunc(evalTensor);
            if (result) {
                metadataParts.push(...result);
            } else {
                this.getTensorCommonAttr(metadataParts, tensor!, rawTensor!);
            }
        } catch (error) {
            this.getTensorCommonAttr(metadataParts, tensor!, rawTensor!);
        }
        const node: AstgrTensorNode = {
            type: 'node:tensor',
            id: nodeId,
            compareType: tensor.compareType!,
            semanticLabel: tensor.semantic_label?.label ?? '',
            // compareType: compareType,
            magic: `${tensorMagic}`,
            role: nodeRole,
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
                            cssClasses: [`${nodeRole}-main-label`],
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
                        } as SCompartment] : [])
                    ]
                } as SCompartment,
                {
                    type: 'port',
                    id: portId,
                    role:  (nodeRole === "input") ? 'output' : 'input',
                    size: { width: 8, height: 8 }
                } as AstgrPort
            ]
        };
        return node;
    }

    /**
     * Creates incast (input) nodes
     */
    private createIncastNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        magicToTensorMap: Map<string, Tensor>,
        rawTensorMap: Map<string, RawTensor>,
        rawTensorProducers: Map<string, PortReference[]>,
        showTensorNodes: boolean
    ): void {
        if (!actualData.incasts || !Array.isArray(actualData.incasts)) {
            return;
        }

        const incastUnique : Set<string> = new Set<string>();
        for (let incastIndex = 0; incastIndex < actualData.incasts.length; incastIndex++) {
            const incast = actualData.incasts[incastIndex];
            const tensorMagic = String(Array.isArray(incast) ? incast[0] : incast);

            const slotId: any[] = [];

            if (Array.isArray(incast) && incast.length > 1) {
                const temp = Array.isArray(incast[1]) ? incast[1] : [incast[1]]
                slotId.push(...temp);
            }

            const uniqueKey = `m${tensorMagic}_s${slotId}`;
            if (incastUnique.has(uniqueKey)) {
                continue;
            } else {
                incastUnique.add(uniqueKey);
            }
            
            // Get the raw tensor ID and then lookup the tensor name
            const tensor = magicToTensorMap.get(tensorMagic);
            const rawTensor = rawTensorMap.get(String(tensor!.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor magic.` : '无法获取raw tensor magic')
            }
            let tensorName = rawTensor?.symbol || "In";
            
            tensorName = `${tensorMagic} ${tensorName} (${rawTensor!.rawmagic})`
            const graphId = tensor?.subgraphid ?? -1;
            let nodeId = `tensor-${tensorMagic}-${graphId}`;
            const portId = `tensor-${tensorMagic}-${graphId}-out`;
            const portIdIn = `tensor-${tensorMagic}-${graphId}-in`;

            const inPort: AstgrPort = {type: 'port', id: portIdIn, role: 'input', size: { width: 8, height: 8}};
            
            const node: AstgrTensorNode = this.createCastNode(tensor!, rawTensor, nodeId, portId, tensorMagic, tensorName, slotId, 'input');

            node.children!.push(inPort);
            this.nodeSet.add(nodeId);

            if (actualData.inouttensors) {
                nodes.push(node);
                this.createParentIncastNodes(actualData, nodes, edges, incastIndex, portIdIn);
            } else {
                nodes.push(node);
            }
            if (showTensorNodes) {
                // Connect to tensor node's input port{
                const tensorPort = portMap.get(`producer-${tensorMagic}`);
                if (tensorPort) {
                    portMap.set(`producer-${tensorMagic}`, { nodeId, portId });
                }
            } else {
                // Register incast as producer for direct connections
                const rawTensorId = `${rawTensor!.rawmagic}`;
                if (rawTensorId) {
                    portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId, portId });
                    
                    if (!rawTensorProducers.has(rawTensorId)) {
                        rawTensorProducers.set(rawTensorId, []);
                    }
                    rawTensorProducers.get(rawTensorId)!.push({ nodeId, portId });
                }
            }
        }
    }

    private createParentIncastNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: any[],
        index,
        inPortId,
    ): void {
        const tensor = actualData.inouttensors!.inTensors[index].tensor;
        const rawTensor = actualData.inouttensors!.inTensors[index].rawTensor;
        if (!tensor || !rawTensor) {
            return;
        }
        const tensorMagic = tensor.magic;
        const slotId = [];

        // Get the raw tensor ID and then lookup the tensor name
        let tensorName = rawTensor?.symbol || "In";
        tensorName = `${tensorMagic} ${tensorName} (${rawTensor.rawmagic})`

        const graphId = -1;
        const nodeId = `parent-incast-${index}-tensor-${index}-${graphId}`;
        const portId = `${nodeId}-out`;

        const node: AstgrTensorNode = this.createCastNode(tensor, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'input');
        nodes.push(node);

        edges.push({
            type: 'edge',
            sourceId: portId,
            id: `edge-${tensorMagic}-to-incast-${index}`,
            targetId: inPortId,
            role: 'parent'
        });
    }

    private createParentOutCastNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: any[],
        index,
        outPortId
    ): void{
        const tensor = actualData.inouttensors!.outTensors[index].tensor;
        const rawTensor = actualData.inouttensors!.outTensors[index].rawTensor;
        if (!tensor || !rawTensor) {
            return;
        }
        const tensorMagic = String(tensor.magic);

        const slotId = [];

        const uniqueKey = `m${tensorMagic}_s${slotId}`;
        // Get the raw tensor ID and then lookup the tensor name
        let tensorName = rawTensor?.symbol || "Out";

        tensorName = `${tensorMagic} ${tensorName} (${rawTensor.rawmagic})`

        const graphId = -1;
        const nodeId = `parent-outcast-${index}-tensor-${index}-${graphId}`;
        const portId = `${nodeId}-in`;
        const node: AstgrTensorNode = this.createCastNode (tensor, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'output');

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
     */
    private createOutcastNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        magicToTensorMap: Map<string, Tensor>,
        rawTensorMap: Map<string, RawTensor>,
        rawTensorConsumers: Map<string, PortReference[]>,
        showTensorNodes: boolean,
    ): void {
        if (!actualData.outcasts || !Array.isArray(actualData.outcasts)) {
            return;
        }

        const outcastUnique : Set<string> = new Set<string>();
        for (let outcastIndex = 0; outcastIndex < actualData.outcasts.length; outcastIndex++) {
            const outcast = actualData.outcasts[outcastIndex];
            const tensorMagic = String(Array.isArray(outcast) ? outcast[0] : outcast);

            if (outcastUnique.has(tensorMagic)) {
                continue;
            } else {
                outcastUnique.add(tensorMagic);
            }

            const slotId: any[] = [];
            if (Array.isArray(outcast) && outcast.length > 1) {
                const temp = Array.isArray(outcast[1]) ? outcast[1] : [outcast[1]];
                slotId.push(...temp);
            }

            const uniqueKey = `m${tensorMagic}_s${slotId}`;
            if (outcastUnique.has(uniqueKey)) {
                continue;
            } else {
                outcastUnique.add(uniqueKey);
            }
            
            // Get the raw tensor ID and then lookup the tensor name
            const tensor = magicToTensorMap.get(tensorMagic);
            const rawTensor = rawTensorMap.get(String(tensor!.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get raw tensor magic.` : '无法获取raw tensor magic')
            }
            let tensorName = rawTensor?.symbol || "Out";

            tensorName = `${tensorMagic} ${tensorName} (${rawTensor!.rawmagic})`

            let graphId = tensor?.subgraphid ?? -1;
            let nodeId = `tensor-${tensorMagic}-${graphId}`;
            // check duplicate Nodes
            if (this.nodeSet.has(nodeId)) {
                graphId = -2;
                nodeId = `tensor-${tensorMagic}-${graphId}`;
                this.nodeSet.add(nodeId);
                if (!this.isErrorReport) {
                    this.isErrorReport = true;
                }
            }
            const portId = `tensor-${tensorMagic}-${graphId}-in`;
            const outPortId = `tensor-${tensorMagic}-${graphId}-out`;
            const outPort: AstgrPort = {type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8}};

            const node: AstgrTensorNode = this.createCastNode(tensor!, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'output');
            node.children!.push(outPort);
            if (actualData.inouttensors) {
                nodes.push(node);
                this.createParentOutCastNodes(actualData, nodes, edges, outcastIndex, outPortId);
            } else {
                nodes.push(node);
            }

            if (showTensorNodes) {
                // Connect to tensor node's output port
                const tensorPort = portMap.get(`consumer-${tensorMagic}`);
                if (tensorPort) {
                    portMap.set(`consumer-${tensorMagic}`, { nodeId, portId });
                }

            } else {
                // Register outcast as consumer for direct connections
                const rawTensorId = `${rawTensor!.rawmagic}`;
                if (rawTensorId) {
                    portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId });
                    
                    if (!rawTensorConsumers.has(rawTensorId)) {
                        rawTensorConsumers.set(rawTensorId, []);
                    }
                    rawTensorConsumers.get(rawTensorId)!.push({ nodeId, portId });
                }
            }
        }
    }

    /**
     * Creates operation nodes (both regular and sync operations)
     */
    private createOperationNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        tensorToRawTensorMap: Map<string, string>,
        rawTensorProducers: Map<string, PortReference[]>,
        rawTensorConsumers: Map<string, PortReference[]>,
        showTensorNodes: boolean,
        showSyncNodes: boolean
    ): void {
        if (!actualData.operations || !Array.isArray(actualData.operations)) {
            return;
        }

        for (let opIndex = 0; opIndex < actualData.operations.length; opIndex++) {
            const op = actualData.operations[opIndex];
            const opId = `operation-magic-${op.opmagic}`;
            
            // Check if this is a synchronization operation
            const isSyncOp = ['SYNC_SRC', 'SYNC_DST', 'BAR.V', 'PHASE1', 'PHASE2'].includes(op.opcode);
            
            if (isSyncOp) {
                if (showSyncNodes) {
                    this.createSyncNode(op, opId, nodes);
                }
                continue;
            }
            
            // Create regular operation node
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes);
        }
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
                    const rawTensor = rawTensorMap.get(String(tensor.rawtensor))!;
                    callInOutTensor.inTensors.push({tensor, rawTensor});
                }
                for (const v of op.ooperands) {
                    const tensor = magicToTensorMap.get(String(v));
                    if (!tensor) {
                        continue;
                    }
                    const rawTensor = rawTensorMap.get(String(tensor.rawtensor))!;
                    callInOutTensor.outTensors.push({tensor, rawTensor});
                }
                this.callInOutMap.set(op.calleehash!, callInOutTensor);
            }
        }

        const dataObj = Object.fromEntries(this.callInOutMap.entries());
        if (this.callInOutTensorMap) {
            this.callInOutTensorMap(dataObj)
        }
    }

    /**
     * Creates a synchronization node
     */
    private createSyncNode(op: Operation, opId: string, nodes: SNode[]): void {
        const syncQueue = op.sync_queue || {};
        
        const labelParts: string[] = [];
        
        if (op.opcode === 'PHASE1' || op.opcode === 'PHASE2') {
            // Phase operations are phase markers
            if (op.latency && op.latency > 0) {
                labelParts.push(`lat: ${op.latency}`);
            }
        } else if (op.opcode === 'BAR.V') {
            labelParts.push(`pipe: ${syncQueue.pipe_id || 0}`);
            if (syncQueue.event_id !== undefined) {
                labelParts.push(`evt: ${syncQueue.event_id}`);
            }
            if (syncQueue.core_type !== undefined) {
                labelParts.push(`core: ${syncQueue.core_type}`);
            }
        } else {
            // SYNC_SRC, SYNC_DST operations
            labelParts.push(`pipe: ${syncQueue.pipe_id || 0}`);
            labelParts.push(`trig: ${syncQueue.trig_pipe || 0}`);
            if (syncQueue.event_id !== undefined) {
                labelParts.push(`evt: ${syncQueue.event_id}`);
            }
            if (syncQueue.gm_buf_id !== undefined) {
                labelParts.push(`gm: ${syncQueue.gm_buf_id}`);
            }
        }
        
        // Add operation magic for identification
        if (op.opmagic) {
            labelParts.push(`#${op.opmagic}`);
        }
        
        const syncNode: AstgrSyncNode = {
            type: 'node:sync',
            role: 'sync',
            id: opId,
            magic: op.opmagic ? String(op.opmagic) : '',
            opcode: op.opcode,
            pipeId: syncQueue.pipe_id,
            trigPipe: syncQueue.trig_pipe,
            eventId: syncQueue.event_id,
            // Add phase number for PHASE operations
            phase: op.opcode === 'PHASE1' ? 1 : (op.opcode === 'PHASE2' ? 2 : undefined),
            // Include additional properties
            latency: op.latency,
            opmagic: op.opmagic ? String(op.opmagic) : undefined,
            coreType: syncQueue.core_type,
            gmBufId: syncQueue.gm_buf_id,
            subgraphId: op.subgraphid,
            layout: 'vbox',
            layoutOptions: {
                hAlign: 'left',
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 8,
                paddingRight: 8,
                minWidth: 250
            },
            children: [
                // Labels compartment with vbox layout
                {
                    type: 'compartment',
                    id: `${opId}-labels-compartment`,
                    layout: 'vbox',
                    layoutOptions: {
                        hAlign: 'left',
                        paddingTop: 0,
                        paddingBottom: 0,
                        paddingLeft: 0,
                        paddingRight: 0
                    },
                    children: [
                        // Main label with larger font for sync operation name
                        {
                            type: 'label',
                            id: `${opId}-label-main`,
                            text: op.opcode,
                            cssClasses: ['sync-main-label'],
                            layoutOptions: {
                                hAlign: 'left',
                                paddingTop: 2,
                                paddingBottom: 2,
                                paddingLeft: 0,
                                paddingRight: 0
                            },
                        } as SLabel,
                        // Single metadata label with all metadata combined
                        ...(labelParts.slice(1).length > 0 ? labelParts.map((part, index) => {
                            const splitedStr = part.split(':');
                            let value = splitedStr[1];
                            if (value && value.length > 32) {
                                value = value.slice(0, 32) + '...';
                            }
                            return {
                                type: 'label',
                                id: `${opId}-label-meta-${index}`,
                                originText: part, // Use pipe separator for compact display
                                text: [splitedStr[0], value].join(':'),
                                cssClasses: ['sync-meta-label'],
                                minZoomLevel: 0.4
                            } as SLabel & MetadataLabel
                        }) : [])
                    ]
                } as SCompartment
            ]
        };
        
        nodes.push(syncNode);
    }

    // 处理 copy 类操作
    private parseCopyOp(labelAttr: string[], reader: AttrReader, isCopyOut: boolean): void {
        reader.readNumber(); // skip isCopyOut flag (already known from opcode)
        const memType = reader.readNumber();
        const memTypeStr = MEMTYPE_MAP[memType] || 'MEM_UNKNOWN';

        const offsetSize = reader.readNumber();
        const offset = parseSymbolicOrIntList(reader, offsetSize, this.version);
        const shape = parseSymbolicOrIntList(reader, offsetSize, this.version);

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
    private parseConvertOp(labelAttr: string[], reader: AttrReader): void {
        const fromMemType = reader.readNumber();
        const toMemType = reader.readNumber();

        const fromStr = MEMTYPE_MAP[fromMemType] || 'MEM_UNKNOWN';
        const toStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

        labelAttr.push(`from: ${fromStr}`);
        labelAttr.push(`to: ${toStr}`);
    }

    // 处理 assemble/view 操作
    private parseAssembleViewOp(labelAttr: string[], reader: AttrReader, isAssemble: boolean): void {
        const toMemType = reader.readNumber();
        const toMemStr = MEMTYPE_MAP[toMemType] || 'MEM_UNKNOWN';

        const offsetSize = reader.readNumber();
        const offset: number[] = [];
        for (let i = 0; i < offsetSize; i++) {
            offset.push(reader.readNumber());
        }

        const dynOffsetSize = reader.readNumber();
        const dynOffsetParse = parseExprList(reader, dynOffsetSize, this.version);

        const dynShapeSize = reader.readNumber();
        const dynShapeParse = parseExprList(reader, dynShapeSize, this.version);

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
     */
    private parseOperationAttr(labelAttr: string[], op: Operation): void {
        const attr = op.attr;
        const opcodeStr = op.opcode.toLowerCase();
    
        if (!Array.isArray(attr) || attr.length < 1) {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `The attribution of operation ${op.opcode} is invalid.` : `op节点${op.opcode}的attr信息无效`)
        }
    
        const reader = new AttrReader(this.server, attr!);
    
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

    /**
     * Creates a regular operation node with input/output ports
     */
    private createRegularOperationNode(
        op: Operation,
        opId: string,
        nodes: SNode[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        tensorToRawTensorMap: Map<string, string>,
        rawTensorProducers: Map<string, PortReference[]>,
        rawTensorConsumers: Map<string, PortReference[]>,
        showTensorNodes: boolean,
        nodeMagic?: string
    ): void {
        // Extract additional information from the operation
        const subgraphId = op.subgraphid !== undefined ? op.subgraphid : -1;
        if (op.opmagic === undefined || typeof op.opmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server,getIDELang() === 'en' ? `Can not get operation ${op.opcode} magic.` : `无法获取op节点${op.opcode}的magic`)
        }

        const opmagic = String(op.opmagic);
        const hasAttrValue = op.attr !== undefined && (Array.isArray(op.attr) && op.attr.length > 0)? true : false;
        let opName = op.opcode === 'CALL'? 'CALL: ' : `TILE_${op.opcode}`;
        const children: (SCompartment | AstgrPort)[] = [];
        opId = opId + `-${subgraphId}`;
        if (op.opcode === 'CALL') {
            let funcName = undefined;
            if ('calleeMap' in this.comGraphData && op.calleehash! in this.comGraphData.calleeMap) {
                funcName = this.comGraphData.calleeMap[op.calleehash!].func_magicname;
            }
            opName += funcName ?? op.func_magicname ?? "Not found function";
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
            const userColor = this.comGraphData.operationColorFunc && this.comGraphData.operationColorFunc(op, this.baseColorList);
            if (userColor) {
                baseColor = userColor;
                lightColor = getLighterColorByHex(baseColor);
            }
        } catch (error) {
            console.error(`Need to use default color, because ${error}`);
        }
        
        const labelParts: string[] = [];
        try {
            const result = this.comGraphData.operationAttrFunc && this.comGraphData.operationAttrFunc(op);
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
                paddingRight: 0
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
        this.createInputPorts(op, opId, children, edges, portMap, tensorToRawTensorMap, rawTensorConsumers, showTensorNodes, nodeMagic);
        // Create output ports
        this.createOutputPorts(op, opId, children, edges, portMap, tensorToRawTensorMap, rawTensorProducers, showTensorNodes, nodeMagic);
        const node: AstgrNode = {
            type: 'node',
            role: 'operation',
            id: opId,
            magic: opmagic,
            hasAttr: hasAttrValue,
            compareType: op.compareType,
            semanticLabel: op.semantic_label?.label ?? '',
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
        if(nodeMagic) {
            this.opIdMap.set(opmagic, opId);
            this.pathNodesSet.add(opmagic);
        }
    }

    /**
     * Creates input ports for an operation node
     */
    private createInputPorts(
        op: Operation,
        opId: string,
        children: (SLabel | SCompartment | AstgrPort)[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        tensorToRawTensorMap: Map<string, string>,
        rawTensorConsumers: Map<string, PortReference[]>,
        showTensorNodes: boolean,
        nodeMagic?: string
    ): void {
        if (!op.ioperands || !Array.isArray(op.ioperands)) {
            return;
        }

        const ioperandsUnique = [...new Set(op.ioperands)];
        const portId = `${opId}-in`;
        if (ioperandsUnique.length > 0) {
            children.push({
                type: 'port',
                id: portId,
                role: 'input',
                size: { width: 8, height: 8 }
            });
        }

        ioperandsUnique.forEach((iop: number, index: number) => {
            const tensorMagic = String(iop);
            if (showTensorNodes) {
                // Connect to producer tensor's output port
                if (!nodeMagic) {
                    const producer = portMap.get(`producer-${tensorMagic}`);
                    if (producer) {
                        edges.push({
                            type: 'edge',
                            id: `edge-${tensorMagic}-to-${opId}-${index}`,
                            sourceId: producer.portId,
                            targetId: portId
                        });
                    }
                } else {
                    let tensorNodeId = this.tensorNodeMap.get(tensorMagic)?.nodeId;
                    edges.push({
                        type: 'edge',
                        id: `edge-${tensorMagic}-to-${opId}-${index}`,
                        // sourceId: `${nodeId}-out`,
                        sourceId: `${tensorNodeId}-out`,
                        targetId: `${opId}-in`
                    });
                }

            } else {
                // For direct connections, collect this consumer for later fan-out processing
                const rawTensorId = tensorToRawTensorMap.get(tensorMagic);
                if (rawTensorId) {
                    if (!rawTensorConsumers.has(rawTensorId)) {
                        rawTensorConsumers.set(rawTensorId, []);
                    }
                    rawTensorConsumers.get(rawTensorId)!.push({ nodeId: opId, portId });
                }
            }
        });
    }

    /**
     * Creates output ports for an operation node
     */
    private createOutputPorts(
        op: Operation,
        opId: string,
        children: (SLabel | SCompartment | AstgrPort)[],
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        tensorToRawTensorMap: Map<string, string>,
        rawTensorProducers: Map<string, PortReference[]>,
        showTensorNodes: boolean,
        nodeMagic?: string
    ): void {
        if (!op.ooperands || !Array.isArray(op.ooperands)) {
            return;
        }

        const ooperandsUnique = [...new Set(op.ooperands)];
        const portId = `${opId}-out`;
        if (ooperandsUnique.length > 0) {
            children.push({
                type: 'port',
                id: portId,
                role: 'output',
                size: { width: 8, height: 8 }
            });
        }

        ooperandsUnique.forEach((oop: number, index: number) => {
            const tensorMagic = String(oop);

            if (showTensorNodes) {
                // Connect to consumer tensor's input port
                if (!nodeMagic) {
                    const consumer = portMap.get(`consumer-${tensorMagic}`);
                    if (consumer) {
                        edges.push({
                            type: 'edge',
                            id: `edge-${opId}-to-${tensorMagic}-${index}`,
                            sourceId: portId,
                            targetId: consumer.portId
                        });
                    }
                } else {
                    let tensorNodeId = this.tensorNodeMap.get(tensorMagic)!.nodeId;
                    edges.push({
                        type: 'edge',
                        id: `edge-${opId}-to-${tensorMagic}-${index}`,
                        sourceId: `${opId}-out`,
                        // targetId: `${nodeId}-in`
                        targetId: `${tensorNodeId}-in`
                    });
                }
            } else {
                // Register this output port as producer for future connections
                const rawTensorId = tensorToRawTensorMap.get(tensorMagic);
                if (rawTensorId) {
                    portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId: opId, portId });
                    
                    if (!rawTensorProducers.has(rawTensorId)) {
                        rawTensorProducers.set(rawTensorId, []);
                    }
                    rawTensorProducers.get(rawTensorId)!.push({ nodeId: opId, portId });
                }
            }
        });
    }

    /**
     * Creates control flow edges for synchronization operations
     */
    private createSyncControlFlowEdges(actualData: FunctionData, nodes: SNode[], edges: SEdge[]): void {
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
        this.createSyncCoordinationEdges(actualData, syncOps, computationalOps, edges);

        // Create coordination edges between phase operations and computational operations
        this.createPhaseCoordinationEdges(phaseOps, computationalOps, edges);
    }

    /**
     * Creates coordination edges between sync operations and computational operations
     */
    private createSyncCoordinationEdges(
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
    private createPhaseCoordinationEdges(
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
                this.hasSameCoordinationScope(phaseOp.op, compOp.op)
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
                    this.hasSameCoordinationScope(phaseOp.op, compOp.op)
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

    /**
     * Determines if two operations should be coordinated together based on their sync_queue properties
     */
    private hasSameCoordinationScope(phaseOp: Operation, compOp: Operation): boolean {
        // PHASE operators (subgraphid: -1) coordinate with computational operations based on pipe_id
        const phasePipeId = phaseOp.sync_queue?.pipe_id ?? 0;
        const compPipeId = compOp.sync_queue?.pipe_id ?? 0;
        
        // PHASE operators with pipe_id 0 coordinate with computational operations with pipe_id 0
        return phasePipeId === compPipeId;
    }

    /**
     * Adds phase grouping information to nodes for layout hints
     */
    private addPhaseGroupingInfo(actualData: FunctionData, nodes: SNode[]): void {
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
}