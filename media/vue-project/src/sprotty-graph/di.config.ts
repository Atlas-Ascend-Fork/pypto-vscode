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
import { Container, ContainerModule, inject, injectable, optional } from 'inversify';
// ELK 布局内核
import { LayoutOptions } from 'elkjs/lib/elk-api';
import ElkConstructor from 'elkjs/lib/elk.bundled';
// sprotty-elk：把 ELK 接入 sprotty 布局体系
import {
  ElkFactory,
  ElkLayoutEngine,
  DefaultElementFilter,
  DefaultLayoutConfigurator,
  IElementFilter,
  ILayoutConfigurator,
  ILayoutPreprocessor,
  ILayoutPostprocessor,
} from 'sprotty-elk/lib/inversify';
import { Action, SGraph, SModelElement, SModelIndex, SNode, SPort } from 'sprotty-protocol';
import {
  // 模型元素实现类
  RectangularNode,
  SCompartmentImpl,
  SEdgeImpl,
  SGraphImpl,
  SLabelImpl,
  SModelElementImpl,
  SModelRootImpl,
  SNodeImpl,
  SRoutingHandleImpl,
  // DI 容器装配工具
  configureActionHandler,
  configureCommand,
  configureModelElement,
  configureViewerOptions,
  loadDefaultModules,
  LocalModelSource,
  TYPES,
  // 交互特性开关
  editFeature,
  hoverFeedbackFeature,
  moveFeature,
  // 命令、动画与视口判定
  Animation,
  CommandExecutionContext,
  UpdateAnimationData,
  UpdateModelCommand,
  ViewportAnimation,
  isSelectable,
  isViewport,
  // 鼠标监听与模型遍历
  MouseListener,
  SRoutingHandleView,
  findParentByFeature,
  // 日志
  ConsoleLogger,
  LogLevel,
  // 视图注册表的类型标注
  type CustomFeatures,
  type IView,
} from 'sprotty';
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

/** 计算图布局引擎：跳过无需布局的图，并把布局计算委托给外部布局服务，仅负责应用回传结果 */
@injectable()
class CustomElkLayoutEngine extends ElkLayoutEngine {
  private layoutWatchStop: (() => void) | null = null;

