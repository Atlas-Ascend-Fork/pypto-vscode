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
  ViewportRootElementImpl
} from 'sprotty';
import { injectable } from 'inversify';
import { VNode } from 'snabbdom';
import { RenderingContext, setAttr, ShapeView, SPortImpl, getAbsoluteBounds } from 'sprotty';
import { Point, Selectable, Hoverable, Dimension, getSubType } from 'sprotty-protocol';
import { AstgrNode, MetadataLabel } from './graph.types';
import { getTextWidth } from '../utils';
import { comGraphStore } from '../service/com-graph-store';

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
function isNodeTraced(nodeId: string, trace: Trace): { incoming: boolean; outgoing: boolean } {
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
      } else if(hoverNodes.length > 0 && model.children.length < 20000){ 
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
      <svg class-sprotty-graph={true} class-has-trace={hasTrace} class-in-selected-trace={comGraphStore.data.inSelectedComGraphFlow} >
        <g transform={transform}>{context.renderChildren(model, { trace })}</g>
      </svg>
    );
  }
}

@injectable()
export class AstgrLabelView extends SLabelView {
  override render(label: Readonly<SLabelImpl>, context: RenderingContext): VNode | undefined {
    if (!this.isVisible(label, context)) {
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
    if (!this.isVisible(label, context) || !showDetail(label.root as ViewportRootElementImpl, label.minZoomLevel ?? defaultZoomLevel)) {
      return undefined;
    }
    let vnode;
    const subType = getSubType(label);
    let subgraphId = '';
    if (label.slotId && Array.isArray(label.slotId)) {
      subgraphId += 'Slot ID： ' + (`[${label.slotId.join(',')}]` || '[]');
    } else {
      subgraphId += 'Subgraph ID： ' + label.subgraphId;
    }


    /* root节点的类型判断, 是否使用亮色 */
    
    if (label.cssClasses[0].includes('-main-label')) {
      const isParentNode = label.id.startsWith('parent');
      let node = label.parent.parent;
      let titleTxtFillColor = 'var(--devui-primary-text)';
      if ((node.role !== 'input') && (node.role !== 'output')) {
        // if(label.id.includes("operation")) node = label.parent;
        if (node.selected) {
          titleTxtFillColor = 'var(--devui-node-selected-text)';
        }
      }
      // 创建第一个text节点
      const titleText = (
        <text class-sprotty-label={true} class-parent-node={isParentNode} fill={titleTxtFillColor}>
          {label.text}
        </text>
      );

      // 创建第二个text节点，并设置其位置在第一个text的下方
      const idText = (
        <text class-sprotty-label={true} class-parent-node={isParentNode} dy="2em" fill={titleTxtFillColor}>
          {subgraphId}
        </text>
      );
      vnode = (
        <g>
          {titleText}
          {idText}
        </g>
      );
      if (subType) {
        setAttr(titleText, 'class', 'tensor-title-label');
        setAttr(idText, 'class', 'tensor-subgraphId-label');
      }
    } else if (label.cssClasses[0].includes('-meta-label')) {
      let node = label.parent.parent.parent;
      let keyFillColor = 'var(--devui-text)';
      let keyFillOpacity = '0.6';
      let valueFillColor = 'var(--devui-primary-text)';
      
      if (node.selected && node.role === 'operation') {
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

@injectable()
export class AstgrOpView extends RectangularNodeView {
  override render(
    node: Readonly<SShapeElementImpl & Hoverable & Selectable>,
    context: RenderingContext,
    args?: IViewArgs,
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
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
    if (comGraphStore.data.visibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    // Selected nodes should never be dimmed
    const shouldDim = !isTraced && !node.selected;

    // Check if this is a CALL operation
    const astgrNode = node as unknown as AstgrNode;
    const isCallOperation = astgrNode.opcode === 'CALL';

    // Get subgraph color based on subgraphId (only if enabled)
    const subgraphId = astgrNode.subgraphId;
    // Check if subgraph coloring is enabled via the global flag instead of the model
    const coloringEnabled = window.colorBySubgraph || false;
    const fillColor = coloringEnabled && subgraphId !== undefined && subgraphId !== -1 ? SubgraphColor.getColor(subgraphId) : null; // Use null instead of undefined so CSS can take over

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
      console.log('Double-click detected on CALL operation:', astgrNode.calleehash);
      if (isCallOperation && astgrNode.calleehash && window.vsCodeApi) {
        window.vsCodeApi.postMessage({
          type: 'openSubgraph',
          calleehash: astgrNode.calleehash,
        });
      }
    };
    /* 矩形圆角 */
    let radius = 8;
    const rectWidth = Math.max(node.size.width, 0);
    const rectHeight = Math.min(node.size.height, 150);
    /* 右上角角标文字的宽度 */
    const badgeTextWidth = getTextWidth(node.magic, 10);
    /* 右上角角标左右padding和 */
    const badgePadding = 8;
    /* 右上角角标区域的宽高 */
    const badgeWidth = badgeTextWidth + badgePadding;
    const badgeHeight = 20;
    let badgeX = 5;
    let badgeY = 13;
    let badgePaddingTop = 0;
    let badgePaddingRight = 0;
    if (node.selected) {
      badgePaddingTop = 1;
      badgePaddingRight = 1;
      radius = 6;
      badgeX = 4;
      badgeY = 14;
    }

    /* root节点的类型判断 是否使用亮色 */
    let backgroundFillColor = node.baseColor;
    let backgroundFilter = '';
    let magicIdBgFillColor = 'var(--devui-node-badge-bg)';
    let magicIdTextFillColor = 'var(--devui-node-badge-text)';
    if (comGraphStore.data.inSelectedComGraphFlow || comGraphStore.data.inFixedComGraphFlow) {
      if (node.selected) {
        backgroundFillColor = node.lightColor;
        magicIdBgFillColor = 'var(--devui-op-node-badge-focus-bg)';
        magicIdTextFillColor = 'var(--devui-op-node-badge-focus-text)';
      }
      if (!incoming && !outgoing) {
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
          // {...(fillColor && { fill: backgroundFillColor })} // Only set fill attribute when we have a color
        ></rect>
        {opSign}
        {context.renderChildren(node, args)}
        <g transform={`translate(${node.size.width - badgeWidth}, 0)`}>
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
        </g>
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
    if (comGraphStore.data.visibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
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

@injectable()
export class AstgrTensorView extends RectangularNodeView {
  override render(
    node: Readonly<SShapeElementImpl & Hoverable & Selectable>,
    context: RenderingContext,
    args?: IViewArgs,
  ): VNode | undefined {
    if (!this.isVisible(node, context)) {
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
    if (comGraphStore.data.visibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    // Selected nodes should never be dimmed
    const shouldDim = !isTraced && !node.selected;
    /* 矩形圆角 */
    let radius = 8;
    const waveOffset1 = 2;
    const waveOffset2 = 7;
    /* 带波浪线的矩形宽高 */
    const width = Math.max(node.size.width, 0);
    const height = Math.max(node.size.height, 0);
    /* 右上角角标文字的宽度 */
    const badgeTextWidth = getTextWidth(node.magic, 10);
    /* 右上角角标左右padding和 */
    const badgePadding = 8;
    /* 右上角角标区域的宽高 */
    const badgeWidth = badgeTextWidth + badgePadding;
    const badgeHeight = 20;
    /* 蓝色标题区域的宽高 */
    const blueBgRectWidth = node.size.width;
    let blueBgRectPaddingLeft = 0;
    let blueBgRectPaddingTop = 0;
    let badgePaddingTop = 0;
    let badgePaddingRight = 0;
    let badgeX = 5;
    let badgeY = 13;
    let correctHeight = 9;
    let selectedWaveMargin = 0;
    if (node.selected) {
      if ((node.role !== 'input') && (node.role !== 'output')) {
        blueBgRectPaddingLeft = 0.5;
        blueBgRectPaddingTop = 0.5;
        badgePaddingTop = 0.5;
        badgePaddingRight = 0.5;
        radius = 8;
        badgeX = 4.5;
        badgeY = 14.5;
      } else {
        badgePaddingTop = 1;
        badgePaddingRight = 1;
        radius = 4;
        badgeX = 4;
        badgeY = 14;
        correctHeight = 10;
        selectedWaveMargin = 0.6;
      }
    }

    const blurBgRectHeight = 48;

    /* root节点的类型判断，是否使用亮色 */
    let titleBackgroundFillColor = node.baseColor;
    let inoutBackgroundFillColor = 'var(--devui-node-bg)';
    let magicIdTextFillColor = 'var(--devui-text)';
    let backgroundFilter = '';
    // 亮色逻辑判断 
    if (comGraphStore.data.inSelectedComGraphFlow || comGraphStore.data.inFixedComGraphFlow) {
      if (node.selected) {
        titleBackgroundFillColor = node.lightColor;
        inoutBackgroundFillColor = 'var(--devui-node-selected-bg)';
      }
      if (!incoming && !outgoing) {
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
      let isInput = true;
      const parent = node.parent;
      if (node.role === 'output') {
        isInput = false;
      }
      if (parent.zoom < 0.3) {
        if (isInput) {
          inoutBackgroundFillColor = isTraced ? 'var(--devui-in-tensor-mini-light)' : 'var(--devui-in-tensor-mini)';
        } else {
          inoutBackgroundFillColor = isTraced ? 'var(--devui-out-tensor-mini-light)' : 'var(--devui-out-tensor-mini)';
        }
      }
      rectNode = (
        <g>
          <path
            d={`M 0 ${height + correctHeight} L 0 ${radius} Q 0 0 ${radius} 0 L ${
              width - radius
            } 0 Q ${width} 0 ${width} ${radius} L ${width} ${height + correctHeight} Q ${(width / 4) * 3} ${height + correctHeight - waveOffset1 * 3} ${
              width / 2
            } ${height + correctHeight} T 0 ${height + correctHeight} Z`}
            fill={inoutBackgroundFillColor}
            class-tensor-inout-background-label={true}
            filter={backgroundFilter}
            class-tensor-diff-add={node.compareType === 'add'}
            class-tensor-diff-delete={node.compareType === 'delete'}
            class-tensor-diff-change={node.compareType === 'change'}
          ></path>
          <path
            d={`M ${selectedWaveMargin} ${height} L ${selectedWaveMargin} ${height + waveOffset1} Q ${width / 4} ${height + waveOffset1 * 4} ${width / 2} ${
              height + waveOffset1
            } T ${width - selectedWaveMargin} ${height + waveOffset1} L ${width - selectedWaveMargin} ${height} Q ${(width / 4) * 3} ${height - waveOffset1 * 3} ${
              width / 2
            } ${height} T 0 ${height} Z`}
            class-tensor-in-wave-label1={isInput}
            class-tensor-out-wave-label1={!isInput}
            filter={backgroundFilter}
          ></path>
          <path
            d={`M ${selectedWaveMargin} ${height + waveOffset1} L ${selectedWaveMargin} ${height + waveOffset1 + waveOffset2} Q ${width / 4} ${height + waveOffset1 + waveOffset2 * 2} ${width / 2} ${
              height + waveOffset1 + waveOffset2
            } T ${width - selectedWaveMargin} ${height + waveOffset1 + waveOffset2} L ${width - selectedWaveMargin} ${height + waveOffset1} Q ${(width / 4) * 3} ${height + waveOffset1 - waveOffset1 * 3} ${
              width / 2
            } ${height + waveOffset1} T 0 ${height + waveOffset1} Z`}
            class-tensor-in-wave-label2={isInput}
            class-tensor-out-wave-label2={!isInput}
            filter={backgroundFilter}
          ></path>
        </g>
      );
    }

    return (
      <g
        class-op-incoming={incoming}
        class-op-outgoing={outgoing}
        class-op-not-traced={shouldDim}
        class-mouseover={node.hoverFeedback}
        class-tensor-diff-normal={node.compareType === 'normal'}
      >
        {rectNode}
        {context.renderChildren(node, args)}
        <g transform={`translate(${node.size.width - badgeWidth}, 0)`}>
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
            fill='var(--devui-node-badge-bg)'
          ></path>
          <text x={badgeX} y={badgeY} font-size="10px" fill={magicIdTextFillColor} class-magicId-text={true}>
            {node.magic}
          </text>
        </g>
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
    if (!this.isVisible(node, context)) {
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
    if (comGraphStore.data.visibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
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
    if (!this.isVisible(node, context)) {
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
    if((edge.root as any)?.zoom < 0.05) {
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
    if (comGraphStore.data.visibleOtherNodes && comGraphStore.data.inFixedComGraphFlow && !isTraced) {
      return undefined;
    }
    let isParent = false;
    if (edge.role && edge.role === 'parent') {
      isParent = true;
    }

    const route = this.edgeRouterRegistry.route(edge, args);
    if (route.length === 0) {
      return this.renderDanglingEdge('Cannot compute route', edge, context);
    }
    if (!this.isVisible(edge, route, context)) {
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
export class AstgrPortView extends ShapeView {
  render(node: Readonly<SPortImpl>, context: RenderingContext, args?: IViewArgs): VNode | undefined {
    if (!this.isVisible(node, context)) {
      return undefined;
    }
    const isInPort = node.id.endsWith('-in');
    const direction = comGraphStore.data.layoutDirection;
    const xDelta = direction === 'RIGHT' ? 0 : 4;
    const circleELement = (
      <circle
        class-sprotty-port={true}
        class-mouseover={node.parent.hoverFeedback}
        class-selected={node.parent.selected}
        cx={isInPort ? Math.max(node.size.width, 0) - xDelta : 0 + xDelta}
        cy={Math.max(node.size.width, 0) / 2}
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
