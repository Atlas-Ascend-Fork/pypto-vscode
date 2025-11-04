import 'reflect-metadata'; // Sprotty's DI relies on this
import { LocalModelSource, TYPES } from 'sprotty';
import { createDiContainer, Rect } from './di.config';

import {
  FitToScreenAction,
  SNode,
  SelectAction,
  CenterAction,
  SetViewportAction,
  UpdateModelAction,
  HoverFeedbackAction
} from 'sprotty-protocol';
import { createMiniMapDiContainer } from './minimap-di.config';
import { comGraphStore } from '../service/com-graph-store';
import { ILayoutConfigurator } from 'sprotty-elk';
import { findNodeIdsBySemanticLabel } from '../utils/search';

declare const vscode: any;
const MAINMAP_TYPE = 1;
const MINIMAP_TYPE = 2;
const MAINMAP_WHEEL = 3;
const MAINMAP_FIT_SCREEN = 4;
export function useSprottyLoad(containerId?: string, filePath?: string) {
  const SPROTTY_CONTAINER_ID = containerId ?? 'sprotty';
  const renderType = filePath ?? '';
  const MINIMAP_ID = `${renderType}_minimap`;
  let container = createDiContainer(SPROTTY_CONTAINER_ID);
  const minimapContainer = createMiniMapDiContainer(MINIMAP_ID);
  let modelSource = container.get<LocalModelSource>(TYPES.ModelSource);
  const miniMapModelSource = minimapContainer.get<LocalModelSource>(TYPES.ModelSource);
  let originSprottyGraph;
  // Store the current data to allow re-rendering when settings change
  let currentLayoutConfig: any = {
    direction: 'RIGHT',
    showTensor: true,
    filePath: filePath ?? '',
  }
  if (filePath) {
    resetModelSource();
  }
  let currentData: unknown = null;

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

  const renderMinimap = (model?) => {
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
          });
        });
      }); // Use dispatch instead of dispatchAll
    });
  };

  async function getViewport(currentModel: LocalModelSource, type, zoom = 1, x = 1, y = 1) {
    try {
      const viewInfo = await currentModel.getViewport();
      if (type == MINIMAP_TYPE) {
        (window as any).ascEventBus.emit(`${renderType}_render-over`, [viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y]);
      }
      if (type == MAINMAP_TYPE) {
        (window as any).ascEventBus.emit(`${renderType}_master_render_over`, [viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y]);
      }
      if (type == MAINMAP_WHEEL) {
        setViewportAction(modelSource.model.id, viewInfo.scroll.x, viewInfo.scroll.y, zoom, false);
        (window as any).ascEventBus.emit(`${renderType}_view_zoom`, [zoom, viewInfo.scroll.x, viewInfo.scroll.y, false]);
      }
      if (type == MAINMAP_FIT_SCREEN) {
        (window as any).ascEventBus.emit(`${renderType}_view_zoom`, [viewInfo.zoom, viewInfo.scroll.x, viewInfo.scroll.y, true]);
      }
    } catch (error) {
      console.error('get model viewport error');
    }
  }

  function resetModelSource() {
    container = createDiContainer(SPROTTY_CONTAINER_ID);
    modelSource = container.get<LocalModelSource>(TYPES.ModelSource)
    const layoutConfigurator = container.get(
      ILayoutConfigurator
    ) as import("./di.config").AstgrLayoutConfigurator;
    comGraphStore.setData('layoutDirection', currentLayoutConfig.direction);
    layoutConfigurator.setLayoutDirection(currentLayoutConfig.direction);
    layoutConfigurator.setShowTensor(currentLayoutConfig.showTensor);
    layoutConfigurator.setFilePath(currentLayoutConfig.filePath);
  }

  // Function to update the graph with current settings
  const updateGraph = (isDark, option?) => {
    if (!currentData) return;

    const showTensorNodes = option?.showTensorNodes ?? true;
    const showSyncNodes = option?.showSyncNodes ?? false;
    const selectedSubgraphId = option?.subgraphFilterSelect;
    if (option?.showTensorNodes !== undefined) {
      currentLayoutConfig.showTensor = showTensorNodes;
      resetModelSource();
    }

    let nodeMagic;
    if (option?.openMode === 'path') {
      nodeMagic = option?.nodeMagic;
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
      nodeMagic
    };
    (window as any).vscode.postMessage({
      type: 'getJsonGraphData',
      data
    });
    window.addEventListener('message', (event) => {
      if (event.data.type === 'postJsonGraphData' && (!filePath || filePath === event.data.data.filePath)) {
        (window as any).ascEventBus.emit('comGraphRendering', 'rendering');
        const sprottyGraph = event.data.data;
        sprottyGraph['renderMode'] = option?.openMode || 'all';

        originSprottyGraph = JSON.parse(JSON.stringify(sprottyGraph));
    
        const nodeCount = sprottyGraph.children?.filter((child) => child.type.includes('node')).length || 0;
        const edgeCount = sprottyGraph.children?.filter((child) => child.type.includes('edge')).length || 0;
        console.log(`Graph stats: ${nodeCount} nodes, ${edgeCount} edges`);
        modelSource
          .setModel(sprottyGraph)
          .then(() => {
            //第一个incast节点，聚焦左上方展示
            if (modelSource.model) {
              if (!sprottyGraph.isFinial && !nodeMagic) {
                (window as any).vscode.postMessage({
                  type: 'setFinalResult',
                  data: modelSource.model,
                  layout: currentLayoutConfig
                });
              } else {
                (window as any).ascEventBus.emit('layoutEnding', true);
              }
              renderMinimap(modelSource.model);
            }
            if (!sprottyGraph.children) return;
            let node: SNode | undefined;
            fitGraphToScreen();
          })
          .catch((error) => {
            console.error('Error setting model:', error);
          });
      }
    });
  };

  const minimapRectMoveListener = (args) => {
    setViewportAction(modelSource.model.id, args[0], args[1], args[2], false);
  };

  const minimapCenterListener = (args) => {
    setMinimapViewportAction(args[0], args[1], args[2], false);
  };

  const mainMapWheelListener = (args) => {
    getViewport(modelSource, MAINMAP_WHEEL, args);
  };

  const mainMapFitscreenListener = (args) => {
    fitToScreenAction();
  };

  (window as any).ascEventBus.on(`${renderType}_minimap_rect_move`, minimapRectMoveListener);

  (window as any).ascEventBus.on('minimap_center', minimapCenterListener);

  (window as any).ascEventBus.on(`${renderType}_mainmap_wheel`, mainMapWheelListener);

  (window as any).ascEventBus.on(`${renderType}_mainmap_fitscreen`, mainMapFitscreenListener);

  // Handle subgraph coloring
  const colorBySubGraph = (colorBySubgraph) => {
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
    const selectedElements = (await modelSource.getSelection()).map((e) => e.id) as string[];
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
    const selectedElements = elementIdsPara.length ? elementIdsPara : ((await modelSource.getSelection()).map((e) => e.id) as string[]);
    if (selectedElements.length > 0) {
      const options = {
        animate: animatePara,
        retainZoom: retainZoomPara,
        zoomScale: zoomScalePara,
      };
      modelSource.actionDispatcher.dispatch(CenterAction.create(selectedElements, options)).then(() => {
        getViewport(modelSource, MAINMAP_FIT_SCREEN);
      });
    }
  };

  const selectAction = async (elementIdsPara: string[]) => {
    const selectedIds = (await modelSource.getSelection()).map((e) => e.id) as string[];
    const selectAction: SelectAction = {
      kind: 'elementSelected',
      selectedElementsIDs: elementIdsPara,
      deselectedElementsIDs: selectedIds ?? [],
    };
    modelSource.actionDispatcher.dispatch(selectAction);
  };

  const initComDocText = (jsonData: Object, isDark = true, openMode: string, nodeMagic: number) => {
    try {
      currentData = jsonData; // Store the data
      updateGraph(isDark, {openMode, nodeMagic}); // Use the updateGraph function
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
      })
    }
  }
  // Signal to VS Code that the webview is ready to receive data
  vscode.postMessage({ type: 'webviewReady' });

  comGraphStore.setData('centerNodeActionFunc', centerNodeAction);
  comGraphStore.setData('renderMinimapFunc', renderMinimap);
  comGraphStore.setData('updateModelActionFunc', updateModelAction);

  // 同步diff双图移动
  const syncDiffView = (args) => {
    setViewportAction(modelSource.model.id, args[0], args[1], args[2], false);
  }

  const createSelectNodesRect = async (semantic_lable : string, isLocate: boolean) => {
    const selectedNodes =  findNodeIdsBySemanticLabel(currentData, semantic_lable);
    if (selectedNodes.length <= 0) {
      removeSelectNodesRect();
      return;
    }
      
    if (comGraphStore.data.selectedNodeSemanticLabel !== semantic_lable) {
      const index = modelSource.currentRoot.children.findIndex((t, i) => {
        return t.type.includes('node');
      })
      modelSource.removeElements([{elementId:'show-node-rect', parentId: modelSource.currentRoot.children[index - 1].id}]);
      comGraphStore.data.selectedNodeSemanticLabel = semantic_lable;
      const newRect = new Rect();
      newRect.id = 'show-node-rect';
      newRect.customSize = {width: 0, height: 0};
      newRect.position = {x: 0, y: 0};
      newRect.selectedNodes = selectedNodes;
      newRect.needCalPostion = true;
  
      modelSource.model.notNeedLayout = true;
      await modelSource.addElements([{element: newRect, parentId: modelSource.currentRoot.children[index - 1].id}]);
    }
    const fitAction: FitToScreenAction = {
      maxZoom: 2.0, // Increased from 0.01 to allow normal zoom levels
      padding: 50, // Reduced padding
      kind: 'fit',
      elementIds: selectedNodes,
      animate: true,
    };
    isLocate && modelSource.actionDispatcher.dispatch(fitAction).then(() => {
      getViewport(modelSource, MAINMAP_FIT_SCREEN);
    }); 
    modelSource.model.notNeedLayout = true;
  }

  const removeSelectNodesRect = async () => {
    comGraphStore.data.stableRect = false;
    comGraphStore.data.selectedNodeSemanticLabel = '';
    modelSource.model.notNeedLayout = true;
    await modelSource.removeElements(['show-node-rect']);
    modelSource.model.notNeedLayout = false;
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
    hoverFeedbackAction
  };
}
