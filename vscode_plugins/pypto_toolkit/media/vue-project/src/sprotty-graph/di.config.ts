import { LayoutOptions } from 'elkjs/lib/elk-api';
import ElkConstructor from 'elkjs/lib/elk.bundled';
import { Container, ContainerModule, injectable } from 'inversify';
import {
  Animation,
  CommandExecutionContext,
  configureModelElement,
  configureViewerOptions,
  ConsoleLogger,
  editFeature,
  isSelectable,
  isViewport,
  loadDefaultModules,
  LocalModelSource,
  LogLevel,
  moveFeature,
  hoverFeedbackFeature,
  RectangularNode,
  SEdgeImpl,
  SGraphImpl,
  SLabelImpl,
  SModelRootImpl,
  SNodeImpl,
  SRoutingHandleImpl,
  SRoutingHandleView,
  TYPES,
  UpdateAnimationData,
  UpdateModelCommand,
  ViewportAnimation,
  SCompartmentImpl,
  MouseListener,
  SModelElementImpl,
  findParentByFeature,
  configureCommand,
  configureActionHandler,
} from 'sprotty';
import {
  DefaultElementFilter,
  DefaultLayoutConfigurator,
  ElkFactory,
  ElkLayoutEngine,
  IElementFilter,
  ILayoutConfigurator,
  ILayoutPostprocessor,
  ILayoutPreprocessor,
} from 'sprotty-elk/lib/inversify';
import { Action, Point, SGraph, SModelElement, SModelIndex, SNode, SPort } from 'sprotty-protocol';
import {
  AstgrEdge,
  AstgrGraphView,
  AstgrNodeLabelView,
  AstgrRectView,
  AstgrOpView,
  AstgrPortView,
  AstgrTensorView,
  InputOutputNodeView,
  CustomCompartmentView,
  BootomAstgrEdge,
} from './views';
import { AstgrNode, AstgrPort } from './graph.types';
import { AstgrContextMenuItemProvider, AstgrContextMenuService } from './menu';
import { comGraphStore } from '../service/com-graph-store';
import { getCurrentArea, isNode } from '../utils/index';
import { useViewServer } from '../core/use-view-server';
import { watch } from 'vue';

import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { RectAnimateActionHandler, RectAnimateCommand } from './animation';

const { server } = useViewServer<IComViewServer>();

@injectable()
class CustomElkLayoutEngine extends ElkLayoutEngine {
  constructor(
    elkFactory: ElkFactory,
    protected readonly filter: IElementFilter,
    protected readonly configurator: ILayoutConfigurator,
    protected readonly preprocessor?: ILayoutPreprocessor,
    protected readonly postprocessor?: ILayoutPostprocessor,
  ) {
    super(elkFactory, filter, configurator, preprocessor, postprocessor);
  }
  override layout(sgraph: SGraph, index?: SModelIndex): SGraph | Promise<SGraph> {
    if (sgraph.notNeedLayout) {
      return sgraph;
    }
    if (this.getBasicType(sgraph) !== 'graph') {
      return sgraph;
    }
    if (!index) {
      index = new SModelIndex();
      index.add(sgraph);
    }
    if (sgraph['isFinial']) {
      return sgraph;
    }
    const elkGraph = this.transformGraph(sgraph, index);
    if (this.preprocessor) {
      this.preprocessor.preprocess(elkGraph, sgraph, index);
    }
    server.askLayout({ data: elkGraph });
    return new Promise((resolve, reject) => {
      watch(server.LayoutResult, (newValue) => {
        if (!newValue.filePath || newValue.filePath === elkGraph.layoutOptions['PyPTO.filePath']) {
          resolve(newValue.data);
        }
      });
    }).then((result: any) => {
      if (this.postprocessor) {
        this.postprocessor.postprocess(result, sgraph, index!);
      }
      this.applyLayout(result, index!);
      return sgraph;
    });
  }
}