  // 依赖由 inversify 在解析时注入；布局前/后处理器是可选服务，未绑定时注入 undefined
  constructor(
    @inject(ElkFactory) elkFactory: ElkFactory,
    @inject(IElementFilter) protected readonly filter: IElementFilter,
    @inject(ILayoutConfigurator) protected readonly configurator: ILayoutConfigurator,
    @optional() @inject(ILayoutPreprocessor) protected readonly preprocessor?: ILayoutPreprocessor,
    @optional() @inject(ILayoutPostprocessor) protected readonly postprocessor?: ILayoutPostprocessor,
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
    if (this.layoutWatchStop) {
      this.layoutWatchStop();
      this.layoutWatchStop = null;
    }
    const elkGraph = this.transformGraph(sgraph, index);
    if (this.preprocessor) {
      this.preprocessor.preprocess(elkGraph, sgraph, index);
    }
    server.askLayout({ data: elkGraph });
    return new Promise((resolve, reject) => {
      this.layoutWatchStop = watch(server.LayoutResult, (newValue) => {
        if (!newValue.filePath || newValue.filePath === elkGraph.layoutOptions['PyPTO.filePath']) {
          const resultDirection = newValue.data?.layoutOptions?.['elk.direction'];
          if (!resultDirection || resultDirection === elkGraph.layoutOptions['elk.direction']) {
            this.layoutWatchStop?.();
            this.layoutWatchStop = null;
            resolve(newValue.data);
          }
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

/** ELK 布局模块：布局引擎注册为单例，依赖在解析时经构造器注入完成装配 */
const CustomElkLayoutModule = new ContainerModule((bind) => {
  bind(CustomElkLayoutEngine).toSelf().inSingletonScope();

  // 默认布局参数配置器；计算图模块随后会将其 rebind 为 AstgrLayoutConfigurator
  bind(ILayoutConfigurator).to(DefaultLayoutConfigurator);
  // 默认布局元素过滤器
  bind(IElementFilter).to(DefaultElementFilter);
});

/** 视图注册表复用的特性开关：禁用拖拽，节点位置完全交由 ELK 布局 */
const NO_DRAG: CustomFeatures = { disable: [moveFeature] };
/** 视图注册表复用的特性开关：禁用连线编辑，避免路由被手动改动 */
const NO_EDIT: CustomFeatures = { disable: [editFeature] };
/** 算子节点在禁用拖拽的基础上保留悬停反馈 */
const OP_NODE_FEATURES: CustomFeatures = { disable: [moveFeature], enable: [hoverFeedbackFeature] };

/** 单条“模型类型 → 渲染视图”的注册描述 */
interface AstgrViewRegistration {
  /** 模型元素的 type 标识 */
  type: string;
  /** 模型元素实现类，承载状态与交互特性 */
  model: new () => SModelElementImpl;
  /** 视图类，负责把模型渲染为 SVG 虚拟节点 */
  view: new () => IView;
  /** 相对模型类默认特性的增删 */
  features?: CustomFeatures;
}

/** 计算图全部元素类型的视图注册表 */
const ASTGR_VIEW_REGISTRATIONS: AstgrViewRegistration[] = [
  { type: 'graph', model: SGraphImpl, view: AstgrGraphView },
  { type: 'node', model: RectangularNode, view: AstgrOpView, features: OP_NODE_FEATURES },
  { type: 'node:input', model: RectangularNode, view: InputOutputNodeView, features: NO_DRAG },
  { type: 'node:output', model: RectangularNode, view: InputOutputNodeView, features: NO_DRAG },
  { type: 'node:tensor', model: RectangularNode, view: AstgrTensorView, features: NO_DRAG },
  { type: 'rect', model: RectangularNode, view: AstgrRectView, features: NO_DRAG },
  { type: 'port', model: SNodeImpl, view: AstgrPortView, features: NO_DRAG },
  { type: 'label', model: SLabelImpl, view: AstgrNodeLabelView },
  { type: 'edge', model: SEdgeImpl, view: AstgrEdge, features: NO_EDIT },
  { type: 'bottom', model: SEdgeImpl, view: BootomAstgrEdge, features: NO_EDIT },
  { type: 'compartment', model: SCompartmentImpl, view: CustomCompartmentView },
  { type: 'routing-point', model: SRoutingHandleImpl, view: SRoutingHandleView, features: NO_DRAG },
  { type: 'volatile-routing-point', model: SRoutingHandleImpl, view: SRoutingHandleView, features: NO_DRAG },
];

export function createDiContainer(sprottyContainerId: string): Container {
  // ELK 内核只注册分层布局算法，其余算法按需再扩展
  const layeredElkFactory: ElkFactory = () => new ElkConstructor({ algorithms: ['layered'] });

  // 计算图专属容器模块：在 sprotty 默认能力之上替换模型来源、布局配置与交互组件
  const comGraphModule = new ContainerModule((bind, _unbind, isBound, rebind) => {
    // 模型来源与布局引擎
    bind(TYPES.ModelSource)
      .to(LocalModelSource)
      .inSingletonScope();
    bind(TYPES.IModelLayoutEngine).toService(CustomElkLayoutEngine);
    bind(ElkFactory).toConstantValue(layeredElkFactory);

    // 布局参数：默认配置器之上叠加 PyPTO 计算图专属参数
    bind(AstgrLayoutConfigurator).toSelf().inSingletonScope();
    rebind(ILayoutConfigurator).to(AstgrLayoutConfigurator).inSingletonScope();

    // 日志收敛到 error 级别，避免 webview 控制台被布局日志刷屏
    rebind(TYPES.ILogger)
      .to(ConsoleLogger)
      .inSingletonScope();
    rebind(TYPES.LogLevel).toConstantValue(LogLevel.error);

    // 计算图定制的模型更新命令、右键菜单与鼠标监听
    rebind(UpdateModelCommand).to(SelectionFollowUpdateModelCommand);
    bind(TYPES.IContextMenuService).to(AstgrContextMenuService);
    bind(TYPES.IContextMenuItemProvider).to(AstgrContextMenuItemProvider);
    bind(TYPES.MouseListener).to(CustomMouseListener).inSingletonScope();
    configureCommand({ bind, isBound }, RectAnimateCommand);
    configureActionHandler({ bind, isBound }, 'rectAnimateAction', RectAnimateActionHandler);

    // 按“模型类型 → 视图”注册表批量完成元素绑定
    for (const { type, model, view, features } of ASTGR_VIEW_REGISTRATIONS) {
      configureModelElement({ bind, isBound }, type, model, view, features);
    }

    configureViewerOptions({ bind, isBound, rebind }, {
      needsClientLayout: true,
      baseDiv: sprottyContainerId,
      // 放宽缩放与滚动范围，适配大图漫游
      zoomLimits: { min: 0.0001, max: 10 },
      horizontalScrollLimits: { min: -800000, max: 800000 },
      verticalScrollLimits: { min: -800000, max: 800000 },
    });
  });

  const container = new Container();
  loadDefaultModules(container); // sprotty 默认模块
  container.load(CustomElkLayoutModule); // ELK 布局模块
  container.load(comGraphModule); // 计算图定制模块
  return container;
}

/**
 * 计算图 ELK 布局参数配置器。
 *
 * - graphOptions：图级算法、方向与层间距，并把 showTensor / filePath / renderMode
 *   透传给实际执行布局的进程；
 * - nodeOptions：在通用参数之上按节点角色叠加差异化配置；
 * - portOptions：按端口角色与布局方向决定端口在节点上的朝向。
 */
export class AstgrLayoutConfigurator extends DefaultLayoutConfigurator {
  /** tensor 节点尺寸更小、标签间距更紧凑 */
  private static readonly TENSOR_EXTRAS: LayoutOptions = {
    'org.eclipse.elk.nodeSize.minimum': '(50,30)',
    'org.eclipse.elk.spacing.labelNode': '3.0',
    'org.eclipse.elk.spacing.labelLabel': '2.0',
  };

  /** 节点角色 → 差异化参数；未列出的角色（input/output/operation/sync）沿用通用配置 */
  private static readonly ROLE_EXTRAS: Record<string, LayoutOptions> = {
    tensor: AstgrLayoutConfigurator.TENSOR_EXTRAS,
  };

  private layoutDirection: 'RIGHT' | 'DOWN' = 'RIGHT';
  private showTensor = 'true';
  private filePath = '';

  setLayoutDirection(direction: 'RIGHT' | 'DOWN'): void {
    this.layoutDirection = direction;
  }

  setShowTensor(show: boolean): void {
    this.showTensor = show ? 'true' : 'false';
  }

  setFilePath(path: string): void {
    this.filePath = path;
  }

  protected override graphOptions(sgraph: SGraph, _index: SModelIndex): LayoutOptions {
    // 节点规模过大时改用更快的摆放策略，牺牲少量布局质量换取耗时
    const nodeTotal = sgraph.children?.filter((child) => child.type.includes('node')).length ?? 0;
    const nodePlacement = nodeTotal > 10000 ? 'BRANDES_KOEPF' : 'LINEAR_SEGMENTS';
    return {
      'org.eclipse.elk.algorithm': 'org.eclipse.elk.layered',
      'org.eclipse.elk.layered.nodePlacement.strategy': nodePlacement,
      'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': '40.0',
      'elk.direction': this.layoutDirection,
      'PyPTO.showTensor': this.showTensor,
      'PyPTO.filePath': this.filePath,
      'PyPTO.renderMode': sgraph['renderMode'],
    };
  }

  protected override nodeOptions(snode: SNode, _index: SModelIndex): LayoutOptions {
    const role = (snode as AstgrNode).role;
    return {
      // 端口停靠边固定，位置由图结构决定
      'org.eclipse.elk.portConstraints': 'FIXED_SIDE',
      'org.eclipse.elk.nodeLabels.placement': 'INSIDE',
      ...AstgrLayoutConfigurator.ROLE_EXTRAS[role],
    };
  }

  protected override portOptions(sport: SPort, _index: SModelIndex): LayoutOptions {
    // 纵向布局：输入口朝北、输出口朝南；横向布局：输入口朝西、输出口朝东
    const vertical = this.layoutDirection === 'DOWN';
    const facing = (sport as AstgrPort).role === 'input' ? (vertical ? 'NORTH' : 'WEST') : (vertical ? 'SOUTH' : 'EAST');
    return {
      'org.eclipse.elk.port.borderOffset': '1',
      'org.eclipse.elk.port.side': facing,
    };
  }
}

/**
 * 模型增量更新（局部重布局）时，若被选中的节点发生位移，则让视口反向平移相同的量，
 * 使选中节点在屏幕上的位置保持稳定，便于持续观察该算子。
 */
class SelectionFollowUpdateModelCommand extends UpdateModelCommand {
  override createAnimations(data: UpdateAnimationData, root: SModelRootImpl, context: CommandExecutionContext): Animation[] {
    const animations = super.createAnimations(data, root, context);
    const movedSelection = data.moves?.find((item) => isSelectable(item.element) && item.element.selected);
    if (movedSelection && isViewport(root)) {
      animations.push(this.createViewportFollowAnimation(movedSelection, root, context));
    }
    return animations;
  }

  /** 生成一个与节点位移量等大反向的视口滚动动画 */
  private createViewportFollowAnimation(
    move: NonNullable<UpdateAnimationData['moves']>[number],
    root: SModelRootImpl,
    context: CommandExecutionContext,
  ): Animation {
    const shiftX = move.fromPosition.x - move.toPosition.x;
    const shiftY = move.fromPosition.y - move.toPosition.y;
    const { scroll, zoom } = root;
    return new ViewportAnimation(
      root,
      { scroll, zoom },
      {
        // 视口滚动方向与节点位移相反，抵消节点在屏幕上的移动
        scroll: { x: scroll.x - shiftX, y: scroll.y - shiftY },
        zoom,
      },
      context,
    );
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
    (window as any).ascEventBus.emit('view_mouseup', { node: target, area: moveArea });
    if (event.button === 0) {
      (window as any).ascEventBus.emit('view_left_mouseup', target);
    }
    return [];
  }

  mouseLeave(target: SModelElement, event: MouseEvent): Action[] {
    const moveArea = getCurrentArea(event);
    (window as any).ascEventBus.emit('view_mouseleave', [target.root.scroll.x, target.root.scroll.y, moveArea]);
    return [];
  }

  doubleClick(target: SModelElement, event: MouseEvent): Action[] {
    console.log('double click');
    if (target?.id.startsWith('operation') && !comGraphStore.data.comGraphConfig.isSimple && comGraphStore.data.comGraphConfig.canViewSubgraph) {
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
              query: { isSearch: false, nodeMagic: null }
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
      (window as any).ascEventBus.emit('viewer_update', {
        zoom: target.root.zoom,
        scroll: {
          x: target.root.scroll.x,
          y: target.root.scroll.y
        }
      });
    }, 0);
    return [];
  }
}
