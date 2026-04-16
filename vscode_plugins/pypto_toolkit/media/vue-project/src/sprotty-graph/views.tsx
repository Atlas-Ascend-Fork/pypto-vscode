/********************************************************************************
 * Copyright (c) 2025 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 ********************************************************************************/

/** @jsx svg */
import {
  IView,
  IViewArgs,
  PolylineEdgeView,
  RectangularNodeView,
  SEdgeImpl,
  SGraphImpl,
  SNodeImpl,
  SShapeElementImpl,
  svg,
  SChildElementImpl,
  SLabelImpl,
  SLabelView,
  ViewportRootElementImpl,
  SCompartmentImpl,
  SCompartmentView
} from 'sprotty';
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';
import { RenderingContext, setAttr, ShapeView, SPortImpl, getAbsoluteBounds } from 'sprotty';
import { Point, Selectable, Hoverable, Dimension, getSubType } from 'sprotty-protocol';
import { AstgrNode, MetadataLabel } from './graph.types';
import { compareJsonData, getTextWidth } from '../utils';
import { comGraphStore } from '../service/com-graph-store';
import { getRectPath } from './animation';

// Extend global window interface to include our coloring flag
declare global {
  interface Window {
    colorBySubgraph?: boolean;
  }
}

interface AstgrViewArgs extends IViewArgs {
  trace: Trace;
}

interface Trace {
  incomingEdges: Set<string>;
  incomingNodes: Set<string>;
  outgoingEdges: Set<string>;
  outgoingNodes: Set<string>;
  // Internal port tracking for logic (not used for visual highlighting)
  incomingPorts: Set<string>;
  outgoingPorts: Set<string>;
}

interface EdgeMap {
  bySource: Map<string, SEdgeImpl[]>;
  byTarget: Map<string, SEdgeImpl[]>;
}

function isEdge(element: SChildElementImpl): boolean {
  if (element.type.includes('edge')) {
    return true;
  }
  return false;
}

function isNode(element: SChildElementImpl): boolean {
  if (element.type.includes('node')) {
    return true;
  }
  return false;
}

function isNodeVisible(element: SShapeElementImpl, context: RenderingContext): boolean {
  if (context.targetKind === 'hidden') {
    return true;
  }

  if (!element.bounds || !Dimension.isValid(element.bounds)) {
    return true;
  }

  // Use Sprotty's getAbsoluteBounds to get proper absolute coordinates
  const absoluteBounds = getAbsoluteBounds(element);
  const canvasBounds = element.root.canvasBounds;

  // Check if the element is within the viewport
  return (
    absoluteBounds.x <= canvasBounds.width &&
    absoluteBounds.x + absoluteBounds.width >= 0 &&
    absoluteBounds.y <= canvasBounds.height &&
    absoluteBounds.y + absoluteBounds.height >= 0
  );
}

// Utility functions for improved tracing algorithm
function createEdgeMap(edges: SEdgeImpl[]): EdgeMap {
  const bySource = new Map<string, SEdgeImpl[]>();
  const byTarget = new Map<string, SEdgeImpl[]>();

  for (const edge of edges) {
    const sourceId = edge.sourceId;
    const targetId = edge.targetId;

    if (!bySource.has(sourceId)) {
      bySource.set(sourceId, []);
    }
    bySource.get(sourceId)!.push(edge);

    if (!byTarget.has(targetId)) {
      byTarget.set(targetId, []);
    }
    byTarget.get(targetId)!.push(edge);
  }

  return { bySource, byTarget };
}

function extractNodeIdFromPort(portId: string): string | null {
  // Port IDs are like "nodeId-in", "nodeId-out", "nodeId-in0", "nodeId-out1"
  if (portId.endsWith('-in') || portId.endsWith('-out')) {
    const lastDashIndex = portId.lastIndexOf('-');
    const beforeDash = portId.substring(0, lastDashIndex);
    const afterDash = portId.substring(lastDashIndex + 1);
    // Check if it's a valid port suffix
    if (afterDash === 'in' || afterDash === 'out' || /^(in|out)\d+$/.test(afterDash)) {
      return beforeDash;
    }
  }
  return null;
}

function traceIncomingElementsOptimized(
  elementId: string,
  edgeMap: EdgeMap,
  trace: Trace,
  visitedNodes: Set<string>,
  model: SGraphImpl,
  context: RenderingContext,
): void {
  const incomingEdges = edgeMap.byTarget.get(elementId) || [];

  for (const edge of incomingEdges) {
    trace.incomingEdges.add(edge.id);
    trace.incomingPorts.add(edge.sourceId); // Add source port to incoming ports
    trace.incomingPorts.add(edge.targetId); // Add target port to incoming ports

    // Extract node ID from port ID
    const nodeId = extractNodeIdFromPort(edge.sourceId);
    if (nodeId && !visitedNodes.has(nodeId)) {
      // Find the node element in the model
      const nodeElement = model.children.find((child) => child.id === nodeId) as SShapeElementImpl;
      if (nodeElement) {
        visitedNodes.add(nodeId);
        trace.incomingNodes.add(nodeId); // Add node to incoming nodes

        // Find all input ports of this node and continue tracing
        const inputPorts: string[] = [];
        for (const [portId] of edgeMap.byTarget) {
          if (portId.startsWith(nodeId + '-in')) {
            inputPorts.push(portId);
          }
        }

        for (const portId of inputPorts) {
          traceIncomingElementsOptimized(portId, edgeMap, trace, visitedNodes, model, context);
        }
      }
    }
  }
}

function traceOutgoingElementsOptimized(
  elementId: string,
  edgeMap: EdgeMap,
  trace: Trace,
  visitedNodes: Set<string>,
  model: SGraphImpl,
  context: RenderingContext,
): void {
  const outgoingEdges = edgeMap.bySource.get(elementId) || [];

  for (const edge of outgoingEdges) {
    trace.outgoingEdges.add(edge.id);
    trace.outgoingPorts.add(edge.sourceId); // Add source port to outgoing ports
    trace.outgoingPorts.add(edge.targetId); // Add target port to outgoing ports

    // Extract node ID from port ID
    const nodeId = extractNodeIdFromPort(edge.targetId);
    if (nodeId && !visitedNodes.has(nodeId)) {
      // Find the node element in the model
      const nodeElement = model.children.find((child) => child.id === nodeId) as SShapeElementImpl;
      if (nodeElement) {
        visitedNodes.add(nodeId);
        trace.outgoingNodes.add(nodeId); // Add node to outgoing nodes

        // Find all output ports of this node and continue tracing
        const outputPorts: string[] = [];
        for (const [portId] of edgeMap.bySource) {
          if (portId.startsWith(nodeId + '-out')) {
            outputPorts.push(portId);
          }
        }

        for (const portId of outputPorts) {
          traceOutgoingElementsOptimized(portId, edgeMap, trace, visitedNodes, model, context);
        }
      }
    }
  }
}