const CustomElkLayoutModule = new ContainerModule((bind) => {
  bind(CustomElkLayoutEngine)
    .toDynamicValue((context) => {
      const elkFactory = context.container.get<ElkFactory>(ElkFactory);
      const elementFilter = context.container.get<IElementFilter>(IElementFilter);
      const layoutConfigurator = context.container.get<ILayoutConfigurator>(ILayoutConfigurator);
      const layoutPreprocessor = context.container.isBound(ILayoutPreprocessor)
        ? context.container.get<ILayoutPreprocessor>(ILayoutPreprocessor)
        : undefined;
      const layoutPostprocessor = context.container.isBound(ILayoutPostprocessor)
        ? context.container.get<ILayoutPostprocessor>(ILayoutPostprocessor)
        : undefined;
      return new CustomElkLayoutEngine(elkFactory, elementFilter, layoutConfigurator, layoutPreprocessor, layoutPostprocessor);
    })
    .inSingletonScope();
  bind(IElementFilter).to(DefaultElementFilter);
  bind(ILayoutConfigurator).to(DefaultLayoutConfigurator);
});

export function createDiContainer(sprottyContainerId: string) {
  const elkFactory: ElkFactory = () =>
    new ElkConstructor({
      algorithms: ['layered'],
    });

  const randomGraphModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(TYPES.ModelSource).to(LocalModelSource).inSingletonScope();

    bind(TYPES.IModelLayoutEngine).toService(CustomElkLayoutEngine);
    bind(ElkFactory).toConstantValue(elkFactory);

    bind(AstgrLayoutConfigurator).toSelf().inSingletonScope();
    rebind(ILayoutConfigurator).to(AstgrLayoutConfigurator).inSingletonScope();

    rebind(TYPES.ILogger).to(ConsoleLogger).inSingletonScope();
    rebind(TYPES.LogLevel).toConstantValue(LogLevel.error);
    rebind(UpdateModelCommand).to(TrackSelectedUpdateModelCommand);
    bind(TYPES.IContextMenuService).to(AstgrContextMenuService);
    bind(TYPES.IContextMenuItemProvider).to(AstgrContextMenuItemProvider);
    bind(TYPES.MouseListener).to(CustomMouseListener).inSingletonScope();
    const context = { bind, unbind, isBound, rebind };
    configureCommand(context, RectAnimateCommand);
    configureActionHandler(context, 'rectAnimateAction', RectAnimateActionHandler);

    configureModelElement(context, 'graph', SGraphImpl, AstgrGraphView);
    configureModelElement(context, 'node:input', RectangularNode, InputOutputNodeView, {
      disable: [moveFeature],
    });

    configureModelElement(context, 'node:output', RectangularNode, InputOutputNodeView, {
      disable: [moveFeature],
    });

    configureModelElement(context, 'node', RectangularNode, AstgrOpView, {
      disable: [moveFeature],
      enable: [hoverFeedbackFeature],
    });

    configureModelElement(context, 'node:tensor', RectangularNode, AstgrTensorView, {
      disable: [moveFeature],
    });

    configureModelElement(context, 'port', SNodeImpl, AstgrPortView, {
      disable: [moveFeature],
    });

    configureModelElement(context, 'label', SLabelImpl, AstgrNodeLabelView);

    configureModelElement(context, 'rect', RectangularNode, AstgrRectView, {
      disable: [moveFeature],
    });

    configureModelElement(context, 'bottom', SEdgeImpl, BootomAstgrEdge, {
      disable: [editFeature],
    });

    configureModelElement(context, 'edge', SEdgeImpl, AstgrEdge, {
      disable: [editFeature],
    });

      configureModelElement(context, 'compartment', SCompartmentImpl, CustomCompartmentView);

    configureModelElement(context, 'routing-point', SRoutingHandleImpl, SRoutingHandleView, {
      disable: [moveFeature],
    });
    configureModelElement(context, 'volatile-routing-point', SRoutingHandleImpl, SRoutingHandleView, {
      disable: [moveFeature],
    });

    configureViewerOptions(context, {
      needsClientLayout: true,
      baseDiv: sprottyContainerId,
      zoomLimits: { min: 0.0001, max: 10 },
      horizontalScrollLimits: { min: -400000, max: 400000 },
      verticalScrollLimits: { min: -400000, max: 400000 },
    });
  });

  const container = new Container();
  loadDefaultModules(container); // Sprotty's default modules
  container.load(CustomElkLayoutModule); // Elk layout module
  container.load(randomGraphModule); // Your custom module

  return container;
}

