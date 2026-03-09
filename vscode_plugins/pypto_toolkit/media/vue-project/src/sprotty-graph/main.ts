import 'reflect-metadata'; // Sprotty's DI relies on this
import { LocalModelSource, SModelRootImpl, TYPES, SCompartmentImpl } from 'sprotty';
import { createDiContainer } from './di.config';
import { createSvg } from './svgExport';
import { findDestNode, findNeighborNode } from './menu';

import { FitToScreenAction, SNode, SelectAction, CenterAction, SetViewportAction, UpdateModelAction,
  HoverFeedbackAction } from 'sprotty-protocol';
import { createMiniMapDiContainer } from './minimap-di.config';
import { comGraphStore } from '../service/com-graph-store';
import { ILayoutConfigurator } from 'sprotty-elk';
import { findNodeIdsBySemanticLabel } from '../utils/search';
import { useViewServer } from '../core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { toRaw, watch } from 'vue';
import { cancelRectAnimation, startRectAnimation } from './animation';

const { server } = useViewServer<IComViewServer>();
declare const vscode: any;
const MAINMAP_TYPE = 1;
const MINIMAP_TYPE = 2;
const MAINMAP_WHEEL = 3;
const MAINMAP_FIT_SCREEN = 4;

export function useSprottyLoad(containerId?: string, filePath?: 'before' | 'after') {
  const SPROTTY_CONTAINER_ID = containerId ?? 'sprotty';
  const renderType = filePath ?? '';
  const MINIMAP_ID = `${renderType}_minimap`;
  let container = createDiContainer(SPROTTY_CONTAINER_ID);
  const minimapContainer = createMiniMapDiContainer(MINIMAP_ID);
  let modelSource = container.get<LocalModelSource>(TYPES.ModelSource);
  let miniMapModelSource = minimapContainer.get<LocalModelSource>(TYPES.ModelSource);
  let originSprottyGraph: { isFinial: boolean; };
  // Store the current data to allow re-rendering when settings change
  let currentLayoutConfig: any = {
    direction: 'RIGHT',
    showTensor: true,
    filePath: filePath ?? '',
  };
  if (filePath) {
    resetModelSource();
  }
  let currentData: unknown = null;
  let jsonGraphWatchHandle;

  // Track subgraph coloring state
  let colorBySubgraph = false;

  // Initialize global flag for views
  window.colorBySubgraph = colorBySubgraph;

  // Function to fit graph to screen
  const fitGraphToScreen = (animate: boolean = false) => {
    const fitAction: FitToScreenAction = {
      maxZoom: 1.0, // Increased from 0.01 to allow normal zoom levels
      padding: 50, // Reduced padding
      kind: 'fit',
      elementIds: [],
      animate: animate,
    };
    modelSource.actionDispatcher.dispatch(fitAction).then(() => {
      getViewport(modelSource, MAINMAP_FIT_SCREEN);
    }); // Use dispatch instead of dispatchAll
  };

  const resetMiniMap = () => {
    jsonGraphWatchHandle?.stop();
    const minimapContainer = createMiniMapDiContainer(MINIMAP_ID);
    miniMapModelSource = minimapContainer.get<LocalModelSource>(TYPES.ModelSource);
  }

  const renderMinimap = (model?: any) => {
    miniMapModelSource.updateModel(model || modelSource.model).then(() => {
      const fitAction: FitToScreenAction = {
        maxZoom: 1.0, // Increased from 0.01 to allow normal zoom levels
        padding: 50, // Reduced padding
        kind: 'fit',
        center: true,
        elementIds: [],
        animate: false,
      };
      miniMapModelSource.actionDispatcher.dispatch(fitAction).then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            getViewport(modelSource, MAINMAP_TYPE);
            getViewport(miniMapModelSource, MINIMAP_TYPE);
            modelSource.getViewport().then((viewInfo: { zoom: any; scroll: any; }) => {
              (window as any).ascEventBus.emit('viewer_update', {
                model: modelSource.model,
                zoom: viewInfo.zoom,
                scroll: viewInfo.scroll
              })
            });
            
            (window as any).ascEventBus.emit('layoutEnding', filePath);
          });
        });
      });
    });
  };

  async function getViewport(currentModel: LocalModelSource, type: number, zoom = 1, x = 0, y = 0) {
    try {
      const viewInfo = await currentModel.getViewport();
      if (type == MINIMAP_TYPE) {
        (window as any).ascEventBus.emit(`${renderType}_render-over`, [viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y]);
      }
      if (type == MAINMAP_TYPE) {
        (window as any).ascEventBus.emit(`${renderType}_master_render_over`, [viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y]);
      }
      if (type == MAINMAP_WHEEL) {
        if(!x && !y) {
          x = viewInfo.scroll.x * (viewInfo.zoom / zoom);
          y = viewInfo.scroll.y * (viewInfo.zoom / zoom);
        }
        (window as any).ascEventBus.emit(`viewer_update`, {
          zoom, 
          scroll: {
            x,
            y
          }
        });
        setViewportAction(modelSource.model.id, x, y, zoom, false);
        (window as any).ascEventBus.emit('minimap-wheel', [zoom, x, y, renderType]);
        (window as any).ascEventBus.emit(`${renderType}_view_zoom`, [zoom, x, y, false]);
      }
      if (type == MAINMAP_FIT_SCREEN) {
        (window as any).ascEventBus.emit(`${renderType}_view_zoom`, [viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y, true]);
        (window as any).ascEventBus.emit(`viewer_update`, {
          zoom: viewInfo.zoom, 
          scroll: {
            x: viewInfo.scroll.x,
            y: viewInfo.scroll.y
          }
        });
      }
    } catch (error) {
      console.error('get model viewport error');
    }
  }

  function resetModelSource(resetHandle?: boolean) {
    if (resetHandle) {
      jsonGraphWatchHandle?.stop();
    }
    container = createDiContainer(SPROTTY_CONTAINER_ID);
    modelSource = container.get<LocalModelSource>(TYPES.ModelSource);
    const layoutConfigurator = container.get(ILayoutConfigurator) as import('./di.config').AstgrLayoutConfigurator;
    comGraphStore.setData('layoutDirection', currentLayoutConfig.direction);
    layoutConfigurator.setLayoutDirection(currentLayoutConfig.direction);
    layoutConfigurator.setShowTensor(currentLayoutConfig.showTensor);
    layoutConfigurator.setFilePath(currentLayoutConfig.filePath);
  }

  // Function to update the graph with current settings
  const updateGraph = (isDark: boolean, option?: { openMode: any; nodeMagic: any; searchLevel: number; isThreeMode: any; showTensorNodes?: any; showSyncNodes?: any; subgraphFilterSelect?: any; }) => {
    if (!currentData) return;

    const showTensorNodes = option?.showTensorNodes ?? true;
    const showSyncNodes = option?.showSyncNodes ?? false;
    const selectedSubgraphId = option?.subgraphFilterSelect;
    const isThreeMode = option?.isThreeMode ?? false;
    if (option?.showTensorNodes !== undefined) {
      currentLayoutConfig.showTensor = showTensorNodes;
      resetModelSource(true);
    }

    let nodeMagic: any;
    let searchLevel: any;
    if (option?.openMode === 'path') {
      nodeMagic = option?.nodeMagic;
      searchLevel = option?.searchLevel;
      if (searchLevel > -2) {
        resetModelSource(true);
      }
    }
    const data = {
      layout: currentLayoutConfig,
      comGraphData: JSON.parse(JSON.stringify(comGraphStore.data)),
      filePath,
      currentData,
      showTensorNodes,
      showSyncNodes,
      colorBySubgraph,
      isDark,
      selectedSubgraphId,
      nodeMagic,
      searchLevel,
      version: comGraphStore.data.version,
      threeMode: isThreeMode
    };
    server.getJsonGraphData({ data: data, diffType: filePath });
    jsonGraphWatchHandle = watch(server.JsonGraphData, (newValue: any) => {
      comGraphStore.setData("isCached", newValue.isCached);
      if (!filePath || filePath === newValue.data.filePath) {
        (window as any).ascEventBus.emit('comGraphRendering', 'rendering');
        const sprottyGraph = toRaw(newValue.data) ;
        sprottyGraph['renderMode'] = option?.openMode || 'all';

        originSprottyGraph = JSON.parse(JSON.stringify(sprottyGraph));

        const nodeCount = sprottyGraph.children?.filter((child: { type: string | string[]; }) => child.type.includes('node')).length || 0;
        const edgeCount = sprottyGraph.children?.filter((child: { type: string | string[]; }) => child.type.includes('edge')).length || 0;
        console.log(`Graph stats: ${nodeCount} nodes, ${edgeCount} edges`);
        modelSource
          .setModel(sprottyGraph)
          .then(async () => {
            //第一个incast节点，聚焦左上方展示
            if (modelSource.model) {
              if (!sprottyGraph.isFinial && !nodeMagic) {
                server.setFinalResult({ data: modelSource.model, layout: currentLayoutConfig, threeMode: isThreeMode });
              }
              if ((searchLevel !== undefined) && (searchLevel > -1)) {
                resetMiniMap();
                renderMinimap(modelSource.model);
              } else {
                renderMinimap(modelSource.model);
              }
            }
            if (!sprottyGraph.children) return;
            let node: SNode | undefined;
            fitGraphToScreen();
          })
          .catch((error: any) => {
            console.error('Error setting model:', error);
          });
      }
    });
  };

  const minimapRectMoveListener = (args: number[]) => {
    setViewportAction(modelSource.model.id, args[0], args[1], args[2], false);
  };

  const minimapCenterListener = (args: number[]) => {
    setMinimapViewportAction(args[0], args[1], args[2], false);
  };

  const mainMapWheelListener = (args: number) => {
    getViewport(modelSource, MAINMAP_WHEEL, args);
  };

  const mainMapFitscreenListener = (args: any) => {
    fitToScreenAction();
  };

  const svgExportRequestListener = (args: boolean) => {
    requestExportSvgAction(args);
  };

  const jump2SiblingNodeListener = (args: string) => {
    centerNodeAction([args]);
    selectAction([args]);
  }

  const jump2SiblingNodeByHotKeyListener = (args: any) => {
    const selectedNodeId = args.nodeId;
    const eventKey = args.eventKey;
    const [previousNodeId, nextNodeId] = findNeighborNode(selectedNodeId, modelSource.currentRoot as unknown as Readonly<SModelRootImpl>);

    const buttonPos = (eventKey === 'ArrowLeft') ? 'left': 'right';
    const destNode = (eventKey === 'ArrowLeft') ? previousNodeId : nextNodeId;
    let newNodeId = '';
    newNodeId = findDestNode(selectedNodeId, buttonPos, destNode);
    
    (window as any).ascEventBus.emit('jump2SiblingNode', newNodeId);
  }

  const SearchModeOpenListener = (args: any) => {
    const data = {
      nodeMagic: args,
      funcHash: typeof comGraphStore.data.curPath === "string" ? JSON.parse(comGraphStore.data.curPath).at(-1) : comGraphStore.data.curPath[0]
    };
    server.openSearchMode({data});
  }

  const openSubGraphInThreeColumn = (params: Record<string, any>) => {
    const funcName = comGraphStore.data.calleeMap[params.selectedNode.calleehash];
    const newPath = [
      ...(typeof comGraphStore.data.curPath == 'string' ? JSON.parse(comGraphStore.data.curPath) : comGraphStore.data.curPath),
    ];
    newPath.push(params.selectedNode.calleehash);
    const curPathList = JSON.stringify(newPath);
    const first = params.selectedNode.children?.[0] as unknown as SCompartmentImpl;
    const calleeOpSubgraphId = first.subgraphId;
    server.getSubgraph({
      paramObj: {
        calleehash: params.selectedNode.calleehash,
        subFuncmagicname: funcName.func_magicname,
        curPath: curPathList,
        calleeOpMagic: params.selectedNode.magic,
        calleeOpSubgraphId: calleeOpSubgraphId,
      },
      query: { isSearch: false, nodeMagic: null }
    });
  };

  (window as any).ascEventBus.on(`${renderType}_minimap_rect_move`, minimapRectMoveListener);

  (window as any).ascEventBus.on('minimap_center', minimapCenterListener);

  (window as any).ascEventBus.on(`${renderType}_mainmap_wheel`, mainMapWheelListener);

  (window as any).ascEventBus.on(`${renderType}_mainmap_fitscreen`, mainMapFitscreenListener);

  (window as any).ascEventBus.on(`svgOutput`, svgExportRequestListener);

  (window as any).ascEventBus.on(`jump2SiblingNode`, jump2SiblingNodeListener);

  (window as any).ascEventBus.on('SearchModeOpen', SearchModeOpenListener);

  (window as any).ascEventBus.on('OpenSubGraphInThreeColumn', openSubGraphInThreeColumn);

  (window as any).ascEventBus.on('jump2SiblingNodeByHotKey', jump2SiblingNodeByHotKeyListener);

  // Handle subgraph coloring
  const colorBySubGraph = (colorBySubgraph: boolean) => {
    console.log('Subgraph coloring checkbox changed:', colorBySubgraph);

    // Store the global flag for views to access
    window.colorBySubgraph = colorBySubgraph;

    // Force a re-render by dispatching an empty update action
    // This should trigger the views to re-render without changing the model structure
    const updateAction = {
      kind: 'updateModel',
      newRoot: modelSource.model,
      animate: false,
    };

    console.log('Triggering view refresh for subgraph coloring');
    modelSource.actionDispatcher.dispatch(updateAction);
  };

  const fitToScreenAction = async () => {
    // First clear any selections
    const selectedElements = (await modelSource.getSelection()).map((e: { id: any; }) => e.id) as string[];
    if (selectedElements.length > 0) {
      const selectAction: SelectAction = {
        kind: 'elementSelected',
        selectedElementsIDs: [],
        deselectedElementsIDs: selectedElements,
      };
      modelSource.actionDispatcher.dispatch(selectAction);
    }

    // Then fit to screen
    fitGraphToScreen(true);
  };

  // 获取到缩略图几何矩形后 把矩形映射到主图坐标系的路径范围 x y
  const setViewportAction = async (rootId: string, x: number, y: number, zoomPara: number, animatePara?: boolean) => {
    // 让主图把这块区域居中并调整缩放到对应比例
    const newViewport = {
      scroll: { x, y },
      zoom: zoomPara,
    };
    const options = {
      animate: animatePara,
    };
    modelSource.actionDispatcher.dispatch(SetViewportAction.create(rootId, newViewport, options));
  };

  const requestExportSvgAction = async (copyStyles?: boolean) => {
    const originViewInfo = await modelSource.getViewport();
    const x: number = originViewInfo.scroll.x;
    const y: number = originViewInfo.scroll.y;
    const svgViewport = {
      scroll: {x, y},
      zoom: 1.0,
    };
    const viewOptions = {
      animate: false,
    }

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    await modelSource.actionDispatcher.dispatch(SetViewportAction.create(modelSource.model.id, svgViewport, viewOptions));
    await delay(1000);

    const svgElement =  document.getElementById('sprotty').querySelector('svg');

    createSvg(svgElement, copyStyles);

    await modelSource.actionDispatcher.dispatch(SetViewportAction.create(modelSource.model.id, originViewInfo, viewOptions));
  }

  /* 手动触发原生update用于更新视图 */
  const hoverFeedbackAction = () => {
    modelSource.actionDispatcher.dispatch(HoverFeedbackAction.create({mouseIsOver:true, mouseoverElement: 'root'}));
  }

  const setMinimapViewportAction = async (x: number, y: number, zoomPara: number, animatePara?: boolean) => {
    // 让主图把这块区域居中并调整缩放到对应比例
    const newViewport = {
      scroll: { x, y },
      zoom: zoomPara,
    };
    const options = {
      animate: animatePara,
    };
    miniMapModelSource.actionDispatcher.dispatch(SetViewportAction.create(miniMapModelSource.model.id, newViewport, options));
  };

  const centerNodeAction = async (elementIdsPara: string[], animatePara?: boolean, retainZoomPara?: boolean, zoomScalePara?: number) => {
    const selectedElements = elementIdsPara.length ? elementIdsPara : ((await modelSource.getSelection()).map((e: { id: any; }) => e.id) as string[]);
    if (selectedElements.length > 0) {
      const options = {
        animate: animatePara,
        retainZoom: retainZoomPara,
        zoomScale: zoomScalePara,
      };

      const nodeVisibleFlag = !!modelSource.currentRoot?.children.find( t => selectedElements.includes(t.id));

      if (!nodeVisibleFlag) {
        (window as any).ascEventBus.emit('node_hidden_message_notice', 'comGraph.searchingNodeUntraced');
        return;
      }

      modelSource.actionDispatcher.dispatch(CenterAction.create(selectedElements, options)).then(() => {
        getViewport(modelSource, MAINMAP_FIT_SCREEN);

        modelSource.getViewport().then((viewInfo: { zoom: any; scroll: any; }) => {
          (window as any).ascEventBus.emit('viewer_update', {
            model: modelSource.model,
            zoom: viewInfo.zoom,
            scroll: viewInfo.scroll
          })
        });
      });
    }
  };

  const selectAction = async (elementIdsPara: string[]) => {
    const selectedIds = (await modelSource.getSelection()).map((e: { id: any; }) => e.id) as string[];
    const selectAction: SelectAction = {
      kind: 'elementSelected',
      selectedElementsIDs: elementIdsPara,
      deselectedElementsIDs: selectedIds ?? [],
    };
    modelSource.actionDispatcher.dispatch(selectAction);
  };

  const initComDocText = (jsonData: Object, isDark = true, openMode: string, nodeMagic: number, searchLevel = -1, isThreeMode=false) => {
    try {
      currentData = jsonData; // Store the data
      updateGraph(isDark, { openMode, searchLevel, nodeMagic, isThreeMode }); // Use the updateGraph function
    } catch (e) {
      console.error('Error parsing JSON or building graph:', e);
      // Display error in webview?
      const containerDiv = document.getElementById(SPROTTY_CONTAINER_ID);
      if (containerDiv) containerDiv.innerHTML = `<p style="color:red;">Error rendering graph: ${e}</p>`;
    }
    return;
  };

  const updateModelAction = async (animate?: boolean, cause?: boolean) => {
    const options = {
      animate: animate,
      cause: cause,
    };
    modelSource.actionDispatcher.dispatch(UpdateModelAction.create(modelSource.currentRoot, options));
  };

  const getSelectedNodeId = async () => {
    const node = await modelSource.getSelection();
    if (node.length > 0) {
      return node[0].id;
    }
    return;
  };
  const setModelDirection = (direction: 'RIGHT' | 'DOWN') => {
    if (currentLayoutConfig.direction !== direction) {
      currentLayoutConfig.direction = direction;
      resetModelSource();
      originSprottyGraph.isFinial = false;
      modelSource.setModel(originSprottyGraph).then(() => {
        fitGraphToScreen();
        renderMinimap(modelSource.model);
      });
    }
  };
  // Signal to VS Code that the webview is ready to receive data
  vscode.postMessage({ type: 'webviewReady' });

  comGraphStore.setData('centerNodeActionFunc', centerNodeAction);
  comGraphStore.setData('renderMinimapFunc', renderMinimap);
  comGraphStore.setData('updateModelActionFunc', updateModelAction);

  // 同步diff双图移动
  const syncDiffView = (args: number[]) => {
    setViewportAction(modelSource.model.id, args[0], args[1], args[2], false);
  };

  // diff拖拽同步结束后，更新双图当前坐标
  const updateDiffViewport = () => {
    getViewport(modelSource, MAINMAP_FIT_SCREEN);
  }

  const createSelectNodesRect = async (semantic_lable : string, isLocate: boolean) => {
    const selectedNodes =  findNodeIdsBySemanticLabel(currentData, semantic_lable);
    if (selectedNodes.length <= 0) {
      removeSelectNodesRect();
      return;
    }
      
    if (comGraphStore.data.selectedNodeSemanticLabel !== semantic_lable) {
      const firstNode = modelSource.currentRoot.children.find((t: { type: string | string[]; }, i: any) => {
        return t.type.includes('node');
      })
      modelSource.model.notNeedLayout = true;
      const firstEdge = modelSource.currentRoot.children.find(
        (t: any) => t.id === 'node-bottom-edge'
      );

      modelSource.removeElements([{elementId:'show-node-rect', parentId: firstEdge.id}]);
      comGraphStore.data.selectedNodeSemanticLabel = semantic_lable;
      const newRect = {
        id: 'show-node-rect',
        type: 'rect',
        position: {x: 0, y: 0},
        size: { width: 120, height: 80 },
        customSize: {width: 0, height: 0},
        selectedNodes,
        needCalPostion: true
      };
      await modelSource.addElements([{element: newRect, parentId: firstEdge.id}]);
    }
    const fitAction: FitToScreenAction = {
      maxZoom: 2.0, // Increased from 0.01 to allow normal zoom levels
      padding: 50, // Reduced padding
      kind: 'fit',
      elementIds: selectedNodes,
      animate: false,
    };
    isLocate && modelSource.actionDispatcher.dispatch(fitAction).then(() => {
      getViewport(modelSource, MAINMAP_FIT_SCREEN);
    });

    startRectAnimation(modelSource);
  }

  const removeSelectNodesRect = async () => {
    cancelRectAnimation();
    comGraphStore.data.stableRect = false;
    comGraphStore.data.selectedNodeSemanticLabel = '';
    const node = modelSource.currentRoot.children?.find((t: { id: string; }) => {
        return t.id === 'node-bottom-edge';
    })
    if (node?.children?.length) {
      await modelSource.removeElements([{elementId:'show-node-rect', parentId: node.id}]);
    }
  }

  // 获取所有节点
  const getModelSourceChildren = () => {
    return modelSource.model.children ?? [];
  }

  return {
    fitToScreenAction,
    initComDocText,
    colorBySubGraph,
    centerNodeAction,
    selectAction,
    setViewportAction,
    updateGraph,
    getSelectedNodeId,
    setModelDirection,
    syncDiffView,
    createSelectNodesRect,
    removeSelectNodesRect,
    resetModelSource,
    hoverFeedbackAction,
    updateDiffViewport,
    getModelSourceChildren
  };
}