function traceElementsOptimized(elementId: string, edgeMap: EdgeMap, trace: Trace, model: SGraphImpl, context: RenderingContext): void {
  // Get all ports of the selected node
  const inputPorts: string[] = [];
  const outputPorts: string[] = [];

  // Efficiently find all ports for this node
  for (const [portId] of edgeMap.bySource) {
    if (portId.startsWith(elementId + '-in')) {
      inputPorts.push(portId);
    } else if (portId.startsWith(elementId + '-out')) {
      outputPorts.push(portId);
    }
  }

  for (const [portId] of edgeMap.byTarget) {
    if (portId.startsWith(elementId + '-in') && !inputPorts.includes(portId)) {
      inputPorts.push(portId);
    } else if (portId.startsWith(elementId + '-out') && !outputPorts.includes(portId)) {
      outputPorts.push(portId);
    }
  }

  const hasInputPorts = inputPorts.length > 0;
  const hasOutputPorts = outputPorts.length > 0;

  if (!hasInputPorts && hasOutputPorts) {
    // This is an input node - trace outgoing only
    const visitedNodes = new Set<string>();
    for (const portId of outputPorts) {
      traceOutgoingElementsOptimized(portId, edgeMap, trace, visitedNodes, model, context);
    }
  } else if (hasInputPorts && !hasOutputPorts) {
    // This is an output node - trace incoming only
    const visitedNodes = new Set<string>();
    for (const portId of inputPorts) {
      traceIncomingElementsOptimized(portId, edgeMap, trace, visitedNodes, model, context);
    }
  } else if (hasInputPorts && hasOutputPorts) {
    // This is an operation or tensor node with both input/output ports
    const incomingVisited = new Set<string>();
    const outgoingVisited = new Set<string>();

    // Trace incoming from input ports
    for (const portId of inputPorts) {
      traceIncomingElementsOptimized(portId, edgeMap, trace, incomingVisited, model, context);
    }

    // Trace outgoing from output ports
    for (const portId of outputPorts) {
      traceOutgoingElementsOptimized(portId, edgeMap, trace, outgoingVisited, model, context);
    }
  }
}

// Helper functions for trace checking
export function isNodeTraced(nodeId: string, trace: Trace): { incoming: boolean; outgoing: boolean } {
  const nodePortPrefix = nodeId + '-';

  // Check if the node itself is in the trace
  const incoming = trace.incomingNodes.has(nodeId) || Array.from(trace.incomingPorts).some((portId) => portId.startsWith(nodePortPrefix));

  const outgoing = trace.outgoingNodes.has(nodeId) || Array.from(trace.outgoingPorts).some((portId) => portId.startsWith(nodePortPrefix));

  return { incoming, outgoing };
}

function isEdgeTraced(edgeId: string, trace: Trace): { incoming: boolean; outgoing: boolean } {
  return {
    incoming: trace.incomingEdges.has(edgeId),
    outgoing: trace.outgoingEdges.has(edgeId),
  };
}

function passNodeId(nodeId: string, tensorMagicSet: Set<number>, opMagicSet: Set<number>) {

  const TensorNodeIdPrefix = 'tensor-';
  const OperationNodeIdPrefix = 'operation-';
  const MagicPrefix = 'magic-';
  if (nodeId.includes(TensorNodeIdPrefix)) {
    const tensorMagic = parseInt(nodeId.split(TensorNodeIdPrefix)[1]);
    tensorMagicSet.add(tensorMagic);
  }
  if (nodeId.includes(OperationNodeIdPrefix)) {
    let operationMagic = parseInt(nodeId.split(MagicPrefix)[1]);
    opMagicSet.add(operationMagic);
  }
}

@injectable()
export class AstgrGraphView implements IView {
  render(model: Readonly<SGraphImpl>, context: RenderingContext): VNode {
    window['trace'] = {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };

    const selectedNodes = model.children.filter((e) => isNode(e) && (e as SNodeImpl).selected).map((e) => e.id);
    const hoverNodes = model.children.filter((e) => isNode(e) && (e as SNodeImpl).hoverFeedback).map((e) => e.id);
    const edges = model.children.filter((e) => isEdge(e)) as SEdgeImpl[];
    const edgeMap = createEdgeMap(edges);


    comGraphStore.setData('inSelectedComGraphFlow',false);
    const fixedNodes = [comGraphStore.data.fixedNodeId];
    if (comGraphStore.data.inFixedComGraphFlow) {// 如果固定的计算流为true 永远失焦其他节点和连线
      fixedNodes.forEach((elementId) => traceElementsOptimized(elementId, edgeMap, window['trace'], model, context));
    }else{ 
      if (selectedNodes.length > 0) { 
        // 选中时  显示追踪轨迹 失焦其他节点和连线
        comGraphStore.setData('inSelectedComGraphFlow',true);
        selectedNodes.forEach((elementId) => traceElementsOptimized(elementId, edgeMap, window['trace'], model, context));    
      } else if(hoverNodes.length > 0 && model.children.length < 20000 && comGraphStore.data.comGraphConfig.isHoverHighlightNode){ 
        // 悬停时 显示追踪轨迹 失焦其他节点和连线
        hoverNodes.forEach((elementId) => traceElementsOptimized(elementId, edgeMap, window['trace'], model, context));
      }
    }

    if (fixedNodes[0] != '' && (!comGraphStore.data.traceTensors || fixedNodes[0] != comGraphStore.data.traceTensors[0]) ) {
      const tensorMagicSet = new Set<number>();
      const opMagicSet = new Set<number>();
      passNodeId(fixedNodes[0], tensorMagicSet, opMagicSet);
      for (const nodeId of window['trace'].incomingNodes) {
        passNodeId(nodeId, tensorMagicSet, opMagicSet);
      }
      for (const nodeId of window['trace'].outgoingNodes) {
        passNodeId(nodeId, tensorMagicSet, opMagicSet);
      }
      comGraphStore.setData("traceTensors", [fixedNodes[0], tensorMagicSet]);
      comGraphStore.setData("traceOperations", [fixedNodes[0], opMagicSet]);
    }

    // Check if there are any traced elements
    const hasTrace =
      window['trace'].incomingEdges.size > 0 ||
      window['trace'].outgoingEdges.size > 0 ||
      window['trace'].incomingNodes.size > 0 ||
      window['trace'].outgoingNodes.size > 0 ||
      window['trace'].incomingPorts.size > 0 ||
      window['trace'].outgoingPorts.size > 0;

    const transform = `scale(${model.zoom}) translate(${-model.scroll.x},${-model.scroll.y})`;
    let trace = window['trace'];
    return (
      <svg class-sprotty-graph={true} class-has-trace={hasTrace && comGraphStore.data.comGraphConfig.isHoverHighlightNode} class-in-selected-trace={comGraphStore.data.inSelectedComGraphFlow} >
        <g transform={transform}>{context.renderChildren(model, { trace })}</g>
      </svg>
    );
  }
}