export class AstgrLayoutConfigurator extends DefaultLayoutConfigurator {
  private layoutDirection: 'RIGHT' | 'DOWN' = 'RIGHT';
  private showTensor = 'true';
  private filePath = '';

  setLayoutDirection(direction: 'RIGHT' | 'DOWN') {
    this.layoutDirection = direction;
  }

  getLayoutDirection() {
    return this.layoutDirection;
  }

  setShowTensor(show: boolean) {
    this.showTensor = show ? 'true' : 'false';
  }

  setFilePath(path: string) {
    this.filePath = path;
  }

  protected override graphOptions(sgraph: SGraph, _index: SModelIndex): LayoutOptions {
    // Count nodes for performance optimization
    const nodeCount = sgraph.children?.filter((child) => child.type.includes('node')).length || 0;
    return {
      'org.eclipse.elk.algorithm': 'org.eclipse.elk.layered',
      //"org.eclipse.elk.layered.crossingMinimization.semiInteractive": "true",
      'org.eclipse.elk.layered.nodePlacement.strategy': nodeCount > 10000 ? 'BRANDES_KOEPF' : 'LINEAR_SEGMENTS',
      'elk.direction': this.layoutDirection,
      //"org.eclipse.elk.spacing.nodeNode": "30.0", // Reduced from 40.0 for tighter layout
      //"org.eclipse.elk.spacing.nodeNodeBetweenLayers": "25.0", // Reduced layer spacing
      'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': '40.0', // Also set layered-specific spacing
      'PyPTO.showTensor': this.showTensor,
      'PyPTO.filePath': this.filePath,
      'PyPTO.renderMode': sgraph['renderMode'],
      //"org.eclipse.elk.spacing.labelNode": "5.0",
      //"org.eclipse.elk.spacing.labelLabel": "2.0",
      //"elk.nodeLabels.placement": "INSIDE H_CENTER V_CENTER",
      //"elk.nodeSize.minimum": "(70,45)", // Reduced for more compact labels
      //"elk.nodeSize.constraints": "NODE_LABELS MINIMUM_SIZE",
    };
  }

