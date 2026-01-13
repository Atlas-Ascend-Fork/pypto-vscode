import { SEdge, SLabel, SNode, SCompartment } from 'sprotty-protocol';
import { AttrReader, parseSymbolicOrIntList, parseExprList } from './parseSymbolicAttr';
import { generateColorList, getLighterColorByHex } from '../../color-list';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';
import { Util } from '../../util';
import { t } from 'i18next';
import { getSemanticColor } from '../../process';
import { AstgrNode, AstgrPort, AstgrSyncNode, AstgrTensorNode, CallInOutItems, DATATYPE_MAP, 
    ExtendedSModelRoot, FunctionData, MEMTYPE_MAP, MetadataLabel, Operation, OpReference, PortReference, 
    RawTensor, SemanticLab, Tensor } from './jsonGraph.types';
import { addPhaseGroupingInfo, createTensorMaps, hasSameCoordinationScope, hasValidStructure, initializeDataStructures, parseAssembleViewOp, parseConvertOp, parseCopyOp } from './utils';

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
    nodeSet = new Set<string>();
    outcastUnique = new Set<string>();
    incastUniqueSingle = new Set<string>();
    emptyNodesList = new Set<string>();
    emptyOutputSet = new Set<string>();
    isErrorReport = false;
    isDefinedDark = true;
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
    tensor2opMap = new Map<string, { inOp: Set<string>; outOp: Set<string> }>(); // opMagic, incast: tensorMagic, outcast: tensorMagic
    tensorNodeMap = new Map<string, { nodeId: string }>();
    opIdMap = new Map<string, string>();
    singlePathNodeSet = new Set<string>();
    pathNodesSet = new Set<string>();
    vscodeConfig: any;
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
        if (!hasValidStructure(funcData)) {
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
                              filterSubgraphId?: number, nodeMagic?: string, threeMode: boolean = false, errNodeList?: any): ExtendedSModelRoot {
        // Handle potential data structure variations
        let actualData = funcData;
        this.isDefinedDark = isDark;
        const colorList = generateColorList(360, isDark);
        this.baseColorList = colorList.baseColorList;
        this.lightColorList = colorList.lightColorList;
        this.vscodeConfig = Util.getComGraphCustomCfg();
        // Check if the data might be nested under a property
        if (!hasValidStructure(funcData)) {
            actualData = this.extractNestedData(funcData);
        }

        // Initialize data structures
        const { nodes, edges, tensorMap, portMap, rawTensorProducers, rawTensorConsumers } = initializeDataStructures();
        const { rawTensorMap, magicToTensorMap, tensorToRawTensorMap, inoutMap } = createTensorMaps(actualData);

        if (nodeMagic) {
            const startNode = nodeMagic.toString();
            this.createNodeListMap(actualData);
            if (this.opListMap.has(startNode)) {
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
                this.createTensorNodes(actualData, nodes, portMap, rawTensorMap, tensorMap, inoutMap, errNodeList);
            } else {
                if (actualData.tensors && Array.isArray(actualData.tensors)) {
                    for (const tensor of actualData.tensors) {
                        const tensorMagic = String(tensor.magic);
                        const isIncast = inoutMap.get('incasts')?.has(tensorMagic) ?? false;
                        const isOutcast = inoutMap.get('outcasts')?.has(tensorMagic) ?? false;
                        if (tensor.nodetype === 0 && !isIncast && !isOutcast) {
                            this.outcastUnique.add(tensorMagic);
                        }
                    }
                }
            }

            // Create input and output nodes
            this.createIncastNodes(actualData, nodes, edges, portMap, magicToTensorMap, rawTensorMap, rawTensorProducers, showTensorNodes, errNodeList);
            this.createOutcastNodes(actualData, nodes, edges, portMap, magicToTensorMap, rawTensorMap, rawTensorConsumers, showTensorNodes, errNodeList);

            // Create operation nodes
            this.createOperationNodes(actualData, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, showSyncNodes, threeMode, errNodeList);
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
                            targetId: consumer.portId,
                            ...(this.emptyNodesList.has(producer.portId) ? { cssClasses: ['dashed-edge'] } : {})
                        });
                    }
                }
            }
        }

        // Create phase grouping information for layout hints
        addPhaseGroupingInfo(actualData, nodes);

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
            sourceId: '',
            targetId: ''
        };
        return {
            type: 'graph',
            id: 'root',
            children: [bottomNode, ...filteredEdges, ...filteredNodes],
            colorBySubgraph, // Add the flag to the root model
            filterSubgraphId // Add the filter setting to the root model
        };
    }

    public createNodeListMap(funcData: FunctionData) {
        let actualData: any = funcData;

        for (let tensorIndex = 0; tensorIndex < actualData.tensors.length; tensorIndex++) {
            const tensormagic = actualData.tensors[tensorIndex].magic.toString();
            const graphId = actualData.tensors[tensorIndex].subgraphid ?? -1;
            this.tensorListMap.set(tensormagic, tensorIndex);
            let nodeId = `tensor-${tensormagic}-${graphId}`;
            this.tensorNodeMap.set(tensormagic, { nodeId });

            if (this.tensor2opMap.get(tensormagic)) {
                this.tensor2opMap.set(tensormagic, { inOp: new Set<string>(), outOp: new Set<string>() });
            }
        }
        for (let opIndex = 0; opIndex < actualData.operations.length; opIndex++) {
            const opmagic = actualData.operations[opIndex].opmagic.toString();
            const ioperands = actualData.operations[opIndex].ioperands;
            const ooperands = actualData.operations[opIndex].ooperands;
            this.opListMap.set(opmagic, opIndex);
            if (!this.op2CastMap.has(opmagic)) {
                this.op2CastMap.set(opmagic, new Map([['incast', [...ioperands]], ['outcast', [...ooperands]]]));
            }
            for (let node of ioperands) {
                if (!this.tensor2opMap.has(node.toString())) {
                    this.tensor2opMap.set(node.toString(), { inOp: new Set<string>(), outOp: new Set<string>() });
                }
                this.tensor2opMap.get(node.toString())!.outOp.add(opmagic);
            }
            for (let node of ooperands) {
                if (!this.tensor2opMap.has(node.toString())) {
                    this.tensor2opMap.set(node.toString(), { inOp: new Set<string>(), outOp: new Set<string>() });
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
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.shape' })
            return;
        }

        if (rawTensor?.rawshape) {
            const rawShapeStr = `[${rawTensor.rawshape.join(',')}]`;
            labelAttr.push(`rawshape: ${rawShapeStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.rawshape' })
            return;
        }

        // Add offset information if available
        if (tensor?.offset && Array.isArray(tensor.offset) && tensor.offset.length > 0) {
            const offsetStr = `[${tensor.offset.join(',')}]`;
            labelAttr.push(`offset: ${offsetStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.offset' })
            return;
        }
        // Add datatype information
        if (rawTensor?.datatype !== undefined) {
            const datatypeStr = DATATYPE_MAP[rawTensor.datatype] || `dt${rawTensor.datatype}`;
            labelAttr.push(`datatype: ${datatypeStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.datatype' })
            return;
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
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, false, startNode);
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
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, false, startNode);
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
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'rawTensor.rawmagic' })
            return;
        }

        const graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;

        if (!this.incastUniqueSingle.has(tensorMagic)) {
            this.incastUniqueSingle.add(tensorMagic);
        } else {
            return;
        }

        const uniqueKey = `m${tensorMagic}_s${slotId}`;
        if (this.incastUniqueSingle.has(uniqueKey)) {
            return;
        } else {
            this.incastUniqueSingle.add(uniqueKey);
        }

        // check duplicate Nodes
        if (this.singlePathNodeSet.has(nodeId)) {
            const new_graphId = -2;
            nodeId = `tensor-${tensorMagic}-${new_graphId}`;
            this.singlePathNodeSet.add(nodeId);
            return;
        }

        let tensorName = rawTensor?.symbol || "In";
        tensorName = `${tensorName} (${rawTensor!.rawmagic})`
        const portId = `tensor-${tensorMagic}-${graphId}-out`;
        const portIdIn = `tensor-${tensorMagic}-${graphId}-in`;
        const inPort: AstgrPort = { type: 'port', id: portIdIn, role: 'input', size: { width: 8, height: 8 } };

        const node: AstgrTensorNode = this.createCastNode(tensor, rawTensor, nodeId, portId, tensorMagic, tensorName, slotId, 'input');

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
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOutcastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'rawTensor.rawmagic' });
            return;
        }

        for (let index = nodes.length - 1; index >= 0; index--) {
            if(nodes[index].id?.includes(tensorMagic) && nodes[index].id?.endsWith('empty')){
                nodes.splice(index, 1);
            }
        }

        if (!this.outcastUnique.has(tensorMagic)) {
            this.outcastUnique.add(tensorMagic);
        } else {
            return;
        }

        const uniqueKey = `m${tensorMagic}_s${slotId}`;
        if (this.outcastUnique.has(uniqueKey)) {
            return;
        } else {
            this.outcastUnique.add(uniqueKey);
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
        tensorName = `${tensorName} (${rawTensor!.rawmagic})`
        const portId = `tensor-${tensorMagic}-${graphId}-in`;
        const outPortId = `tensor-${tensorMagic}-${graphId}-out`;
        const outPort: AstgrPort = { type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8 } };

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
        showTensorNodes: boolean) {
        const castNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors![castNodeIndex!];
        if (actualData.incasts?.some((t) => t[0] === Number(startNode))) {
            this.createIncastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else if (actualData.outcasts?.some(([n]) => n === Number(startNode))) {
            this.createOutcastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else {
            this.createTensorNode(startNode, tensor, actualData, nodes, portMap, rawTensorMap, inoutMap);
        }

        if (!this.tensor2opMap.get(startNode.toString())) {
            return;
        }
        const inOpList = this.tensor2opMap.get(startNode.toString())?.inOp;

        for (let op of inOpList!) {
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
        showTensorNodes: boolean) {
        const castNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors![castNodeIndex!];
        if (actualData.outcasts?.some(([n]) => n === Number(startNode))) {
            this.createOutcastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else if (actualData.incasts?.some((t) => t[0] === Number(startNode))) {
            this.createIncastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes);
        } else {
            this.createTensorNode(startNode, tensor, actualData, nodes, portMap, rawTensorMap, inoutMap);
        }

        if (!this.tensor2opMap.get(startNode.toString())) {
            return;
        }

        const outOpList = this.tensor2opMap.get(startNode.toString())?.outOp;

        for (let op of outOpList!) {
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
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.magic' });
            return;
        }

        const tensorMagic = String(tensor.magic);
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'rawTensor.rawmagic' });
            return;
        }

        let symbol = rawTensor?.symbol || "Tensor";
        symbol = `${symbol} (${rawTensor!.rawmagic})`;

        const graphId = tensor?.subgraphid ?? -1;
        let baseColor = graphId >= 0 ? this.baseColorList[graphId % 360] : `var(--devui-tensor-node-base-color)`;
        let lightColor = graphId >= 0 ? this.lightColorList[graphId % 360] : `var(--devui-tensor-node-light-color)`;

        try {
            const userColor = this.vscodeConfig?.tensorColorFunc && this.vscodeConfig.tensorColorFunc(tensor, this.baseColorList);
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
            const evalTensor = { ...tensor };
            evalTensor.rawtensor = rawTensor;
            const result = this.vscodeConfig?.tensorAttrFunc && this.vscodeConfig.tensorAttrFunc(evalTensor);
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
            for (let index = nodes.length - 1; index >= 0; index--) {
                if(nodes[index].id?.includes(tensorMagic) && nodes[index].id?.endsWith('empty')){
                    nodes.splice(index, 1);
                }
            }
            this.outcastUnique.add(tensorMagic);
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
        errNodeList: any,
        nodeMagic?: string | undefined
    ): void {
        if (!actualData.tensors || !Array.isArray(actualData.tensors)) {
            return;
        }

        for (const tensor of actualData.tensors) {
            if (tensor.magic === undefined || typeof tensor.magic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseTensorNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'Tensor.magic' });
                return;
            }

            const tensorMagic = String(tensor.magic);
            if (!tensor.rawtensor) {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseTensorNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'Tensor.rawtensor' });
                return;
            }
            const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseTensorNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'rawTensor.rawmagic' });
                return;
            }

            let symbol = rawTensor?.symbol || "Tensor";
            symbol = `${symbol} (${rawTensor!.rawmagic})`;

            // Create more detailed label information
            const labelParts: string[] = [];
            try {
                const evalTensor = { ...tensor };
                evalTensor.rawtensor = rawTensor;
                const result = this.vscodeConfig?.tensorAttrFunc && this.vscodeConfig.tensorAttrFunc(evalTensor);
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
            let isError = false;
            // 判断节点是否有错误信息
            if (errNodeList?.has(tensor.magic)) {
                isError = true;
                baseColor = 'rgba(231, 67, 74, 1)';
                lightColor = 'rgba(250, 189, 193, 1)';
            }
            try {
                const userColor = this.vscodeConfig?.tensorColorFunc && this.vscodeConfig.tensorColorFunc(tensor, this.baseColorList);
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
                this.outcastUnique.add(tensorMagic);
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

    private createEmptyNodeWithPort(nodeId: string, magic: string): AstgrNode {
        const children: (SCompartment | AstgrPort)[] = [];
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
        return {
          type: 'node',
          id:  `${nodeId}-empty`,
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

    /**
     * Create a cast Node
     */
    private createCastNode(tensor: Tensor, rawTensor: RawTensor | undefined,
        nodeId: string, portId: string, tensorMagic: string, tensorName: string, slotId: string[],
        nodeRole: "operation" | "tensor" | "input" | "output" | "sync", errNodeList?: any): AstgrTensorNode {
        // Create metadata parts for the tensor
        const metadataParts: string[] = [];
        try {
            const evalTensor = { ...tensor };
            evalTensor.rawtensor = rawTensor;
            const result = this.vscodeConfig?.tensorAttrFunc && this.vscodeConfig.tensorAttrFunc(evalTensor);
            if (result) {
                metadataParts.push(...result);
            } else {
                this.getTensorCommonAttr(metadataParts, tensor!, rawTensor!);
            }
        } catch (error) {
            this.getTensorCommonAttr(metadataParts, tensor!, rawTensor!);
        }
        // 判断节点是否有错误信息
        let isError = false;
        let baseColor;
        let lightColor;
        if (errNodeList?.has(tensor.magic)) {
            isError = true;
            baseColor = 'rgba(231, 67, 74, 1)';
            lightColor = 'rgba(250, 189, 193, 1)';
        }
        const node: AstgrTensorNode = {
            type: 'node:tensor',
            id: nodeId,
            compareType: tensor.compareType!,
            semanticLabel: tensor.semantic_label?.label ?? '',
            // compareType: compareType,
            magic: `${tensorMagic}`,
            role: nodeRole,
            baseColor: baseColor,
            lightColor: lightColor,
            isError: isError,
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
                    role: (nodeRole === "input") ? 'output' : 'input',
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
        showTensorNodes: boolean,
        errNodeList?: any
    ): void {
        if (!actualData.incasts || !Array.isArray(actualData.incasts)) {
            return;
        }

        const incastUnique: Set<string> = new Set<string> ();
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
            if (!tensor) {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'tensor.magic' });
                return;
            }
            if (!tensor.rawtensor) {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseTensorNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'Tensor.rawtensor' });
                return;
            }
            const rawTensor = rawTensorMap.get(String(tensor!.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'rawTensor.rawmagic' });
                return;
            }
            let tensorName = rawTensor?.symbol || "In";

            tensorName = `${tensorName} (${rawTensor!.rawmagic})`
            const graphId = tensor?.subgraphid ?? -1;
            let nodeId = `tensor-${tensorMagic}-${graphId}`;
            const portId = `tensor-${tensorMagic}-${graphId}-out`;
            const portIdIn = `tensor-${tensorMagic}-${graphId}-in`;

            const inPort: AstgrPort = { type: 'port', id: portIdIn, role: 'input', size: { width: 8, height: 8 } };

            const node: AstgrTensorNode = this.createCastNode(tensor!, rawTensor, nodeId, portId, tensorMagic, tensorName, slotId, 'input', errNodeList);

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
        tensorName = `${tensorName} (${rawTensor.rawmagic})`

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
    ): void {
        const tensor = actualData.inouttensors!.outTensors[index].tensor;
        const rawTensor = actualData.inouttensors!.outTensors[index].rawTensor;
        if (!tensor || !rawTensor) {
            return;
        }
        const tensorMagic = String(tensor.magic);

        const slotId = [];

        // Get the raw tensor ID and then lookup the tensor name
        let tensorName = rawTensor?.symbol || "Out";

        tensorName = `${tensorName} (${rawTensor.rawmagic})`

        const graphId = -1;
        const nodeId = `parent-outcast-${index}-tensor-${index}-${graphId}`;
        const portId = `${nodeId}-in`;
        const node: AstgrTensorNode = this.createCastNode(tensor, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'output');

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
        errNodeList?: any
    ): void {
        if (!actualData.outcasts || !Array.isArray(actualData.outcasts)) {
            return;
        }

        for (let outcastIndex = 0; outcastIndex < actualData.outcasts.length; outcastIndex++) {
            const outcast = actualData.outcasts[outcastIndex];
            const tensorMagic = String(Array.isArray(outcast) ? outcast[0] : outcast);

            if (this.outcastUnique.has(tensorMagic)) {
                continue;
            } else {
                this.outcastUnique.add(tensorMagic);
            }

            const slotId: any[] = [];
            if (Array.isArray(outcast) && outcast.length > 1) {
                const temp = Array.isArray(outcast[1]) ? outcast[1] : [outcast[1]];
                slotId.push(...temp);
            }

            const uniqueKey = `m${tensorMagic}_s${slotId}`;
            if (this.outcastUnique.has(uniqueKey)) {
                continue;
            } else {
                this.outcastUnique.add(uniqueKey);
            }

            // Get the raw tensor ID and then lookup the tensor name
            const tensor = magicToTensorMap.get(tensorMagic);
            if (!tensor) {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOutcastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'tensor.magic' });
                return;
            }
            const rawTensor = rawTensorMap.get(String(tensor!.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOutcastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'rawTensor.rawmagic' });
                return;
            }
            let tensorName = rawTensor?.symbol || "Out";

            tensorName = `${tensorName} (${rawTensor!.rawmagic})`

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
            const outPort: AstgrPort = { type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8 } };

            const node: AstgrTensorNode = this.createCastNode(tensor!, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'output', errNodeList);
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
        showSyncNodes: boolean,
        threeMode: boolean,
        errNodeList: any[]
    ): void {
        if (!actualData.operations || !Array.isArray(actualData.operations)) {
            return;
        }
        for (let opIndex = 0; opIndex < actualData.operations.length; opIndex++) {
            const op = actualData.operations[opIndex];
            const opId = `operation-magic-${op.opmagic}`;

            // Create regular operation node
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, threeMode, undefined, errNodeList);
        }
    }

    private createCallInOutTensorMap(
        actualData: FunctionData,
        rawTensorMap: Map<string, RawTensor>,
        magicToTensorMap: Map<string, Tensor>,
    ): void {
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
                    callInOutTensor.inTensors.push({ tensor, rawTensor });
                }
                for (const v of op.ooperands) {
                    const tensor = magicToTensorMap.get(String(v));
                    if (!tensor) {
                        continue;
                    }
                    const rawTensor = rawTensorMap.get(String(tensor.rawtensor))!;
                    callInOutTensor.outTensors.push({ tensor, rawTensor });
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
     * Parse operation attr by op code and fill into label.
     */
    private parseOperationAttr(labelAttr: string[], op: Operation): void {
        const attr = op.attr;
        const opcodeStr = op.opcode.toLowerCase();

        if (!Array.isArray(attr) || attr.length < 1) {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOperationAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: op.opmagic, argName: 'op.attr' });
            return;
        }

        const reader = new AttrReader(this.server, attr!);

        switch (opcodeStr) {
            case 'copy_in':
                parseCopyOp(labelAttr, reader, opcodeStr === 'copy_in', this.version);
                break;
            case 'copy_out':
                parseCopyOp(labelAttr, reader, opcodeStr === 'copy_out', this.version);
                break;
            case 'convert':
                parseConvertOp(labelAttr, reader);
                break;
            case 'assemble':
                parseAssembleViewOp(labelAttr, reader, opcodeStr === 'assemble', this.version);
                break;
            case 'view':
                parseAssembleViewOp(labelAttr, reader, opcodeStr === 'view', this.version);
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
        threeMode: boolean,
        nodeMagic?: string,
        errNodeList?: any
    ): void {
        // Extract additional information from the operation
        const subgraphId = op.subgraphid !== undefined ? op.subgraphid : -1;
        if (op.opmagic === undefined || typeof op.opmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseRegularOperationNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'opcode', value: op.opcode, argName: 'op.opmagic' });
            return;
        }

        const opmagic = String(op.opmagic);
        const hasAttrValue = op.attr !== undefined && (Array.isArray(op.attr) && op.attr.length > 0) ? true : false;
        let opName = op.opcode === 'CALL' ? 'CALL: ' : `TILE_${op.opcode}`;
        const children: (SCompartment | AstgrPort)[] = [];
        opId = opId + `-${subgraphId}`;
        if (op.opcode === 'CALL') {
            let funcName = undefined;
            if ('calleeMap' in this.comGraphData && op.calleehash! in this.comGraphData.calleeMap) {
                funcName = this.comGraphData.calleeMap[op.calleehash!].func_magicname;
            }
            opName += funcName ?? op.func_magicname ?? "Not found function";
        }

        const codePath = (op.file && op.file !== "" ? op.file : undefined) ?? 
                         (op.semantic_label?.filename && op.semantic_label?.filename !== "" ? op.semantic_label?.filename : undefined);
        const codeLine = (op.line && op.line !== "" ? op.line : undefined) ?? 
                         (op.semantic_label?.lineno && op.semantic_label?.lineno >= 0 ? op.semantic_label?.lineno : undefined);

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
        let isError = false;
        if(threeMode) {
            const semanticColor: SemanticLab = {
                color: op.semantic_label?.label ?? ''
            };
            baseColor  = getSemanticColor(semanticColor, this.baseColorList, this.lightColorList).dark.base;
            lightColor  = getSemanticColor(semanticColor, this.baseColorList, this.lightColorList).dark.light;
        }
        if (errNodeList?.has(op.opmagic)) {
            isError = true;
            baseColor = 'rgba(231, 67, 74, 1)';
            lightColor = 'rgba(250, 189, 193, 1)';
        }

        try {
            const userColor = this.vscodeConfig?.operationColorFunc && this.vscodeConfig.operationColorFunc(op, this.baseColorList);
            if (userColor) {
                baseColor = userColor;
                lightColor = getLighterColorByHex(baseColor);
            }
        } catch (error) {
            console.error(`Need to use default color, because ${error}`);
        }

        const labelParts: string[] = [];
        try {
            const result = this.vscodeConfig?.operationAttrFunc && this.vscodeConfig.operationAttrFunc(op);
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
                labelParts.push(`calleehash: ${op.calleehash}`);
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
        this.createOutputPorts(op, opId, children, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, nodes, nodeMagic);
        const node: AstgrNode = {
            type: 'node',
            role: 'operation',
            id: opId,
            magic: opmagic,
            isError: isError,
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
        if (nodeMagic) {
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
        rawTensorConsumers: Map<string, PortReference[]>,
        showTensorNodes: boolean,
        nodes: SNode[],
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
            let callTargetId; 
            if (showTensorNodes) {
                // Connect to consumer tensor's input port
                if (!nodeMagic) {
                    const consumer = portMap.get(`consumer-${tensorMagic}`);
                    if (consumer) {
                        edges.push({
                            type: 'edge',
                            id: `edge-${opId}-to-${tensorMagic}-${index}`,
                            sourceId: portId,
                            targetId: consumer.portId,
                            ...((this.outcastUnique.has(tensorMagic) && !this.emptyOutputSet.has(tensorMagic)) ? {} : { cssClasses: ['dashed-edge'] })
                        });
                        callTargetId = consumer.portId;
                    }
                } else {
                    let tensorNodeId = this.tensorNodeMap.get(tensorMagic)!.nodeId;
                    edges.push({
                        type: 'edge',
                        id: `edge-${opId}-to-${tensorMagic}-${index}`,
                        sourceId: `${opId}-out`,
                        // targetId: `${nodeId}-in`
                        targetId: `${tensorNodeId}-in`,
                        ...((this.outcastUnique.has(tensorMagic) && !this.emptyOutputSet.has(tensorMagic)) ? {} : { cssClasses: ['dashed-edge'] })
                    });
                    callTargetId = `${tensorNodeId}-in`;
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
                if (this.emptyOutputSet.has(tensorMagic)) {
                    this.emptyNodesList.add(portId);
                }
            }
            
            if (op.opcode === "COPY_OUT" || op.opcode === "ASSEMBLE") {
                const hasOut = this.outcastUnique.has(tensorMagic);
                if (!hasOut) {
                    const emptyNode: AstgrNode = this.createEmptyNodeWithPort(callTargetId ? callTargetId : `tensor-${tensorMagic}-0-in`, tensorMagic);
                    nodes.push(emptyNode);
                    if (!showTensorNodes) {
                        const rawTensorId = tensorToRawTensorMap.get(tensorMagic);
                        if (rawTensorId) {
                            const emptyNodeId = `tensor-${tensorMagic}-0`;
                            const emptyPortId = `tensor-${tensorMagic}-0-in`;
                            if (!rawTensorConsumers.has(rawTensorId)) {
                                rawTensorConsumers.set(rawTensorId, []);
                            }
                            rawTensorConsumers.get(rawTensorId)!.push({ nodeId: emptyNodeId, portId: emptyPortId });
                            this.emptyNodesList.add(portId);
                        }
                    }
                    this.emptyOutputSet.add(tensorMagic);
                    this.outcastUnique.add(tensorMagic);
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
                if (hasValidStructure(nestedData)) {
                    return nestedData;
                }
            }
        }

        return funcData;
    }
}