@injectable()
export class AstgrLabelView extends SLabelView {
  override render(label: Readonly<SLabelImpl>, context: RenderingContext): VNode | undefined {
    if ((!this.isVisible(label, context)) && (!comGraphStore.data.svgExportMode)) {
      return undefined;
    }

    // Calculate vertical position based on label index within parent
    const parent = label.parent;
    if (parent) {
      const labelSiblings = parent.children.filter((child) => child.type === 'label');
      const labelIndex = labelSiblings.indexOf(label);

      // Position labels vertically with very minimal spacing
      const lineHeight = 6; // Much more compact line height
      const yOffset = labelIndex * lineHeight;

      // Determine font size and text alignment based on CSS class
      let fontSize = '6px'; // Much smaller default font
      let fontWeight = 'normal';
      let textAnchor = 'middle'; // Default to center
      const xPosition = label.position.x;

      const isMainLabel = label.cssClasses && label.cssClasses.some((cls) => cls.includes('main-label'));
      const isMetaLabel = label.cssClasses && label.cssClasses.some((cls) => cls.includes('meta-label'));

      if (isMainLabel) {
        fontSize = '7px'; // Much smaller main label font size
        fontWeight = 'bold';
        textAnchor = 'middle'; // Center main labels
      } else if (isMetaLabel) {
        fontSize = '5px'; // Extremely small metadata font size
        fontWeight = 'normal';
        textAnchor = 'middle'; // Center metadata as well for compactness
        // Keep metadata centered for now to avoid layout issues
      }

      const vnode = (
        <text
          class-sprotty-label={true}
          class-main-label={isMainLabel}
          class-meta-label={isMetaLabel}
          x={xPosition}
          y={label.position.y + yOffset}
          style={{
            fontSize,
            fontWeight,
            textAnchor,
            dominantBaseline: 'middle',
          }}
        >
          {label.text}
        </text>
      );

      setAttr(vnode, 'data-svg-metadata', `{"type":"label","id":"${label.id}"}`);
      return vnode;
    }

    // Fallback to default rendering
    return super.render(label, context);
  }
}

@injectable()
export class AstgrNodeLabelView extends ShapeView {
  render(label: Readonly<SLabelImpl & MetadataLabel>, context: RenderingContext): VNode | undefined {
    const defaultZoomLevel = 0.3; // Default zoom level for visibility
    if ((!this.isVisible(label, context) && (!comGraphStore.data.svgExportMode))|| !showDetail(label.root as ViewportRootElementImpl, label.minZoomLevel ?? defaultZoomLevel)) {
      return undefined;
    }
    let vnode;
    const subType = getSubType(label);
    let subgraphId = '';
    if (!(label.slotId && Array.isArray(label.slotId))){
      subgraphId += 'Subgraph ID： ' + label.subgraphId;
    }


    /* root节点的类型判断, 是否使用亮色 */
    
    if (label.cssClasses[0].includes('-main-label')) {
      const isParentNode = label.id.startsWith('parent');
      let node = label.parent.parent;
      let titleTxtFillColor = 'var(--devui-primary-text)';
      if (((node.role !== 'input') && (node.role !== 'output')) || node.isError || node.isEmptyNode) {
        // if(label.id.includes("operation")) node = label.parent;
        if (node.isEmptyNode) {
          titleTxtFillColor = 'var(--devui-primary-text-empty)';
        }
        if (node.selected || (comGraphStore.data.selectedNodeSemanticLabel && comGraphStore.data.selectedNodeSemanticLabel === node.semanticLabel)) {
          titleTxtFillColor = 'var(--devui-node-selected-text)';
        }
      }
      // 创建第一个text节点
      const titleText = (
        <text class-sprotty-label={true} class-can-view-node-detail={comGraphStore.data.comGraphConfig.canViewNodeDetail} class-parent-node={isParentNode} fill={titleTxtFillColor}>
          {label.text}
        </text>
      );

      // 创建第二个text节点，并设置其位置在第一个text的下方
      const idText = subgraphId && label.text.startsWith('CALL') ? (
        <text class-sprotty-label={true} class-can-view-node-detail={comGraphStore.data.comGraphConfig.canViewNodeDetail} class-parent-node={isParentNode} dy="2em" fill={titleTxtFillColor}>
          {subgraphId}
        </text>
      ) : null;
      vnode = (
        <g>
          {titleText}
          {idText}
        </g>
      );
      if (subType) {
        setAttr(titleText, 'class', 'tensor-title-label');
        idText && setAttr(idText, 'class', 'tensor-subgraphId-label');
      }
    } else if (label.cssClasses[0].includes('-meta-label')) {
      let node = label.parent.parent.parent;
      let keyFillColor = 'var(--devui-text)';
      let keyFillOpacity = '0.6';
      let valueFillColor = 'var(--devui-primary-text)';
      
      if (((node.selected || (comGraphStore.data.selectedNodeSemanticLabel && comGraphStore.data.selectedNodeSemanticLabel === node.semanticLabel)) && node.role === 'operation') 
        || ((node.role === 'input' || node.role === 'output') && node.isError && node.selected)) {
        keyFillColor = 'var(--devui-op-node-selected-label-text)';
        keyFillOpacity = '1';
        valueFillColor = 'var(--devui-op-node-selected-value-text)';
      }
      // 拆分key和value
      let split = label.text.split(':');
      let originTextSplit = label.originText?.split(':');
      // 创建第一个text标签
      const keyText = (
        <text class-sprotty-label={true} fill={keyFillColor} fill-opacity={keyFillOpacity} x={20}>
          {split[0] + ':'}
        </text>
      );
      // 创建第二个text标签
      let renderSecondStr = split[1].trim();
      const originTextSecondStr = originTextSplit[1].trim();
      let valueText = (
        <text class-sprotty-label={true} class-tensor-value-label={subType} fill={valueFillColor} x={80}>
          {renderSecondStr}
        </text>
      );
      if (renderSecondStr !== originTextSecondStr) {
        valueText = (
          <g>
            <title>{originTextSecondStr}</title>
            <text class-sprotty-label={true} class-tensor-value-label={subType} fill={valueFillColor} x={80}>
              {renderSecondStr}
            </text>
          </g>
        );
      }

      vnode = (
        <g>
          {keyText} {valueText}
        </g>
      );

      if (subType) {
        setAttr(keyText, 'class', 'tensor-key-label');
      }
    }
    return vnode;
  }
}

export class emptyLabelView extends ShapeView {
  render(label: Readonly<SLabelImpl & MetadataLabel>, context: RenderingContext): VNode | undefined {
    return undefined;
  }
}

function showDetail(vp: ViewportRootElementImpl, zoomLevel: number): boolean {
  return vp.zoom >= zoomLevel;
}

function getBadgeDom(node) {
  let radius = 8;
  /* 右上角角标文字的宽度 */
  const badgeTextWidth = getTextWidth(node.magic, 10);
  /* 右上角角标左右padding和 */
  const badgePadding = 8;
  /* 右上角角标区域的宽高 */
  const badgeWidth = badgeTextWidth + badgePadding;
  const badgeHeight = 20;
  let magicIdBgFillColor =  'var(--devui-node-badge-bg)';
  let magicIdTextFillColor = 'var(--devui-node-badge-text)';
  let badgeX = 5;
  let badgeY = 13;
  let badgePaddingTop = 0;
  let badgePaddingRight = 0;
  if (node.selected) {
    if (((node.role !== 'input') && (node.role !== 'output')) || node.isEmptyNode) {
      badgePaddingTop = 0.5;
      badgePaddingRight = 0.5;
      radius = 8;
      badgeX = 4.5;
      badgeY = 14.5;
      magicIdBgFillColor = 'var(--devui-op-node-badge-focus-bg)';
      magicIdTextFillColor = 'var(--devui-op-node-badge-focus-text)';
    } else {
      if (node.isError) {
        magicIdBgFillColor = 'var(--devui-op-node-badge-focus-bg)';
        magicIdTextFillColor = 'var(--devui-op-node-badge-focus-text)';
      }
      badgePaddingTop = 1;
      badgePaddingRight = 1;
      radius = 4;
      badgeX = 4;
      badgeY = 14;
    }
    
  }

  const inputRightPosY = (node.role === 'input' || node.isMiddle) ? 5 : 0;
  return (
  <g transform={`translate(${node.size.width - badgeWidth}, ${inputRightPosY})`}>
    <path
      d={`M -${badgePaddingRight} ${badgePaddingTop} L -${badgePaddingRight} ${
        badgeHeight + badgePaddingTop - radius
      } Q -${badgePaddingRight} ${badgeHeight + badgePaddingTop} ${radius - badgePaddingRight} ${badgeHeight + badgePaddingTop} L ${
        badgeWidth - badgePaddingRight
      } ${badgeHeight + badgePaddingTop} L ${badgeWidth - badgePaddingRight} ${radius + badgePaddingTop} Q ${
        badgeWidth - badgePaddingRight
      } ${badgePaddingTop} ${
        badgeWidth - badgePaddingRight - radius
      } ${badgePaddingTop} L -${badgePaddingRight} ${badgePaddingTop} Z`}
      class-magicId-background-label={true}
      fill={magicIdBgFillColor}
    ></path>
    <text x={badgeX} y={badgeY} font-size="10px" line-height="12px" font-weight="400" fill={magicIdTextFillColor}>
      {node.magic}
    </text>
  </g>)
}