  protected override nodeOptions(snode: SNode, _index: SModelIndex): LayoutOptions {
    const role = (snode as AstgrNode).role;
    const base: LayoutOptions = {
      //'org.eclipse.elk.nodeSize.constraints': 'PORTS NODE_LABELS',
      //'org.eclipse.elk.nodeSize.minimum': '(100, 40)',
      'org.eclipse.elk.portConstraints': 'FIXED_SIDE',
      'org.eclipse.elk.nodeLabels.placement': 'INSIDE',
      //'org.eclipse.elk.portLabels.placement': 'OUTSIDE',
      //'org.eclipse.elk.nodeSize.options' : 'UNIFORM_PORT_SPACING'
    };

    if (role === 'input') {
      return {
        ...base,
        // 'org.eclipse.elk.layered.layering.layerConstraint': 'FIRST'
      };
    }
    if (role === 'output') {
      return {
        ...base,
        // 'org.eclipse.elk.layered.layering.layerConstraint': 'LAST'
      };
    }
    if (role === 'tensor') {
      return {
        ...base,
        //'org.eclipse.elk.nodeSize.constraints': 'NODE_LABELS',
        'org.eclipse.elk.nodeSize.minimum': '(50,30)',
        'org.eclipse.elk.spacing.labelNode': '3.0',
        'org.eclipse.elk.spacing.labelLabel': '2.0',
      };
    }
    if (role === 'operation') {
      return {
        ...base,
        //'org.eclipse.elk.nodeSize.constraints': 'PORTS NODE_LABELS MINIMUM_SIZE',
        //'org.eclipse.elk.nodeSize.fixedGraphSize': 'true',
        //'org.eclipse.elk.nodeSize.minimum': '(80,60)', // Reduced size for more compact layout
        //'org.eclipse.elk.nodeLabels.placement': 'INSIDE H_CENTER V_CENTER'
      };
    }
    if (role === 'sync') {
      return {
        ...base,
        //'org.eclipse.elk.nodeSize.minimum': '(60,25)', // Smaller minimum size for sync nodes
        //'org.eclipse.elk.portConstraints': 'FREE', // No ports needed for sync nodes
        //'org.eclipse.elk.spacing.nodeNode': '15.0' // Tighter spacing for sync nodes
      };
    }
    return base;
  }

  protected override portOptions(sport: SPort, _index: SModelIndex): LayoutOptions {
    const role = (sport as AstgrPort).role;
    const base: LayoutOptions = {
      'org.eclipse.elk.port.borderOffset': '1',
    };

    if (role === 'input') {
      return {
        ...base,
        'org.eclipse.elk.port.side': this.layoutDirection === 'DOWN' ? 'NORTH' : 'WEST',
      };
    } else {
      return {
        ...base,
        'org.eclipse.elk.port.side': this.layoutDirection === 'DOWN' ? 'SOUTH' : 'EAST',
      };
    }
  }
}

/**
 * Moves the viewport so that the selected element stays at the same position on the screen.
 */
export class TrackSelectedUpdateModelCommand extends UpdateModelCommand {
  override createAnimations(data: UpdateAnimationData, root: SModelRootImpl, context: CommandExecutionContext): Animation[] {
    const animations = super.createAnimations(data, root, context);
    const selectedToMove = data.moves?.find((toMove) => isSelectable(toMove.element) && toMove.element.selected);
    if (isViewport(root) && selectedToMove) {
      const nodeMove: Point = {
        x: selectedToMove.fromPosition.x - selectedToMove.toPosition.x,
        y: selectedToMove.fromPosition.y - selectedToMove.toPosition.y,
      };
      const { scroll, zoom } = root;
      animations.push(
        new ViewportAnimation(
          root,
          { scroll, zoom },
          {
            scroll: { x: scroll.x - nodeMove.x, y: scroll.y - nodeMove.y },
            zoom,
          },
          context,
        ),
      );
    }
    return animations;
  }
}

let mouseDownTimer: ReturnType<typeof setTimeout>;
let mouseUpTimer: ReturnType<typeof setTimeout>;
@injectable()
export class CustomMouseListener extends MouseListener {
  mouseDown(target: SModelElement, event: MouseEvent): Action[] {
    const moveArea = getCurrentArea(event);
    if (target.id !== 'root') {
      mouseDownTimer = setTimeout(() => {
        const node = findParentByFeature(target, (e) => e.selected === true);
        (window as any).ascEventBus.emit('selected_node_change', [node, moveArea]);
        clearTimeout(mouseDownTimer);
      });
    }
    (window as any).ascEventBus.emit('view_mousedown', 'current not');
    return []; // 可返回要派发的操作
  }

