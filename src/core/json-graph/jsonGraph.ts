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
import { SEdge, SLabel, SNode, SCompartment } from 'sprotty-protocol';
import { AttrReader } from './parseSymbolicAttr';
import { generateColorList, getLighterColorByHex } from '../../color-list';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';
import { Util } from '../../util';
import { getSemanticColor } from '../../process';
import { AstgrNode, AstgrPort, AstgrSyncNode, AstgrTensorNode, CallInOutItems, DATATYPE_MAP,
    ExtendedSModelRoot, FunctionData, MEMTYPE_MAP, Operation, OpReference, PortReference,
    RawTensor, SemanticLab, Tensor } from './jsonGraph.types';
import { addPhaseGroupingInfo, filterSubgraph, createTensorMaps, hasSameCoordinationScope, hasValidStructure, initializeDataStructures, parseAssembleViewOp, parseConvertOp, parseCopyOp, findIncastIndex, findOutcastIndex, removeEmptyNodesForTensor, buildTensorMetadataCompartment, createEmptyNodeWithPort, createTokenNode, getCastNodeState, buildCastMetadataCompartment, buildMetaLabels, buildCallLabels, getCodePath, getCodeLine, extractNestedData, createSyncControlFlowEdges, buildTensorNodeObject, buildTensorNodesObject, createEmptyNodesForSearch } from './utils';

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
    leafBaseColorList: string[];
    leafLightColorList: string[];
    nodeSet = new Set<string>();
    outcastUnique = new Set<string>();
    incastUniqueSingle = new Set<string>();
    emptyNodesList = new Set<string>();
    emptyOutputSet = new Set<string>();
    recordInOutRawId = new Set<string>();
    recordInOutCastMap = new Map<string, string>();
    recordNodeIdMap = new Map<string, string>();
    uniqueKeySet = new Set<string>();
    uniqueTokensSet = new Set<string>();
    isErrorReport = false;
    isDefinedDark = true;
    isLeaf = false;
    isSearch = false;
    comGraphData;
    server;
    callInOutTensorMap: ((data) => any) | undefined;
    callInOutMap = new Map<string, CallInOutItems>();
    mixOpTypeList = ['UNKNOWN', 'AIC', 'AIV0', 'AIV1'];
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
    duplicateMagic = new Set<string>();
    version: string = '2.0';
    diffType?: 'before' | 'after';

    constructor(comGraphData: any, server: any, version: string, callInOutTensorMap?: (data) => any, diffType?: 'before' | 'after') {
        this.comGraphData = comGraphData;
        this.callInOutTensorMap = callInOutTensorMap
        this.server = server;
        this.version = version;
        this.diffType = diffType;
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
            actualData = extractNestedData(funcData);
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

    public setColorConfig(isDark: boolean) {
        this.isDefinedDark = isDark;
        const colorList = generateColorList(360, isDark);
        this.baseColorList = colorList.baseColorList;
        this.lightColorList = colorList.lightColorList;
        const leafColorList = generateColorList(4, isDark);
        this.leafBaseColorList = leafColorList.baseColorList;
        this.leafLightColorList = leafColorList.lightColorList;
    }

    public prepareSprottyGraphData() {

    }

    /**
     * @param {string} key 唯一标识符
     * @returns {boolean} 如果是没有添加返回true，已存在返回false
     */
    public tryAddUnique(key) {
        if (this.uniqueKeySet.has(key)) {
            return false;
        }
        this.uniqueKeySet.add(key);
        return true;
    }

    public createGraphSingleSearch(nodeMagic: string, actualData: FunctionData,
                                    nodes: SNode[], edges: SEdge[], portMap: Map<string, PortReference>,
                                    tensorToRawTensorMap: Map<string, string>, rawTensorProducers: Map<string, PortReference[]>,
                                    rawTensorConsumers: Map<string, PortReference[]>, rawTensorMap: Map<string, RawTensor>,
                                    magicToTensorMap: Map<string, Tensor>, tensorMap: Map<string, { nodeId: string }>,
                                    inoutMap: Map<string, Set<string>>, showTensorNodes: boolean, threeMode: boolean = false,
                                    errNodeList?: any, nodeSearchLevel?: string, wrongRawMagicList?: any
    ) {
        const startNode = nodeMagic.toString();
        const searchLevel = (nodeSearchLevel !== undefined) ? (Number(nodeSearchLevel) + 1) : -1;
        this.createNodeListMap(actualData);
        if (this.opListMap.has(startNode)) {
            // when tensorType is 'operation'
            this.opSearchForward(startNode, actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, searchLevel, wrongRawMagicList);
            this.opSearchBackward(startNode, actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, searchLevel, wrongRawMagicList);
        } else {
            // when tensorType is 'tensor';
            this.tensorSearchForward(startNode, actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, searchLevel, wrongRawMagicList);
            this.tensorSearchBackward(startNode, actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, searchLevel, wrongRawMagicList);
        }
        this.server.setRef('PathNodesSet', { data: Array.from(this.pathNodesSet) });
        createEmptyNodesForSearch(actualData, nodes, edges, showTensorNodes, tensorToRawTensorMap, rawTensorConsumers,
            this.pathNodesSet, this.opListMap, this.outcastUnique, this.tensorNodeMap, this.emptyOutputSet, this.emptyNodesList);
    }

    public createGraphFullNodes(actualData: FunctionData,
        nodes: SNode[], edges: SEdge[], portMap: Map<string, PortReference>,
        tensorToRawTensorMap: Map<string, string>, rawTensorProducers: Map<string, PortReference[]>,
        rawTensorConsumers: Map<string, PortReference[]>, rawTensorMap: Map<string, RawTensor>,
        magicToTensorMap: Map<string, Tensor>, tensorMap: Map<string, { nodeId: string }>,
        inoutMap: Map<string, Set<string>>, showTensorNodes: boolean, showSyncNodes: boolean = false, threeMode: boolean = false,
        errNodeList?: any, wrongRawMagicList?: any
    ) {
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
        this.createOutcastNodes(actualData, nodes, edges, portMap, magicToTensorMap, rawTensorMap, rawTensorConsumers, showTensorNodes, errNodeList, wrongRawMagicList);

        // Create operation nodes
        this.createOperationNodes(actualData, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, showSyncNodes, threeMode, errNodeList);

        // Create token nodes
        for (const tokenMagic of this.uniqueTokensSet) {
            const nodeId = `operation-${tokenMagic}-0-in`;
            const tokenNode = createTokenNode(nodeId, tokenMagic);
            nodes.push(tokenNode);
            const tokenNodeId = nodeId.replace(/-in.*$|-out.*$/, '');
            const outPortId = nodeId.replace(/-in$/, '-out');
            portMap.set(`producer-token-${tokenMagic}`, { nodeId: tokenNodeId, portId: outPortId });
            portMap.set(`consumer-token-${tokenMagic}`, { nodeId: tokenNodeId, portId: nodeId });
        }
    }

    public connectHiddenNodes(rawTensorProducers: Map<string, PortReference[]>, rawTensorConsumers: Map<string, PortReference[]>, edges: SEdge[]) {
        for (const [rawTensorId, producers] of rawTensorProducers.entries()) {
            const consumers = rawTensorConsumers.get(rawTensorId) || [];

            // Connect each producer to each consumer (fan-out)
            for (let prodIndex = 0; prodIndex < producers.length; prodIndex++) {
                const producer = producers[prodIndex];
                for (let consIndex = 0; consIndex < consumers.length; consIndex++) {
                    const consumer = consumers[consIndex];
                    const mat = (s: string) => s.startsWith("tensor-") && s.match(/^tensor-(\d+)/)![1];
                    const same = (a: string, b:string) => mat(a) === mat(b);
                    if (same(producer.portId, consumer.portId) && this.recordInOutRawId.has(rawTensorId)) {
                        continue;
                    }

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

    public deleteMiddleEmptyNodes(nodes: SNode[]): void {
        for (const mid of this.emptyOutputSet) {
            const nodeid = `tensor-${mid}-0`;
            const index = nodes.findIndex(n => n.id === nodeid);
            if (index !== -1) {
                nodes.splice(index, 1);
            }
        }
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
    public createSprottyGraph(funcData: FunctionData, showTensorNodes: boolean = true, showSyncNodes: boolean = false, colorBySubgraph: boolean = false, isDark = true, isLeaf = false,
                              filterSubgraphId?: number, nodeMagic?: string, nodeSearchLevel?: string, threeMode: boolean = false, errNodeList?: any, wrongRawMagicList?: any): ExtendedSModelRoot {
        // Handle potential data structure variations
        let actualData = funcData;
        this.isSearch = nodeMagic ? true : false;
        this.isLeaf = isLeaf && (!threeMode);
        this.setColorConfig(isDark);

        // Check if the data might be nested under a property
        if (!hasValidStructure(funcData)) {
            actualData = extractNestedData(funcData);
        }

        // Initialize data structures
        const { nodes, edges, tensorMap, portMap, rawTensorProducers, rawTensorConsumers } = initializeDataStructures();
        const { rawTensorMap, magicToTensorMap, tensorToRawTensorMap, inoutMap } = createTensorMaps(actualData);

        if (nodeMagic) {
            const searchLevel  = nodeSearchLevel ?? (Number(nodeSearchLevel)> -1 ? nodeSearchLevel : undefined);
            this.createGraphSingleSearch(nodeMagic, actualData, nodes, edges, portMap,
                                         tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                                         magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, searchLevel, wrongRawMagicList);
        } else {
            this.createGraphFullNodes(actualData, nodes, edges, portMap,
                                      tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                                      magicToTensorMap, tensorMap, inoutMap, showTensorNodes, showSyncNodes, threeMode, errNodeList, wrongRawMagicList);
        }

        //record call input output nodes
        this.createCallInOutTensorMap(actualData, rawTensorMap, magicToTensorMap);

        // Create fan-out connections when tensor nodes are hidden
        if (!showTensorNodes) {
            // delete
            this.deleteMiddleEmptyNodes(nodes);
            this.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
        }

        // Create phase grouping information for layout hints
        addPhaseGroupingInfo(actualData, nodes);

        // Create control flow edges for synchronization operations only if sync nodes are shown
        if (showSyncNodes) {
            createSyncControlFlowEdges(actualData, nodes, edges);
        }

        // Apply subgraph filtering if specified
        let filteredNodes = nodes;
        let filteredEdges = edges;

        if (filterSubgraphId !== undefined) {
            [filteredNodes, filteredEdges] = filterSubgraph(filterSubgraphId, nodes, edges);
        }
        // bottom edge 自身不绘制内容，仅作为高亮框(show-node-rect)的载体；
        // 放在 children 末尾使其最后渲染，保证高亮框不被节点遮挡
        const bottomNode: SEdge = {
            type: 'bottom',
            id: 'node-bottom-edge',
            sourceId: '',
            targetId: ''
        };
        return {
            type: 'graph',
            id: 'root',
            children: [...filteredEdges, ...filteredNodes, bottomNode],
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

        const outKeys = new Set(
            actualData.outcasts.map(oc => String(Array.isArray(oc) ? oc[0] : oc))
        );

        for (const ic of actualData.incasts) {
            const m = String(Array.isArray(ic) ? ic[0] : ic);
            if (outKeys.has(m)) {
                this.duplicateMagic.add(m);
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
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.shape' }, this.diffType)
            return;
        }

        if (rawTensor?.rawshape) {
            const rawShapeStr = `[${rawTensor.rawshape.join(',')}]`;
            labelAttr.push(`rawshape: ${rawShapeStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.rawshape' }, this.diffType)
            return;
        }

        // Add offset information if available
        if (tensor?.offset && Array.isArray(tensor.offset) && tensor.offset.length > 0) {
            const offsetStr = `[${tensor.offset.join(',')}]`;
            labelAttr.push(`offset: ${offsetStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.offset' }, this.diffType)
            return;
        }
        // Add datatype information
        if (rawTensor?.datatype !== undefined) {
            const datatypeStr = DATATYPE_MAP[rawTensor.datatype] || `dt${rawTensor.datatype}`;
            labelAttr.push(`datatype: ${datatypeStr}`);
        } else {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'tensor.datatype' }, this.diffType)
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
        showTensorNodes: boolean,
        threeMode: boolean = false,
        errNodeList?: any,
        nodeSearchLevel?: number,
        wrongRawMagicList?: any
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
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, threeMode, startNode, errNodeList);
        }

        const curSearchLevel = nodeSearchLevel ? --nodeSearchLevel : -1;
        if (curSearchLevel === 0) {
            return;
        }

        const ioperands = [...new Set(op.ioperands)];
        for (let incastNode of ioperands) {
            let tensorNodeId = this.tensorNodeMap.get(incastNode.toString())?.nodeId;
            if (this.singlePathNodeSet.has(tensorNodeId!)) {
                continue;
            }
            this.tensorSearchForward(String(incastNode), actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, curSearchLevel, wrongRawMagicList);
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
        showTensorNodes: boolean,
        threeMode: boolean = false,
        errNodeList?: any,
        nodeSearchLevel?: number,
        wrongRawMagicList?: any
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
            this.createRegularOperationNode(op, opId, nodes, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, threeMode, startNode, errNodeList);
        }

        const curSearchLevel = nodeSearchLevel ? --nodeSearchLevel : -1;
        if (curSearchLevel === 0) {
            return;
        }

        const ooperands = [...new Set(op.ooperands)];
        for (let outcastNode of ooperands) {
            let tensorNodeId = this.tensorNodeMap.get(outcastNode.toString())?.nodeId;
            if (this.singlePathNodeSet.has(tensorNodeId!)) {
                continue;
            }
            this.tensorSearchBackward(String(outcastNode), actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, curSearchLevel, wrongRawMagicList);
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
        showTensorNodes: boolean,
        errNodeList?: any
    ): void {
        if (!actualData.incasts || !Array.isArray(actualData.incasts)) {
            return;
        }

        const incastIndex = findIncastIndex(actualData, startNode);
        const slotId: any[] = [];
        if (incastIndex !== undefined) {
            const incast = actualData.incasts[incastIndex];
            if (Array.isArray(incast) && incast.length > 1) {
                const temp = Array.isArray(incast[1]) ? incast[1] : [incast[1]];
                slotId.push(...temp);
            }
        }

        const tensorMagic = tensor.magic.toString();
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'rawTensor.rawmagic' }, this.diffType)
            return;
        }

        const graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;

        if (!this.incastUniqueSingle.has(tensorMagic)) {
            this.incastUniqueSingle.add(tensorMagic);
            this.outcastUnique.add(tensorMagic);
        } else {
            return;
        }

        const uniqueKey = `m${tensorMagic}_s${slotId}_in`;
        if (!this.tryAddUnique(uniqueKey)) {
            return;
        }

        if (this.singlePathNodeSet.has(nodeId)) {
            const new_graphId = -2;
            nodeId = `tensor-${tensorMagic}-${new_graphId}`;
            this.singlePathNodeSet.add(nodeId);
            return;
        }

        let tensorName = rawTensor?.symbol || "In";
        if(this.duplicateMagic.has(tensorMagic)) {
            tensorName = "Middle";
        }
        tensorName = `${tensorName} (${rawTensor!.rawmagic})`
        const portId = `tensor-${tensorMagic}-${graphId}-out`;
        const portIdIn = `tensor-${tensorMagic}-${graphId}-in`;
        const inPort: AstgrPort = { type: 'port', id: portIdIn, role: 'input', size: { width: 8, height: 8 } };

        const node: AstgrTensorNode = this.createCastNode(tensor, rawTensor, nodeId, portId, tensorMagic, tensorName, slotId, 'input', errNodeList);

        node.children!.push(inPort);
        this.singlePathNodeSet.add(nodeId);
        this.pathNodesSet.add(tensorMagic);
        if (actualData.inouttensors) {
            nodes.push(node);
            this.createParentIncastNodes(actualData, nodes, edges, incastIndex, portIdIn);
        } else {
            nodes.push(node);
        }
        this.registerIncastPortMapping(tensorMagic, rawTensor!, nodeId, portId, showTensorNodes, portMap, rawTensorProducers);
    }

    private registerIncastPortMapping(
        tensorMagic: string,
        rawTensor: RawTensor,
        nodeId: string,
        portId: string,
        showTensorNodes: boolean,
        portMap: Map<string, PortReference>,
        rawTensorProducers: Map<string, PortReference[]>
    ): void {
        if (showTensorNodes) {
            portMap.set(`producer-${tensorMagic}`, { nodeId, portId });
        } else {
            const rawTensorId = `${rawTensor.rawmagic}`;
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
        showTensorNodes: boolean,
        errNodeList?: any,
        wrongRawMagicList?: any
    ): void {
        if (!actualData.outcasts || !Array.isArray(actualData.outcasts)) {
            return;
        }

        const outcastIndex = findOutcastIndex(actualData, startNode);
        const slotId: any[] = [];
        if (outcastIndex !== undefined) {
            const outcast = actualData.outcasts[outcastIndex];
            if (Array.isArray(outcast) && outcast.length > 1) {
                const temp = Array.isArray(outcast[1]) ? outcast[1] : [outcast[1]];
                slotId.push(...temp);
            }
        }

        const tensorMagic = tensor.magic.toString();
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOutcastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'rawTensor.rawmagic' }, this.diffType);
            return;
        }

        removeEmptyNodesForTensor(nodes, tensorMagic);

        if (!this.outcastUnique.has(tensorMagic)) {
            this.outcastUnique.add(tensorMagic);
        } else {
            return;
        }

        const uniqueKey = `m${tensorMagic}_s${slotId}_out`;
        if (!this.tryAddUnique(uniqueKey)) {
            return;
        }

        let graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;
        if (this.singlePathNodeSet.has(nodeId)) {
            graphId = -2;
            nodeId = `tensor-${tensorMagic}-${graphId}`;
            this.singlePathNodeSet.add(nodeId);
            return;
        }

        let tensorName = rawTensor?.symbol || "Out";
        if(this.duplicateMagic.has(tensorMagic)) {
            tensorName = "Middle";
        }

        tensorName = `${tensorName} (${rawTensor!.rawmagic})`
        const portId = `tensor-${tensorMagic}-${graphId}-in`;
        const outPortId = `tensor-${tensorMagic}-${graphId}-out`;
        const outPort: AstgrPort = { type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8 } };

        const node: AstgrTensorNode = this.createCastNode(tensor, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'output', errNodeList, wrongRawMagicList);
        node.children!.push(outPort);
        this.singlePathNodeSet.add(nodeId);
        this.pathNodesSet.add(tensorMagic);

        if (actualData.inouttensors) {
            nodes.push(node);
            this.createParentOutCastNodes(actualData, nodes, edges, outcastIndex, outPortId);
        } else {
            nodes.push(node);
        }

        this.registerOutcastPortMapping(tensorMagic, rawTensor!, nodeId, portId, showTensorNodes, portMap, rawTensorConsumers);
    }

    private registerOutcastPortMapping(
        tensorMagic: string,
        rawTensor: RawTensor,
        nodeId: string,
        portId: string,
        showTensorNodes: boolean,
        portMap: Map<string, PortReference>,
        rawTensorConsumers: Map<string, PortReference[]>
    ): void {
        if (showTensorNodes) {
            portMap.set(`consumer-${tensorMagic}`, { nodeId, portId });
        } else {
            const rawTensorId = `${rawTensor.rawmagic}`;
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
        showTensorNodes: boolean,
        threeMode: boolean = false,
        errNodeList?: any,
        nodeSearchLevel?: number,
        wrongRawMagicList?: any
    ) {
        const castNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors![castNodeIndex!];
        if (actualData.incasts?.some((t) => t[0] === Number(startNode))) {
            this.createIncastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes, errNodeList);
        } else if (actualData.outcasts?.some(([n]) => n === Number(startNode))) {
            this.createOutcastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes, errNodeList, wrongRawMagicList);
        } else {
            this.createTensorNode(startNode, tensor, actualData, nodes, portMap, rawTensorMap, inoutMap, errNodeList);
        }

        const curSearchLevel = nodeSearchLevel ? --nodeSearchLevel : -1;
        if (curSearchLevel === 0) {
            return;
        }

        if (!this.tensor2opMap.get(startNode.toString())) {
            return;
        }

        const inOpList = this.tensor2opMap.get(startNode.toString())?.inOp;

        for (let op of inOpList!) {
            this.opSearchForward(op.toString(), actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, curSearchLevel);
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
        showTensorNodes: boolean,
        threeMode: boolean = false,
        errNodeList?: any,
        nodeSearchLevel?: number,
        wrongRawMagicList?: any
    ) {
        const castNodeIndex = this.tensorListMap.get(startNode);
        const tensor = actualData.tensors![castNodeIndex!];
        if (actualData.outcasts?.some(([n]) => n === Number(startNode))) {
            this.createOutcastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes, errNodeList, wrongRawMagicList);
        } else if (actualData.incasts?.some((t) => t[0] === Number(startNode))) {
            this.createIncastNode(startNode, tensor, actualData, nodes, edges, portMap, rawTensorProducers, rawTensorMap, showTensorNodes, errNodeList);
        } else {
            this.createTensorNode(startNode, tensor, actualData, nodes, portMap, rawTensorMap, inoutMap, errNodeList);
        }

        const curSearchLevel = nodeSearchLevel ? --nodeSearchLevel : -1;
        if (curSearchLevel === 0) {
            return;
        }

        if (!this.tensor2opMap.get(startNode.toString())) {
            return;
        }

        const outOpList = this.tensor2opMap.get(startNode.toString())?.outOp;

        for (let op of outOpList!) {
            this.opSearchBackward(op.toString(), actualData, nodes, edges, portMap,
                tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, rawTensorMap,
                magicToTensorMap, tensorMap, inoutMap, showTensorNodes, threeMode, errNodeList, curSearchLevel);
        }
    }

    private reportTensorParseError(messageKey: string, tensor: Tensor, argName: string): void {
        BaseGraphMsgHandler.returnError(this.server, `pypto.comGraph.errorMessage.${messageKey}`, {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName }, this.diffType);
    }

    private hasValidTensorMagic(tensor: Tensor, messageKey: string, argName: string): boolean {
        if (tensor.magic === undefined || typeof tensor.magic !== 'number') {
            this.reportTensorParseError(messageKey, tensor, argName);
            return false;
        }
        return true;
    }

    private hasValidRawTensorRef(tensor: Tensor): boolean {
        if ((tensor.rawtensor !== 0) && (!tensor.rawtensor)) {
            this.reportTensorParseError('parseTensorNode', tensor, 'Tensor.rawtensor');
            return false;
        }
        return true;
    }

    private hasValidRawTensorMagic(rawTensor: RawTensor, tensor: Tensor, messageKey: string): boolean {
        if (rawTensor.rawmagic === undefined || typeof rawTensor.rawmagic !== 'number') {
            this.reportTensorParseError(messageKey, tensor, 'rawTensor.rawmagic');
            return false;
        }
        return true;
    }

    private resolveTensorSymbol(rawTensor: RawTensor): string {
        const symbol = rawTensor?.symbol || 'Tensor';
        return `${symbol} (${rawTensor.rawmagic})`;
    }

    private buildTensorLabelParts(tensor: Tensor, rawTensor: RawTensor): string[] {
        const labelParts: string[] = [];
        try {
            const evalTensor = { ...tensor };
            evalTensor.rawtensor = rawTensor;
            this.getTensorCommonAttr(labelParts, tensor, rawTensor);
        } catch (error) {
            this.getTensorCommonAttr(labelParts, tensor, rawTensor);
        }
        return labelParts;
    }

    private buildTensorPorts(nodeId: string): { inputPort: AstgrPort; outputPort: AstgrPort } {
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
        return { inputPort, outputPort };
    }

    private registerTensorPorts(
        portMap: Map<string, PortReference>,
        nodeId: string,
        tensorMagic: string,
        rawTensorId: string,
        inputPort: AstgrPort,
        outputPort: AstgrPort
    ): void {
        // Register ports in portMap
        portMap.set(`producer-${tensorMagic}`, { nodeId, portId: outputPort.id });
        portMap.set(`consumer-${tensorMagic}`, { nodeId, portId: inputPort.id });

        // Also register by rawtensor ID for consistency
        portMap.set(`producer-rawtensor-${rawTensorId}`, { nodeId, portId: outputPort.id });
        portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId: inputPort.id });
    }

    private removeEmptyTensorNodes(nodes: SNode[], tensorMagic: string): void {
        for (let index = nodes.length - 1; index >= 0; index--) {
            if (nodes[index].id?.includes(tensorMagic) && nodes[index].id?.endsWith('empty')) {
                nodes.splice(index, 1);
            }
        }
    }

    private createTensorNode(
        startNode: string,
        tensor: Tensor,
        actualData: FunctionData,
        nodes: SNode[],
        portMap: Map<string, PortReference>,
        rawTensorMap: Map<string, RawTensor>,
        inoutMap: Map<string, Set<string>>,
        errNodeList?: any
    ): void {
        if (!actualData.tensors || !Array.isArray(actualData.tensors)) {
            return;
        }

        if (!this.hasValidTensorMagic(tensor, 'parseIncastNode', 'tensor.magic')) {
            return;
        }

        const tensorMagic = String(tensor.magic);
        const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
        if (!this.hasValidRawTensorMagic(rawTensor!, tensor, 'parseIncastNode')) {
            return;
        }

        const symbol = this.resolveTensorSymbol(rawTensor!);

        const graphId = tensor?.subgraphid ?? -1;
        const tensorColors = this.getTensorNodeColors(graphId, tensor, errNodeList);

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
        const labelParts = this.buildTensorLabelParts(tensor, rawTensor!);

        // Create ports for the tensor node
        const { inputPort, outputPort } = this.buildTensorPorts(nodeId);

        const isIncast = inoutMap.get('incasts')?.has(tensorMagic) ?? false;
        const isOutcast = inoutMap.get('outcasts')?.has(tensorMagic) ?? false;
        if (tensor.nodetype === 0 && !isIncast && !isOutcast) {
            this.removeEmptyTensorNodes(nodes, tensorMagic);
            this.outcastUnique.add(tensorMagic);
            const tensorNode = buildTensorNodeObject(nodeId, tensor, tensorMagic, symbol, graphId, tensorColors, labelParts, inputPort, outputPort);
            nodes.push(tensorNode);
            this.singlePathNodeSet.add(nodeId);
            this.pathNodesSet.add(tensorMagic);
        }

        this.registerTensorPorts(portMap, nodeId, tensorMagic, String(tensor.rawtensor), inputPort, outputPort);
    }

    private getTensorNodeColors(graphId: number, tensor: Tensor, errNodeList?: any): { baseColor: string; lightColor: string } {
        let baseColor = graphId >= 0 ? this.baseColorList[graphId % 360] : `var(--devui-tensor-node-base-color)`;
        let lightColor = graphId >= 0 ? this.lightColorList[graphId % 360] : `var(--devui-tensor-node-light-color)`;
        if (errNodeList?.has(tensor.magic)) {
            baseColor = 'rgba(231, 67, 74, 1)';
            lightColor = 'rgba(250, 189, 193, 1)';
        }
        return { baseColor, lightColor };
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
            if (!this.hasValidTensorMagic(tensor, 'parseTensorNode', 'Tensor.magic')) {
                return;
            }

            const tensorMagic = String(tensor.magic);
            if (!this.hasValidRawTensorRef(tensor)) {
                return;
            }
            const rawTensor = rawTensorMap.get(String(tensor.rawtensor));
            if (!this.hasValidRawTensorMagic(rawTensor!, tensor, 'parseTensorNode')) {
                return;
            }

            const symbol = this.resolveTensorSymbol(rawTensor!);

            // Create more detailed label information
            const labelParts = this.buildTensorLabelParts(tensor, rawTensor!);
            const graphId = tensor?.subgraphid ?? -1;
            const tensorColors = this.getTensorNodeColors(graphId, tensor, errNodeList);
            const isError = errNodeList?.has(tensor.magic);

            let nodeId = `tensor-${tensorMagic}-${graphId}`;
            tensorMap.set(tensorMagic, { nodeId });

            // Create ports for the tensor node
            const { inputPort, outputPort } = this.buildTensorPorts(nodeId);

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
                const tensorNode = buildTensorNodesObject(nodeId, tensor, tensorMagic, symbol, graphId, tensorColors, isError, labelParts, inputPort, outputPort);
                this.nodeSet.add(nodeId);
                nodes.push(tensorNode);
            }

            this.registerTensorPorts(portMap, nodeId, tensorMagic, String(tensor.rawtensor), inputPort, outputPort);
        }
    }

    /**
     * Create a cast Node
     */
    private createCastNode(tensor: Tensor, rawTensor: RawTensor | undefined,
        nodeId: string, portId: string, tensorMagic: string, tensorName: string, slotId: string[],
        nodeRole: "operation" | "tensor" | "input" | "output" | "sync", errNodeList?: any, wrongRawMagicList?: any): AstgrTensorNode {
        // Create metadata parts for the tensor
        const metadataParts: string[] = [];
        try {
            const evalTensor = { ...tensor };
            evalTensor.rawtensor = rawTensor;
            this.getTensorCommonAttr(metadataParts, tensor!, rawTensor!);
        } catch (error) {
            this.getTensorCommonAttr(metadataParts, tensor!, rawTensor!);
        }
        // 判断节点是否有错误信息
        const castNodeState = getCastNodeState(tensor, rawTensor, nodeRole, errNodeList, wrongRawMagicList);
        const isMiddle = tensorName.includes('Middle');
        const node: AstgrTensorNode = {
            type: 'node:tensor',
            id: nodeId,
            compareType: tensor.compareType!,
            semanticLabel: tensor.semantic_label?.label ?? '',
            magic: `${tensorMagic}`,
            role: nodeRole,
            baseColor: castNodeState.baseColor,
            lightColor: castNodeState.lightColor,
            isError: castNodeState.isError,
            isMiddle: isMiddle,
            isAccuracyError: castNodeState.isAccuracyError,
            isAccuracyException: castNodeState.isAccuracyException,
            rawMagic: String(rawTensor?.rawmagic),
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
                        ...(metadataParts.length > 0 ? [buildCastMetadataCompartment(nodeId, nodeRole, metadataParts)] : [])
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

        for (let incastIndex = 0; incastIndex < actualData.incasts.length; incastIndex++) {
            const incast = actualData.incasts[incastIndex];
            const tensorMagic = String(Array.isArray(incast) ? incast[0] : incast);

            const slotId: any[] = [];
            if (Array.isArray(incast) && incast.length > 1) {
                const temp = Array.isArray(incast[1]) ? incast[1] : [incast[1]]
                slotId.push(...temp);
            }

            const uniqueKey = `m${tensorMagic}_s${slotId}_in`;
            if (!this.tryAddUnique(uniqueKey)) {
                continue;
            }

            const tensor = magicToTensorMap.get(tensorMagic);
            if (!tensor) {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'tensor.magic' }, this.diffType);
                return;
            }
            if ((tensor.rawtensor !== 0) && (!tensor.rawtensor)) {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseTensorNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensor.magic, argName: 'Tensor.rawtensor' }, this.diffType);
                return;
            }
            const rawTensor = rawTensorMap.get(String(tensor!.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseIncastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'rawTensor.rawmagic' }, this.diffType);
                return;
            }
            let tensorName = rawTensor?.symbol || "In";
            tensorName = `${tensorName} (${rawTensor!.rawmagic})`
            const graphId = tensor?.subgraphid ?? -1;
            let nodeId = `tensor-${tensorMagic}-${graphId}`;
            const portId = `tensor-${tensorMagic}-${graphId}-out`;
            const portIdIn = `tensor-${tensorMagic}-${graphId}-in`;

            this.recordInOutCastMap.set(tensorMagic, portId);
            this.recordNodeIdMap.set(tensorMagic, nodeId);
            const inPort: AstgrPort = { type: 'port', id: portIdIn, role: 'input', size: { width: 8, height: 8 } };

            const node: AstgrTensorNode = this.createCastNode(tensor!, rawTensor, nodeId, portId, tensorMagic, tensorName, slotId, 'input', errNodeList);

            node.children!.push(inPort);
            this.nodeSet.add(nodeId);

            this.pushIncastNode(actualData, nodes, edges, incastIndex, node, portIdIn);
            this.registerIncastPorts(showTensorNodes, portMap, tensorMagic, rawTensor, nodeId, portId, rawTensorProducers);
        }
    }

    private pushIncastNode(
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        incastIndex: number,
        node: AstgrTensorNode,
        portIdIn: string
    ): void {
        if (actualData.inouttensors) {
            nodes.push(node);
            this.createParentIncastNodes(actualData, nodes, edges, incastIndex, portIdIn);
        } else {
            nodes.push(node);
        }
    }

    private registerIncastPorts(
        showTensorNodes: boolean,
        portMap: Map<string, PortReference>,
        tensorMagic: string,
        rawTensor: RawTensor | undefined,
        nodeId: string,
        portId: string,
        rawTensorProducers: Map<string, PortReference[]>
    ): void {
        if (showTensorNodes) {
            const tensorPort = portMap.get(`producer-${tensorMagic}`);
            if (tensorPort) {
                portMap.set(`producer-${tensorMagic}`, { nodeId, portId });
            }
        } else {
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

    private createParentIncastNodes(
        actualData: FunctionData,
        nodes: SNode[],
        edges: any[],
        index,
        inPortId,
    ): void {
        if (index >= actualData.inouttensors!.inTensors.length) {
            return;
        }
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
        errNodeList?: any,
        wrongRawMagicList?: any
    ): void {
        if (!actualData.outcasts || !Array.isArray(actualData.outcasts)) {
            return;
        }
        let parentIndex = 0;
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

            const uniqueKey = `m${tensorMagic}_s${slotId}_out`;
            if (!this.tryAddUnique(uniqueKey)) {
                continue;
            }

            // Get the raw tensor ID and then lookup the tensor name
            const tensor = magicToTensorMap.get(tensorMagic);
            if (!tensor) {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOutcastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'tensor.magic' }, this.diffType);
                return;
            }
            const rawTensor = rawTensorMap.get(String(tensor!.rawtensor));
            if (rawTensor!.rawmagic === undefined || typeof rawTensor!.rawmagic !== 'number') {
                BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOutcastNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: tensorMagic, argName: 'rawTensor.rawmagic' }, this.diffType);
                return;
            }
            let tensorName = rawTensor?.symbol || "Out";
            if (this.recordInOutCastMap.get(tensorMagic)) {
                tensorName = "Middle";
            }

            tensorName = `${tensorName} (${rawTensor!.rawmagic})`

            const nodeInfo = this.resolveOutcastNodeIds(tensor, tensorMagic, tensorName, nodes);
            const portId = nodeInfo.portId;
            const nodeId = nodeInfo.nodeId;
            const outPortId = nodeInfo.outPortId;

            const outPort: AstgrPort = { type: 'port', id: outPortId, role: 'output', size: { width: 8, height: 8 } };

            const node: AstgrTensorNode = this.createCastNode(tensor!, rawTensor, nodeId, portId, tensorMagic.toString(), tensorName, slotId, 'output', errNodeList, wrongRawMagicList);

            node.children!.push(outPort);
            parentIndex = this.pushOutcastNode(actualData, nodes, edges, node, tensorMagic, parentIndex, outPortId);

            this.registerOutcastPorts(showTensorNodes, portMap, tensorMagic, rawTensor, nodeId, portId, rawTensorConsumers);
        }
    }

    private resolveOutcastNodeIds(
        tensor: Tensor | undefined,
        tensorMagic: string,
        tensorName: string,
        nodes: SNode[]
    ): { graphId: number; nodeId: string; portId: string; outPortId: string } {
        let graphId = tensor?.subgraphid ?? -1;
        let nodeId = `tensor-${tensorMagic}-${graphId}`;
        // check duplicate Nodes
        if (this.nodeSet.has(nodeId) && !tensorName.startsWith("Middle")) {
            graphId = -2;
            nodeId = `tensor-${tensorMagic}-${graphId}`;
            this.nodeSet.add(nodeId);
            if (!this.isErrorReport) {
                this.isErrorReport = true;
            }
        }
        const portId = `tensor-${tensorMagic}-${graphId}-in`;
        let outPortId = `tensor-${tensorMagic}-${graphId}-out`;
        const rePid = this.recordInOutCastMap.get(tensorMagic);
        const repNodeId = this.recordNodeIdMap.get(tensorMagic);
        if (rePid != null && repNodeId != null) {
            outPortId = rePid;
            nodeId = repNodeId;
            const index = nodes.findIndex(node => node.id === nodeId);
            if (index !== -1) {
                nodes.splice(index, 1);
            }
        }
        return { graphId, nodeId, portId, outPortId };
    }

    private pushOutcastNode(
        actualData: FunctionData,
        nodes: SNode[],
        edges: SEdge[],
        node: AstgrTensorNode,
        tensorMagic: string,
        parentIndex: number,
        outPortId: string
    ): number {
        if (actualData.inouttensors) {
            nodes.push(node);
            if (!this.recordInOutCastMap.get(tensorMagic)) {
                this.createParentOutCastNodes(actualData, nodes, edges, parentIndex, outPortId);
                parentIndex++;
            }
        } else {
            nodes.push(node);
        }
        return parentIndex;
    }

    private registerOutcastPorts(
        showTensorNodes: boolean,
        portMap: Map<string, PortReference>,
        tensorMagic: string,
        rawTensor: RawTensor | undefined,
        nodeId: string,
        portId: string,
        rawTensorConsumers: Map<string, PortReference[]>
    ): void {
        if (showTensorNodes) {
            const tensorPort = portMap.get(`consumer-${tensorMagic}`);
            if (tensorPort) {
                portMap.set(`consumer-${tensorMagic}`, { nodeId, portId });
            }
        } else {
            const rawTensorId = `${rawTensor!.rawmagic}`;
            if (rawTensorId) {
                portMap.set(`consumer-rawtensor-${rawTensorId}`, { nodeId, portId });
                if (!rawTensorConsumers.has(rawTensorId)) {
                    rawTensorConsumers.set(rawTensorId, []);
                }
                rawTensorConsumers.get(rawTensorId)!.push({ nodeId, portId });
                if (this.recordInOutCastMap.has(tensorMagic)) {
                    this.recordInOutRawId.add(rawTensorId);
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
            // Collect unique tokens from itokens into uniqueTokensSet
            if (op.itokens && Array.isArray(op.itokens) && op.itokens.length > 0) {
                for (const token of op.itokens) {
                    this.uniqueTokensSet.add(String(token));
                }
            }
            // Collect unique tokens from otokens into uniqueTokensSet
            if (op.otokens && Array.isArray(op.otokens) && op.otokens.length > 0) {
                for (const token of op.otokens) {
                    this.uniqueTokensSet.add(String(token));
                }
            }

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
                    if (op.ooperands.includes(v)) {
                        continue;
                    }
                    const tensor = magicToTensorMap.get(String(v));
                    if (!tensor) {
                        continue;
                    }
                    const rawTensor = rawTensorMap.get(String(tensor.rawtensor))!;
                    callInOutTensor.inTensors.push({ tensor, rawTensor });
                }
                for (const o of op.ooperands) {
                    if (op.ioperands.includes(o)) {
                        continue;
                    }
                    const tensor = magicToTensorMap.get(String(o));
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
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseOperationAttr', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'magic', value: op.opmagic, argName: 'op.attr' }, this.diffType);
            return;
        }

        const reader = new AttrReader(this.server, attr!);

        switch (opcodeStr) {
            case 'copy_in':
                parseCopyOp(labelAttr, reader, false, this.version, this.diffType);
                break;
            case 'copy_out':
                parseCopyOp(labelAttr, reader, true, this.version, this.diffType);
                break;
            case 'convert':
                parseConvertOp(labelAttr, reader, this.diffType);
                break;
            case 'assemble':
                parseAssembleViewOp(labelAttr, reader, true, this.version, this.diffType);
                break;
            case 'view':
                parseAssembleViewOp(labelAttr, reader, false, this.version, this.diffType);
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
            BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.parseRegularOperationNode', {}, 'pypto.comGraph.errorLogMessage.parseFail', { funcHash: this.server.comGraphData.funcHash, key: 'opcode', value: op.opcode, argName: 'op.opmagic' }, this.diffType);
            return;
        }

        const opmagic = String(op.opmagic);
        const hasAttrValue = op.attr !== undefined && Array.isArray(op.attr) && op.attr.length > 0;
        let opName = op.opcode === 'CALL' ? 'CALL: ' : `TILE_${op.opcode}`;
        const children: (SCompartment | AstgrPort)[] = [];
        const finalOpId = opId + `-${subgraphId}`;

        if (op.opcode === 'CALL') {
            const funcName = this.getCallFuncName(op);
            opName += funcName;
        }

        const codePath = getCodePath(op);
        const codeLine = getCodeLine(op);

        // Create labels compartment containing main and metadata labels
        const labelChildren: SLabel[] = [
            {
                type: 'label',
                id: `${finalOpId}-label-main`,
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

        const { baseColor, lightColor } = this.getNodeColors(op, subgraphId, threeMode, errNodeList);
        const isError = errNodeList?.has(op.opmagic);

        const labelParts: string[] = [];
        this.buildLabelParts(labelParts, op, hasAttrValue);

        if (labelParts.length > 0) {
            if (op.opcode === 'CALL') {
                labelChildren.push(buildCallLabels(finalOpId, labelParts, subgraphId, opmagic));
            } else {
                labelChildren.push(buildMetaLabels(finalOpId, labelParts, subgraphId, opmagic));
            }
        }

        // Add the labels compartment
        children.push({
            type: 'compartment',
            id: `${finalOpId}-labels-compartment`,
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
        this.createInputPorts(op, finalOpId, children, edges, portMap, tensorToRawTensorMap, rawTensorConsumers, showTensorNodes, nodeMagic);
        // Create output ports
        this.createOutputPorts(op, finalOpId, children, edges, portMap, tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, showTensorNodes, nodes, nodeMagic);
        // create token input ports
        this.createInputTtokens(op, finalOpId, children, edges);
        // Create token output ports
        this.createOutputTtokens(op, finalOpId, children, edges);

        const node: AstgrNode = {
            type: 'node',
            role: 'operation',
            id: finalOpId,
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
            this.opIdMap.set(opmagic, finalOpId);
            this.pathNodesSet.add(opmagic);
        }
    }

    private getCallFuncName(op: Operation): string {
        if ('calleeMap' in this.comGraphData && op.calleehash! in this.comGraphData.calleeMap) {
            return this.comGraphData.calleeMap[op.calleehash!].func_magicname;
        }
        return op.func_magicname ?? 'Not found function';
    }

    private getNodeColors(
        op: Operation,
        subgraphId: number,
        threeMode: boolean,
        errNodeList?: any
    ): { baseColor: string; lightColor: string } {
        let baseColor = subgraphId >= 0 ? this.baseColorList[subgraphId % 360] : 'var(--devui-op-node-base-color)';
        let lightColor = subgraphId >= 0 ? this.lightColorList[subgraphId % 360] : 'var(--devui-op-node-light-color)';

        if (this.isLeaf) {
            const colorIndex = this.mixOpTypeList.indexOf(op.mixSubgraphCore ?? '');
            baseColor = colorIndex >= 0 ? this.leafBaseColorList[colorIndex % 360] : 'var(--devui-op-node-base-color)';
            lightColor = colorIndex >= 0 ? this.leafLightColorList[colorIndex % 360] : 'var(--devui-op-node-light-color)';
        }

        if (threeMode) {
            const semanticColor: SemanticLab = { color: op.semantic_label?.label ?? '' };
            baseColor = getSemanticColor(semanticColor, this.baseColorList, this.lightColorList).dark.base;
            lightColor = getSemanticColor(semanticColor, this.baseColorList, this.lightColorList).dark.light;
        }

        if (errNodeList?.has(op.opmagic)) {
            baseColor = 'rgba(231, 67, 74, 1)';
            lightColor = 'rgba(250, 189, 193, 1)';
        }

        return { baseColor, lightColor };
    }

    private buildLabelParts(labelParts: string[], op: Operation, hasAttrValue: boolean): void {
        if (hasAttrValue) {
            this.parseOperationAttr(labelParts, op);
        }
        if (op.opcode === 'CALL') {
            labelParts.push(`InCast: [${op.ioperands?.join(',') ?? ''}]`);
            labelParts.push(`OutCast: [${op.ooperands?.join(',') ?? ''}]`);
            labelParts.push(`calleehash: ${op.calleehash ?? ''}`);
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
                            targetId: portId,
                            ...((!this.emptyOutputSet.has(tensorMagic) || this.isSearch) ? {} : { cssClasses: ['dashed-edge'] })
                        });
                    }
                } else {
                    let tensorNodeId = this.tensorNodeMap.get(tensorMagic)?.nodeId;
                    edges.push({
                        type: 'edge',
                        id: `edge-${tensorMagic}-to-${opId}-${index}`,
                        // sourceId: `${nodeId}-out`,
                        sourceId: `${tensorNodeId}-out`,
                        targetId: `${opId}-in`,
                        ...((!this.emptyOutputSet.has(tensorMagic) || this.isSearch) ? {} : { cssClasses: ['dashed-edge'] })
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
            const callTargetId = this.createOutputEdge(opId, portId, tensorMagic, index, edges, portMap, showTensorNodes, nodeMagic);

            if (!showTensorNodes) {
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

            this.handleCopyOutOrAssemble(op, tensorMagic, callTargetId, showTensorNodes, tensorToRawTensorMap, rawTensorConsumers, nodes, portId);
        });
    }

    private createOutputEdge(
        opId: string,
        portId: string,
        tensorMagic: string,
        index: number,
        edges: SEdge[],
        portMap: Map<string, PortReference>,
        showTensorNodes: boolean,
        nodeMagic?: string
    ): string | undefined {
        if (!showTensorNodes) {
            return undefined;
        }
        const edgeCssClasses = ((this.outcastUnique.has(tensorMagic) && !this.emptyOutputSet.has(tensorMagic)) || this.isSearch) ? {} : { cssClasses: ['dashed-edge'] };
        if (!nodeMagic) {
            const consumer = portMap.get(`consumer-${tensorMagic}`);
            if (consumer) {
                edges.push({
                    type: 'edge',
                    id: `edge-${opId}-to-${tensorMagic}-${index}`,
                    sourceId: portId,
                    targetId: consumer.portId,
                    ...edgeCssClasses
                });
                return consumer.portId;
            }
        } else {
            const tensorNodeId = this.tensorNodeMap.get(tensorMagic)!.nodeId;
            edges.push({
                type: 'edge',
                id: `edge-${opId}-to-${tensorMagic}-${index}`,
                sourceId: `${opId}-out`,
                targetId: `${tensorNodeId}-in`,
                ...edgeCssClasses
            });
            return `${tensorNodeId}-in`;
        }
        return undefined;
    }

    private handleCopyOutOrAssemble(
        op: Operation,
        tensorMagic: string,
        callTargetId: string | undefined,
        showTensorNodes: boolean,
        tensorToRawTensorMap: Map<string, string>,
        rawTensorConsumers: Map<string, PortReference[]>,
        nodes: SNode[],
        portId: string
    ): void {
        if ((op.opcode !== "COPY_OUT" && op.opcode !== "ASSEMBLE") || this.isSearch) {
            return;
        }
        if (this.outcastUnique.has(tensorMagic)) {
            return;
        }
        const emptyNode: AstgrNode = createEmptyNodeWithPort(callTargetId ? callTargetId : `tensor-${tensorMagic}-0-in`, tensorMagic);
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

    // 创建itoken
    private createInputTtokens(
        op: Operation,
        opId: string,
        children: (SLabel | SCompartment | AstgrPort)[],
        edges: SEdge[]
    ): void {
        if (!op.itokens || !Array.isArray(op.itokens)) {
            return;
        }

        const ioTokensUnique = [...new Set(op.itokens)];
        const portId = `${opId}-in`;

        ioTokensUnique.forEach((iop: string, index: number) => {
            const tokenMagic = String(iop);
            edges.push({
                type: 'edge',
                id: `edge-${tokenMagic}-to-${opId}-${index}`,
                sourceId: `operation-${tokenMagic}-0-out`,
                targetId: portId
            });
        });
    }

    private createOutputTtokens(
        op: Operation,
        opId: string,
        children: (SLabel | SCompartment | AstgrPort)[],
        edges: SEdge[]
    ): void {
        if (!op.otokens || !Array.isArray(op.otokens)) {
            return;
        }

        const oTokensUnique = [...new Set(op.otokens)];
        const portId = `${opId}-out`;

        oTokensUnique.forEach((iop: string, index: number) => {
            const tokenMagic = String(iop);
            edges.push({
                type: 'edge',
                id: `edge-${opId}-${index}-to-${tokenMagic}`,
                sourceId: portId,
                targetId: `operation-${tokenMagic}-0-in`
            });
        });
    }
}