@injectable()
export class AstgrOpView extends RectangularNodeView {
  override render(
    node: Readonly<SShapeElementImpl & Hoverable & Selectable>,
    context: RenderingContext,
    args?: IViewArgs,
  ): VNode | undefined {
    if (!this.isVisible(node, context) && (!comGraphStore.data.svgExportMode)) {
      return undefined;
    }

    const isMiniType = node.root.zoom < 0.04;
    const errClass = node.isError === true ? 'error-node' : '';

    const trace = (args as AstgrViewArgs)?.trace ?? {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };

    // Fix: Check for any port IDs that belong to this node
    const traceResult = isNodeTraced(node.id, trace);
    const incoming = traceResult.incoming;
    const outgoing = traceResult.outgoing;
    const isTraced = incoming || outgoing;
    if (comGraphStore.data.unVisibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    // Selected nodes should never be dimmed
    const shouldDim = !isTraced && !node.selected;

    // Check if this is a CALL operation
    const astgrNode = node as unknown as AstgrNode;
    const isCallOperation = astgrNode.opcode === 'CALL';

    // Debug logging
    if (isCallOperation) {
      console.log('CALL operation detected:', {
        id: node.id,
        opcode: astgrNode.opcode,
        calleehash: astgrNode.calleehash,
      });
    }

    // Double-click handler for CALL operations
    const handleDoubleClick = () => {
      if (isCallOperation && astgrNode.calleehash && window.vsCodeApi) {
        window.vsCodeApi.postMessage({
          type: 'openSubgraph',
          calleehash: astgrNode.calleehash,
        });
      }
    };

    let badgeDom = isMiniType ? null : getBadgeDom(node);
    /* 矩形圆角 */
    const rectWidth = Math.max(node.size.width, 0);
    const rectHeight = Math.min(node.size.height, 150);

    /* root节点的类型判断 是否使用亮色 */
    let backgroundFillColor = node.baseColor;
    let backgroundFilter = '';
    if (comGraphStore.data.inSelectedComGraphFlow || comGraphStore.data.inFixedComGraphFlow) {
      if (node.selected) {
        backgroundFillColor = node.isEmptyNode === true ? 'var(--devui-primary-text-empty)' : node.lightColor;
      }
      if (!incoming && !outgoing && !errClass && !node.isEmptyNode) {
        backgroundFilter = 'grayscale(1)';
      }
    }
    if (comGraphStore.data.selectedNodeSemanticLabel) {
      if (comGraphStore.data.selectedNodeSemanticLabel === node.semanticLabel) {
        backgroundFillColor = node.lightColor;
      } else {
        backgroundFilter = 'grayscale(1)';
      }
    }
    let opSign;
    if (node.calleehash) {
      let svgName = '';
      if ((window as any).isAscDark) {
        svgName = 'op-node-sign';
      } else {
        svgName = 'op-node-sign-light';
      }
      opSign = (<image href={`${(window as any).staticPath}/static-assets/${svgName}.svg`} x={rectWidth - 48} y={rectHeight - 48} width="48" height="48" />);
    }
    return (
      <g
        class-op-incoming={incoming}
        class-op-outgoing={outgoing}
        class-op-not-traced={shouldDim}
        class-mouseover={node.hoverFeedback}
        class-call-operation={isCallOperation}
        class-op-diff-normal={node.compareType === 'normal'}
        style={isCallOperation ? { cursor: 'pointer' } : undefined}
        on-dblclick={isCallOperation ? handleDoubleClick : undefined}
      >
        <rect
          class-op={true}
          class-sprotty-node={true}
          class-selected={node.selected}
          class-call-operation={isCallOperation}
          width={rectWidth}
          height={rectHeight}
          fill={backgroundFillColor}
          filter={backgroundFilter}
          class-op-diff-add={node.compareType === 'add'}
          class-op-diff-delete={node.compareType === 'delete'}
          class-op-diff-change={node.compareType === 'change'}
        ></rect>
        {!isMiniType && opSign}
        {!isMiniType && context.renderChildren(node, args)}
        {!isMiniType && badgeDom}
      </g>
    );
  }
}

@injectable()
export class AstgrOpMinimapView extends RectangularNodeView {
  override render(
    node: Readonly<SShapeElementImpl & Hoverable & Selectable>,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    let backgroundFillColor = node.baseColor;
     const trace = (args as AstgrViewArgs)?.trace ?? {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };

    const traceResult = isNodeTraced(node.id, trace);
    const isTraced = traceResult.incoming || traceResult.outgoing;
    if (comGraphStore.data.unVisibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    return (
      <g>
        <rect
          class-op={true}
          class-sprotty-node={true}
          width={Math.max(node.size.width, 0)}
          height={Math.max(node.size.height, 0)}
          fill={backgroundFillColor}
        ></rect>
      </g>
    );
  }
}

const handleLockToggle = () => {
  (window as any).ascEventBus.emit('lockToggleChange', true);
}

@injectable()
export class AstgrRectView extends RectangularNodeView {
  override render(
    node: any,
    context: RenderingContext,
    args?: IViewArgs
  ): VNode | undefined {
    if (!node.selectedNodes.length) {
      return undefined;
    }
    if (node.needCalPostion) {
      node.needCalPostion = false;
      const nodeMap = node.parent.index.id2element;
      let startX = Infinity;
      let startY = Infinity;
      let endX = -Infinity;
      let endY = -Infinity;
      let endYId = '';
      
      for (let i = 0; i < node.selectedNodes.length; i++) {
        const tmpNodes = nodeMap.get(node.selectedNodes[i]);
        if (!tmpNodes.size.width) {
          return undefined;
        }
        if (!tmpNodes) {
          continue;
        }
        if (tmpNodes.position.x < startX) {
          startX = tmpNodes.position.x;
        }
        if (tmpNodes.position.x + tmpNodes.size.width > endX) {
          endX = tmpNodes.position.x + tmpNodes.size.width;
        }
        if (tmpNodes.position.y < startY) {
          startY = tmpNodes.position.y;
        }
        if (tmpNodes.position.y + tmpNodes.size.height > endY) {
          endY = tmpNodes.position.y + tmpNodes.size.height;
          endYId = node.selectedNodes[i];
        }
      }
      node.position.x = startX - 40;
      node.position.y = startY - 40;
      node.customSize.width = endX - startX + 80;
      node.customSize.height = endY - startY + 80;
    }
    let strokeWidth = node.root.zoom >= 1 ? 1 : (1 / node.root.zoom);
    if (comGraphStore.data.isNodeRectLock) {
      strokeWidth = node.root.zoom >= 1 ? 1.5 : (1 / node.root.zoom);
    }
    let imgSize = node.root.zoom >= 1 ? 12 : node.root.zoom < 0.45 ? (12 / 0.45): (12 / node.root.zoom);

    let nodeRectLockColor = comGraphStore.data.isNodeRectLock ? 'rgba(49,122,247,1)' : 'var(--devui-tooltip-bg)';
    let strokeColor =  (window as any).isAscDark ? 'rgba(255,255,255,0.2)': 'rgba(0,0,0,0.08)';
    const isStable = comGraphStore.data.stableRect;
    if (isStable) {
      strokeColor =  (window as any).isAscDark ? 'rgba(255,255,255,0.6)': 'rgba(0,0,0,0.08)';
    }  
    if (comGraphStore.data.isNodeRectLock) {
      strokeColor =  (window as any).isAscDark ? 'rgba(49,122,247,1)': '#0A59F7';
    }

    let lockOpenSvgName: string;
    if(comGraphStore.data.isNodeRectLock) {
      if((window as any).isAscDark) {
        lockOpenSvgName = 'lock-private';
      } else {
        lockOpenSvgName = 'lock-private-light';
      }
    } else {
      if ((window as any).isAscDark) {
        lockOpenSvgName = 'lock-open';
      } else {
        lockOpenSvgName = 'lock-open-light';
      }
    }
    const location = ((node.location || 0) % 200) / 2;
    const {path, v} = getRectPath(node.customSize.width, node.customSize.height, location, location + 10);
    return (
      <g>
        <defs>
          <linearGradient id="rainbow" gradientUnits="userSpaceOnUse" x1={v[0][0]} y1={v[0][1]} x2={v[1][0]} y2={v[1][1]}>
            <stop offset="0%"  stop-color="rgba(164, 179, 251, 0.2)"/>
            <stop offset="50%" stop-color="rgba(164, 179, 251, 0.9)"/>
            <stop offset="100%" stop-color="rgba(164, 179, 251, 0.2)"/>
          </linearGradient>
        </defs>
        <rect
          class-sprotty-node={true}
          width={node.customSize.width}
          height={node.customSize.height}
          fill="rgba(144,184,249,0.1)"
          stroke={strokeColor}
          stroke-width={strokeWidth}
        ></rect>
        <path
          d={path}
          stroke-width={strokeWidth}
          stroke="url(#rainbow)"
          fill="transparent"
        ></path>
        <g id='show_node_rect_lock' on-click={handleLockToggle}>
          <rect width={imgSize * 2} height={imgSize * 2} x="3" y="3" rx={imgSize / 3} ry={imgSize / 3} fill={nodeRectLockColor}></rect>
          <image href={`${(window as any).staticPath}/static-assets/${lockOpenSvgName}.svg`} x={3 + imgSize / 2}  y={3 + imgSize / 2} width={imgSize} height={imgSize} />
        </g>
      </g>
    );
  }
}

@injectable()
export class AstgrTensorView extends RectangularNodeView {
  override render(
    node: Readonly<SShapeElementImpl & Hoverable & Selectable>,
    context: RenderingContext,
    args?: IViewArgs,
  ): VNode | undefined {
    if ((!this.isVisible(node, context)) && (!comGraphStore.data.svgExportMode)) {
      return undefined;
    }

    // check node has errinfo
    const errClass = node.isError === true ? 'error-node' : '';
    const isMiniType = node.root.zoom < 0.04;

    const trace = (args as AstgrViewArgs)?.trace ?? {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };

    // Fix: Check for any port IDs that belong to this node
    const traceResult = isNodeTraced(node.id, trace);
    const incoming = traceResult.incoming;
    const outgoing = traceResult.outgoing;
    const isTraced = incoming || outgoing;
    if (comGraphStore.data.unVisibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    // Selected nodes should never be dimmed
    const shouldDim = !isTraced && !node.selected;
    /* 矩形圆角 */
    let radius = 8;
    const waveOffset1 = 2;
    const downOffset = 2.5;
    const middleOffset = 4.5;
    const waveOffset2 = 5;
    /* 带波浪线的矩形宽高 */
    const width = Math.max(node.size.width, 0);
    const height = Math.max(node.size.height, 0);
    const badgeDom = isMiniType ? null : getBadgeDom(node);
    /* 蓝色标题区域的宽高 */
    const blueBgRectWidth = node.size.width;
    let blueBgRectPaddingLeft = 0;
    let blueBgRectPaddingTop = 0;
    let correctHeight = 9;
    let selectedWaveMargin = 0;
    if (node.selected) {
      if ((node.role !== 'input') && (node.role !== 'output')) {
        blueBgRectPaddingLeft = 0.5;
        blueBgRectPaddingTop = 0.5;
        radius = 8;
      } else {
        radius = 4;
        correctHeight = 10;
        selectedWaveMargin = 0.6;
      }
    }

    const blurBgRectHeight = 30;

    /* root节点的类型判断，是否使用亮色 */
    let titleBackgroundFillColor = node.baseColor;
    let inoutBackgroundFillColor = 'var(--devui-node-bg)';
    let backgroundFilter = '';
    // 亮色逻辑判断 
    if (comGraphStore.data.inSelectedComGraphFlow || comGraphStore.data.inFixedComGraphFlow) {
      if (node.selected) {
        titleBackgroundFillColor = node.lightColor;
        inoutBackgroundFillColor = 'var(--devui-node-selected-bg)';
      }
      if (!incoming && !outgoing && !errClass) {
        backgroundFilter = 'grayscale(1)';
      }
    }
    if (comGraphStore.data.selectedNodeSemanticLabel) {
      if (comGraphStore.data.selectedNodeSemanticLabel === node.semanticLabel) {
        titleBackgroundFillColor = node.lightColor;
        inoutBackgroundFillColor = 'var(--devui-node-selected-bg)';
      } else {
        backgroundFilter = 'grayscale(1)';
      }
    }

    let rectNode;
    if ((node.role !== 'input') && (node.role !== 'output')) {
      rectNode = (
        <g>
          <rect
            class-sprotty-node={true}
            class-tensor={true}
            class-selected={node.selected}
            x="0"
            y="0"
            width={Math.max(node.size.width, 0)}
            height={Math.max(node.size.height + 4, 0)}
            rx="8"
            ry="8"
            fill={inoutBackgroundFillColor}
            filter={backgroundFilter}
            data-type={node.compareType}
            class-tensor-diff-add={node.compareType === 'add'}
            class-tensor-diff-delete={node.compareType === 'delete'}
            class-tensor-diff-change={node.compareType === 'change'}
          ></rect>
          <path
            d={`M ${blueBgRectPaddingLeft} ${blurBgRectHeight} L ${blueBgRectPaddingLeft} ${
              radius + blueBgRectPaddingTop
            } Q ${blueBgRectPaddingLeft} ${blueBgRectPaddingTop} ${radius + blueBgRectPaddingLeft} ${blueBgRectPaddingTop} L ${
              blueBgRectWidth - blueBgRectPaddingLeft - radius
            } ${blueBgRectPaddingTop} Q ${blueBgRectWidth - blueBgRectPaddingLeft} ${blueBgRectPaddingTop} ${
              blueBgRectWidth - blueBgRectPaddingLeft
            } ${radius + blueBgRectPaddingTop} L ${blueBgRectWidth - blueBgRectPaddingLeft} ${blurBgRectHeight} Z`}
            fill={titleBackgroundFillColor}
            class-tensor-title-background-label={true}
            filter={backgroundFilter}
          ></path>
        </g>
      );
    } else {
      let isInput = false;
      if (node.role === 'input' && !node.isMiddle) {
        isInput = true;
      }
      let isOutput = false;
      const parent = node.parent;
      if (node.role === 'output' && !node.isMiddle) {
        isOutput = true;
      }
      let isMdle = false;
      if (node.isMiddle) {
        isMdle = true;
      }
      if (parent.zoom < 0.3) {
        if (isInput) {
          inoutBackgroundFillColor = isTraced ? 'var(--devui-in-tensor-mini-light)' : 'var(--devui-in-tensor-mini)';
        } else {
          inoutBackgroundFillColor = isTraced ? 'var(--devui-out-tensor-mini-light)' : 'var(--devui-out-tensor-mini)';
        }
      }
      const errorColor = node.selected ? node.lightColor : node.baseColor;
      if (node.role === 'input' && !node.isMiddle) {
        rectNode = (
          <g>
            <path
              d={`M 0 ${height + correctHeight} L 0 ${radius} Q 0 0 ${radius} 0 L ${
                width - radius
              } 0 Q ${width} 0 ${width} ${radius} L ${width} ${height + correctHeight} Q ${(width / 4) * 3} ${height + correctHeight - waveOffset1 * 3} ${
                width / 2
              } ${height + correctHeight} T 0 ${height + correctHeight} Z`}
              fill={node.isError ? errorColor: inoutBackgroundFillColor}
              class-tensor-inout-background-label={true}
              filter={backgroundFilter}
              class-tensor-in-wave-label1={isInput}
              class-tensor-diff-add={node.compareType === 'add'}
              class-tensor-diff-delete={node.compareType === 'delete'}
              class-tensor-diff-change={node.compareType === 'change'}
            ></path>
            <path
              d={`M 0 ${height + correctHeight + waveOffset2}
              L 0 ${radius + waveOffset2}
              Q 0 ${waveOffset2} ${radius} ${waveOffset2}
              L ${width - radius} ${waveOffset2}
              Q ${width} ${waveOffset2} ${width} ${radius + waveOffset2}
              L ${width} ${height + correctHeight}
              Q ${(width / 4) * 3} ${height + correctHeight - waveOffset1 * 3}
                ${width / 2} ${height + correctHeight}
              T 0 ${height + correctHeight} Z`}
              filter={backgroundFilter}
              fill={node.isError ? errorColor: inoutBackgroundFillColor}
            ></path>
          </g>
        );
      } else if (node.role === 'output' && !node.isMiddle) {
        let nodeFillColor = node.isError ? errorColor: inoutBackgroundFillColor;
        rectNode = (
          <g>
            <path
              d={`M 0 ${height + correctHeight - waveOffset1}
              L 0 ${radius}
              Q 0 0 ${radius} 0
              L ${width - radius} 0
              Q ${width} 0 ${width} ${radius}
              L ${width} ${height + correctHeight - waveOffset1}
              Q ${(width / 4) * 3} ${height + correctHeight - waveOffset1 - waveOffset1 * 3}
                ${width / 2} ${height + correctHeight - waveOffset1}
              T 0 ${height + correctHeight - waveOffset1}
              Z`}
              fill={nodeFillColor}
              class-tensor-inout-background-label={true}
              class-accuracy-error-border={node.isAccuracyError}
              filter={backgroundFilter}
              class-tensor-diff-add={node.compareType === 'add'}
              class-tensor-diff-delete={node.compareType === 'delete'}
              class-tensor-diff-change={node.compareType === 'change'}
            ></path>
            <path
              d={`M ${selectedWaveMargin} ${height + downOffset}
                L ${selectedWaveMargin} ${height + waveOffset2 + downOffset}
                Q ${width / 4} ${height + waveOffset2 * 2 + downOffset}
                  ${width / 2} ${height + waveOffset2 + downOffset}
                T ${width - selectedWaveMargin} ${height + waveOffset2 + downOffset}
                L ${width - selectedWaveMargin} ${height + downOffset}
                Q ${(width / 4) * 3} ${height - waveOffset1 * 3 + downOffset}
                  ${width / 2} ${height + downOffset}
                T 0 ${height + downOffset}
                Z`}
              filter={backgroundFilter}
              class-tensor-out-wave-label1={isOutput}
            ></path>
          </g>
        );
      } else {
        const innerHeight = height - middleOffset;
        rectNode = (
          <g>
            <path
              d={`M 0 ${height + correctHeight - waveOffset1}
              L 0 ${radius}
              Q 0 0 ${radius} 0
              L ${width - radius} 0
              Q ${width} 0 ${width} ${radius}
              L ${width} ${height + correctHeight - waveOffset1}
              Q ${(width / 4) * 3} ${height + correctHeight - waveOffset1 - waveOffset1 * 3}
                ${width / 2} ${height + correctHeight - waveOffset1}
              T 0 ${height + correctHeight - waveOffset1}
              Z`}
              fill={node.isError ? errorColor: inoutBackgroundFillColor}
              class-tensor-in-wave-label1={isMdle}
              class-tensor-inout-background-label={true}
              filter={backgroundFilter}
              class-tensor-diff-add={node.compareType === 'add'}
              class-tensor-diff-delete={node.compareType === 'delete'}
              class-tensor-diff-change={node.compareType === 'change'}
            ></path>
            <path
               d={`M 0 ${innerHeight + correctHeight - waveOffset1 + waveOffset2}
               L 0 ${radius + waveOffset2}
               Q 0 ${waveOffset2} ${radius} ${waveOffset2}
               L ${width - radius} ${waveOffset2}
               Q ${width} ${waveOffset2} ${width} ${radius + waveOffset2}
               L ${width} ${innerHeight + correctHeight - waveOffset1}
               Q ${(width / 4) * 3} ${innerHeight + correctHeight - waveOffset1 - waveOffset1 * 3}
                 ${width / 2} ${innerHeight + correctHeight - waveOffset1}
               T 0 ${innerHeight + correctHeight - waveOffset1}
               Z`}
              fill={node.isError ? errorColor: inoutBackgroundFillColor}
              filter={backgroundFilter}
            ></path>
            <path
              d={`M ${selectedWaveMargin} ${height + downOffset}
              L ${selectedWaveMargin} ${height + waveOffset2 + downOffset}
              Q ${width / 4} ${height + waveOffset2 * 2 + downOffset}
                ${width / 2} ${height + waveOffset2 + downOffset}
              T ${width - selectedWaveMargin} ${height + waveOffset2 + downOffset}
              L ${width - selectedWaveMargin} ${height + downOffset}
              Q ${(width / 4) * 3} ${height - waveOffset1 * 3 + downOffset}
                ${width / 2} ${height + downOffset}
              T 0 ${height + downOffset}
              Z`}
              filter={backgroundFilter}
              class-tensor-out-wave-label1={isMdle}
            ></path>
          </g>
        );
      }
    }

    const linkSvgPath = window.staticPath + '/static-assets/accurancy-abnormal.svg';

    const currentLanguage = (window as any).ascLang;
    const iconSize = 14;
    const iconGap = 4;
    const tagPadding = 6;
    const iconPaddingTop = (24 - iconSize) / 2;
    const accuracyTagTextWidth = currentLanguage === 'zh' ? 69 : 95;
    const accuracyTagWidth = accuracyTagTextWidth + iconSize + iconGap + tagPadding * 2;
    const accuracyTagHeight = 24;
    const tagStartX = width + 6;
    const contentStartX = tagStartX + tagPadding * 2;
    const accuracyErrorTag = (node.role === 'output' && !node.isMiddle && node.isAccuracyError && !isMiniType) ? (
      <g class-accuracy-error-tag={true}>
        <rect
          x={tagStartX}
          y={0}
          width={accuracyTagWidth}
          height={accuracyTagHeight}
          fill="#D94838"
          rx="4"
          ry="4"
          style-cursor="pointer"
          style-pointer-events="all"
        />
        <image
          href={linkSvgPath}
          x={contentStartX}
          y={iconPaddingTop}
          width={iconSize}
          height={iconSize}
          style-cursor="pointer"
          style-pointer-events="all"
        />
        <text
          x={contentStartX + iconSize + iconGap}
          y={accuracyTagHeight / 2}
          font-size="12"
          fill="#fff"
          text-anchor="start"
          dominant-baseline="central"
          style-cursor="pointer"
          style-pointer-events="all"
        >{currentLanguage === 'zh' ? '精度异常' : 'accurancy abnormal'}</text>
      </g>
    ) : null;
    if (node.isAccuracyError) {
      debugger;
    }
    return (
      <g
        class-op-incoming={incoming}
        class-op-outgoing={outgoing}
        class-op-not-traced={shouldDim}
        class-mouseover={node.hoverFeedback}
        class-tensor-diff-normal={node.compareType === 'normal'}
        class-error-nodes={errClass}
      >
        {rectNode}
        {!isMiniType && context.renderChildren(node, args)}
        {!isMiniType && badgeDom}
        {accuracyErrorTag}
      </g>
    );
  }
}

@injectable()
export class  AstgrTensorMinimapView extends RectangularNodeView {
  override render(
    node: Readonly<SShapeElementImpl & Hoverable & Selectable>,
    context: RenderingContext,
    args?: IViewArgs,
  ): VNode | undefined {
    if ((!this.isVisible(node, context)) && (!comGraphStore.data.svgExportMode)) {
      return undefined;
    }

    const trace = (args as AstgrViewArgs)?.trace ?? {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };

    // Fix: Check for any port IDs that belong to this node
    const traceResult = isNodeTraced(node.id, trace);
    const incoming = traceResult.incoming;
    const outgoing = traceResult.outgoing;
    const isTraced = incoming || outgoing;
    if (comGraphStore.data.unVisibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    const isInput = node.role === 'input';

    // Selected nodes should never be dimmed
    let titleBackgroundFillColor = '';
    if (node.baseColor) {
      titleBackgroundFillColor = node.baseColor;
    } else if (isInput) {
      titleBackgroundFillColor = isTraced ? 'var(--devui-in-tensor-mini-light)' : 'var(--devui-in-tensor-mini)';
    } else {
      titleBackgroundFillColor = isTraced ? 'var(--devui-out-tensor-mini-light)' : 'var(--devui-out-tensor-mini)';
    }

    const rectNode = (
      <g>
        <rect
          class-sprotty-node={true}
          class-tensor={true}
          class-selected={node.selected}
          x="0"
          y="0"
          width={Math.max(node.size.width, 0)}
          height={Math.max(node.size.height, 0)}
          rx="8"
          ry="8"
          fill={titleBackgroundFillColor}
        ></rect>
      </g>
    );

    return (
      <g
        class-op-incoming={incoming}
        class-op-outgoing={outgoing}
      >
        {rectNode}
      </g>
    );
  }
}

@injectable()
export class InputOutputNodeView extends ShapeView {
  protected offset = 10;
  protected skew = -10;
  override render(
    node: Readonly<SShapeElementImpl & Hoverable & Selectable>,
    context: RenderingContext,
    args?: IViewArgs,
  ): VNode | undefined {
    if ((!this.isVisible(node, context)) || (!comGraphStore.data.svgExportMode)) {
      return undefined;
    }

    const trace = (args as AstgrViewArgs)?.trace ?? {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };

    const traceResult = isNodeTraced(node.id, trace);
    const incoming = traceResult.incoming;
    const outgoing = traceResult.outgoing;
    const isTraced = incoming || outgoing;

    // Selected nodes should never be dimmed
    const shouldDim = !isTraced && !node.selected;

    //const transform = `skewX(${this.skew})`;

    return (
      <g class-io-incoming={incoming} class-io-outgoing={outgoing} class-io-not-traced={shouldDim} class-mouseover={node.hoverFeedback}>
        <rect
          class-sprotty-node={true}
          class-input={node.type === 'node:input'}
          class-output={node.type === 'node:output'}
          class-selected={node.selected}
          x="0"
          y="0"
          width={Math.max(node.size.width, 0)}
          height={Math.max(node.size.height, 0)}
          rx="20" // Rounded corners to distinguish from regular operations
          ry="20"
          //transform={transform}
        ></rect>
        {context.renderChildren(node, args)}
      </g>
    );
  }
}

function generateRoundedPathWithArc(points, radius = 10) {
  if (points.length < 2) return "";
  
  const direction = comGraphStore.data.layoutDirection;
  const xDelta = direction === 'RIGHT' ? 3: 0;
  const yDelta = direction === 'RIGHT' ? 0 : 3;

  let path = `M ${points[0].x - xDelta} ${points[0].y - yDelta}`;
  
  for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      // 如果是最后一个线段或者是直线段，直接连接
      if (i === points.length - 2) {
        path += ` L ${next.x + xDelta} ${next.y + yDelta}`;
      } else {
          const afterNext = points[i + 2];
          
          // 计算圆角
          const cornerPath = createRoundedCorner(current, next, afterNext, radius);
          path += cornerPath;
      }
  }
  