  mouseOver(target: SModelElement, event: MouseEvent): Action[] {
    (window as any).ascEventBus.emit('view_mouseover');
    if (target instanceof SGraphImpl) {
      (window as any).ascEventBus.emit('closeNodeTip', true);
      if (!comGraphStore.data.stableRect) {
        (window as any).ascEventBus.emit('rect_node_leave');
      }
    }
    if (target instanceof RectangularNode) {
      if ((target.root as any).zoom < 0.5) {
        (window as any).ascEventBus.emit('showNodeTip', target);
      }
      if (target.id !== 'show-node-rect' && !comGraphStore.data.stableRect) {
        (window as any).ascEventBus.emit('rect_node_hover', { semanticLabel: target.semanticLabel });
      }
    }
    return [];
  }

  mouseMove(target: SModelElement, event: MouseEvent): Action[] {
    const moveArea = getCurrentArea(event);
    if (target.id == 'root') {
      (window as any).ascEventBus.emit('view_mousemove', [target.scroll.x, target.scroll.y, target.zoom, moveArea]);
    } else {
      const root = findParentByFeature(target, (e) => e.id === 'root');
      if (root) {
        (window as any).ascEventBus.emit('view_mousemove', [root.scroll.x, root.scroll.y, root.zoom, moveArea]);
      }
    }
    return [];
  }

  mouseUp(target: SModelElement, event: MouseEvent): Action[] {
    const moveArea = getCurrentArea(event);
    let root;
    if (target.id === 'show-node-rect') {
      comGraphStore.data.stableRect = true;
    }
    if (target.id === 'root') {
      comGraphStore.data.stableRect = false;
      (window as any).ascEventBus.emit('rect_node_leave');
      mouseUpTimer = setTimeout(() => {
        const selectedNodes = target.children?.filter((e) => isNode(e as any) && (e as any).selected).map((e) => e.id);
        if (!selectedNodes?.length) {
          (window as any).ascEventBus.emit('selected_node_change', [null, moveArea]);
        }
        clearTimeout(mouseUpTimer);
      });
      root = target;
    } else {
      root = findParentByFeature(target, (e) => e.id === 'root');
    }
    (window as any).ascEventBus.emit('view_mouseup', target);
    return [];
  }

  mouseLeave(target: SModelElement, event: MouseEvent): Action[] {
    const moveArea = getCurrentArea(event);
    (window as any).ascEventBus.emit('view_mouseleave', [target.root.scroll.x, target.root.scroll.y, moveArea]);
    return [];
  }

  doubleClick(target: SModelElement, event: MouseEvent): Action[] {
    console.log('double click');
    if (target?.id.startsWith('operation') && comGraphStore.data.comGraphConfig.canViewSubgraph) {
      let current = target;
      while (current) {
        if ('calleehash' in current) {
          if ('calleeMap' in comGraphStore.data && current.calleehash in comGraphStore.data.calleeMap) {
            const funcName = comGraphStore.data.calleeMap[current.calleehash];

            const newPath = [
              ...(typeof comGraphStore.data.curPath == 'string' ? JSON.parse(comGraphStore.data.curPath) : comGraphStore.data.curPath),
            ];
            newPath.push(current.calleehash);
            const curPathList = JSON.stringify(newPath);

            const first = current.children?.[0] as unknown as SCompartmentImpl;
            const calleeOpSubgraphId = first.subgraphId;
            server.getSubgraph({
              paramObj: {
                calleehash: current.calleehash,
                subFuncmagicname: funcName.func_magicname,
                curPath: curPathList,
                calleeOpMagic: current.magic,
                calleeOpSubgraphId: calleeOpSubgraphId,
              },
            });
          }
          break;
        }
        current = current.parent;
      }
    }
    (window as any).ascEventBus.emit('view_doubleClick', target);

    return [];
  }

  wheel(target: SModelElementImpl, event: WheelEvent): Action[] {
    const moveArea = getCurrentArea(event);
    (window as any).ascEventBus.emit('closeNodeTip', true);
    setTimeout(() => {
      (window as any).ascEventBus.emit('view_zoom', [target.root.zoom, target.root.scroll.x, target.root.scroll.y, false, moveArea]);
    }, 0);
    return [];
  }
}