  return path;
}

/**
* 创建单个圆角
*/
function createRoundedCorner(prev, corner, next, radius) {
  // 计算向量
  const v1 = { x: corner.x - prev.x, y: corner.y - prev.y };
  const v2 = { x: next.x - corner.x, y: next.y - corner.y };
  
  // 计算向量长度
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (len1 === 0 || len2 === 0) {
      return ` L ${corner.x} ${corner.y}`;
  }
  
  // 标准化向量
  const n1 = { x: v1.x / len1, y: v1.y / len1 };
  const n2 = { x: v2.x / len2, y: v2.y / len2 };
  
  // 确定实际半径（不超过线段长度的一半）
  const actualRadius = Math.min(radius, len1 / 2, len2 / 2);
  
  // 计算圆角的起点和终点
  const startPoint = {
      x: corner.x - n1.x * actualRadius,
      y: corner.y - n1.y * actualRadius
  };
  
  const endPoint = {
      x: corner.x + n2.x * actualRadius,
      y: corner.y + n2.y * actualRadius
  };
  
  // 计算圆弧的方向（大弧标志和小弧标志）
  const angle = Math.atan2(n2.y, n2.x) - Math.atan2(n1.y, n1.x);
  let sweepFlag = angle > 0 ? 1 : 0;
  const largeArcFlag = 0;

  // 第四象限置反
  if ((n2.x + n1.x< 0) && (n2.y + n1.y < 0)) {
    sweepFlag = sweepFlag ? 0 : 1;
  }
  
  // 构建路径
  return ` L ${startPoint.x} ${startPoint.y} A ${actualRadius} ${actualRadius} 0 ${largeArcFlag} ${sweepFlag} ${endPoint.x} ${endPoint.y}`;
}

@injectable()
export class AstgrEdge extends PolylineEdgeView {
  override render(edge: Readonly<SEdgeImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    if((edge.root as any)?.zoom < 0.05 && !comGraphStore.data.comGraphConfig.isSimple) {
      return;
    }
    const trace = (args as AstgrViewArgs)?.trace ?? {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };
    const traceResult = isEdgeTraced(edge.id, trace);
    const incoming = traceResult.incoming;
    const outgoing = traceResult.outgoing;
    const isTraced = incoming || outgoing;
    if (comGraphStore.data.unVisibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    let isParent = false;
    if (edge.role && edge.role === 'parent') {
      isParent = true;
    }

    const route = this.edgeRouterRegistry.route(edge, args);
    if ((!this.isVisible(edge, route, context)) && (!comGraphStore.data.svgExportMode)) {
      if (edge.children.length === 0) {
        return undefined;
      }
      return <g>{context.renderChildren(edge, { route, ...args })}</g>;
    }

    return (
      <g
        class-sprotty-edge={true}
        class-mouseover={edge.hoverFeedback}
        class-sprotty-edge-incoming={incoming}
        class-sprotty-edge-outgoing={outgoing}
        class-edge-not-traced={!isTraced}
        class-edge-dash = {isParent}
      >
        {this.renderLine(edge, route, context, args)}
        {context.renderChildren(edge, { route, ...args })}
      </g>
    );
  }

  override renderLine(edge: SEdgeImpl, segments: Point[], context: RenderingContext, args?: IViewArgs): VNode {
    if((edge.root as any).zoom < 0.03) {
      return (<g></g>);
    }
    const trace = (args as AstgrViewArgs)?.trace ?? {
      incomingEdges: new Set<string>(),
      incomingNodes: new Set<string>(),
      incomingPorts: new Set<string>(),
      outgoingEdges: new Set<string>(),
      outgoingNodes: new Set<string>(),
      outgoingPorts: new Set<string>(),
    };
    const traceResult = isEdgeTraced(edge.id, trace);
    const incoming = traceResult.incoming;
    const outgoing = traceResult.outgoing;

    let path = generateRoundedPathWithArc(segments, 30);

    let isParent = false;
    if (edge.role && edge.role === 'parent') {
      isParent = true;
    }
    if (isParent) {
      // const [start, end] = [segments[0], segments[segments.length - 1]];
      const start = segments[Math.ceil(segments.length / 2) - 1];
      const end = segments[Math.ceil(segments.length / 2)];
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;

      const linkSvgPath = window.staticPath + '/static-assets/link.svg';
      return (
        <g>
          <path d={path} stroke-width="1" class-sprotty-edge-incoming={incoming} class-sprotty-edge-outgoing={outgoing} />
          <circle cx={cx} cy={cy} r="8" fill="transparent" stroke="#00c853" stroke-width="1" strokeDasharray="none"/>
          <image
            href={linkSvgPath}
            x = {cx - 6}
            y = {cy - 6}
            widht="12"
            height="12"
          />
        </g>
      );
    }
    return (
      <g>
        <path d={path} stroke-width="1" class-sprotty-edge-incoming={incoming} class-sprotty-edge-outgoing={outgoing} />
      </g>
    );
  }
}

@injectable()
export class BootomAstgrEdge extends PolylineEdgeView {
  override render(edge: Readonly<SEdgeImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    const route = this.edgeRouterRegistry.route(edge, args);
    return (<g id="node-bottom-edge">
      {context.renderChildren(edge, { route, ...args })}
      </g>);
  }
}

@injectable()
export class AstgrPortView extends ShapeView {
  render(node: Readonly<SPortImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    if ((!this.isVisible(node, context)) && (!comGraphStore.data.svgExportMode)) {
      return undefined;
    }
    const isInPort = node.id.endsWith('-in');
    const direction = comGraphStore.data.layoutDirection;
    const xDelta = direction === 'RIGHT' ? 0 : 4;
    let yDelta = direction === 'RIGHT' ? 0 : isInPort ? 4 : -4;

    if (node.id.includes('tensor') && !isInPort) {
      yDelta = 0;
    }
    const circleELement = (
      <circle
        class-sprotty-port={true}
        class-mouseover={node.parent.hoverFeedback && comGraphStore.data.comGraphConfig.isHoverHighlightNode}
        class-selected={node.parent.selected}
        cx={isInPort ? Math.max(node.size.width, 0) - xDelta : 0 + xDelta}
        cy={Math.max(node.size.width, 0) / 2 + yDelta}
        r={Math.max(node.size.width, 0) / 2}
        stroke="var(--devui-page-bg)"
        stroke-width="1.43"
      />
    );
    return (
      <g>
        {circleELement}
        {context.renderChildren(node, args)}
      </g>
    );
  }
}

@injectable()
export class emptyPortView extends ShapeView {
  render(node: Readonly<SPortImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    return undefined;
  }
}

@injectable()
export class CustomCompartmentView extends SCompartmentView {
  render(compartment: Readonly<SCompartmentImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    const translate = `translate(${compartment.bounds.x}, ${compartment.bounds.y})`;
    const isMetadataCompartment = compartment.id.includes("metadata-compartment");
    const lastChirdPosY = compartment.children?.at(-1)?.position?.y > 0;

    const selIndexes = comGraphStore.data.selectCustom;
    const selSet = new Set(selIndexes);

    const isMeta = (c: SChildElement) => c.cssClasses?.[0] === "tensor-meta-label";
    const stepY = 15;
    const tensorBaseY = 4;

    const updateChildElement = (child: SChildElement, idx: number, runningY: number): VNode | undefined => {
      const rawVNode = context.renderElement(child);
      if(!rawVNode){
        return undefined;
      };

      const innerTransY = (isMeta(child) ? tensorBaseY + idx * stepY : idx * stepY);
      const textNode = rawVNode.data;
      if(textNode) {
        textNode.attrs ||= {};
        textNode.attrs.transform = `translate(0, ${innerTransY}) translate(-20, 9)`;
      }
      const childTranslate = `translate(0, ${runningY})`;
      const childTranslateform = <g transform={childTranslate}> {rawVNode}</g>;
      return  childTranslateform;
    }

    let vnode: VNode;
    if (isMetadataCompartment && selIndexes.length > 0 && lastChirdPosY) {
      const children: VNode[] = [];
      let runningY = 0;

      const filterMetadataCompartments = compartment.children.filter((_, idx) => selSet.has(idx));
      filterMetadataCompartments.forEach((element, index) => {
        const ele = updateChildElement(element, index, runningY);
        if (ele) {
          children.push(ele);
        }
      });

      vnode = <g transform={translate} class-sprotty-comp>{children}</g>;
    } else {
      vnode = <g transform={translate} class-sprotty-comp>{context.renderChildren(compartment)}</g>;
    }

    const subType = getSubType(compartment);
    if(subType) {
      setAttr(vnode, "class", subType);
    }
    return vnode;
  }
}