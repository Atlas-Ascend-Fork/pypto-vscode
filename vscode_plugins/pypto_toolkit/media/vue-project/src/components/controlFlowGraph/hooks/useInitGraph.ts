import { Ref, watch } from 'vue';
import { Graph, MinimapOptions, NodeEvent } from '@antv/g6';
import { getThemeColorTool } from '@/components/controlFlowGraph/util/getTheme';
import { useComboCardNodes } from './useComboNode';
import { ControlFlowNodesType, EdgesType, CombsType } from '../type/node-detail-types';

export function useInitGraph(
  container: HTMLDivElement,
  minimapOptions: Ref<MinimapOptions>,
  nodes: ControlFlowNodesType[],
  edges: EdgesType[],
  combos: CombsType[],
  isDarkTheme: Ref<boolean>,
  combosNode: Ref<CombsType[]>,
) {
  const { comboInitConfig } = useComboCardNodes(isDarkTheme);

  const PATH_CARD_NODE_TYPE = 'path-card-node';
  const g6Graph = new Graph({
    container: container,
    plugins: [
      //   小地图
      minimapOptions.value,
      //  画布背景
      {
        type: 'background',
        key: 'my-background', // 为插件指定标识符，方便动态更新
        backgroundColor: 'var(--control-flow-bg)', // 设置背景色
        backgroundRepeat: 'space',
        backgroundPosition: '10px ',
        backgroundSize: 'fit',
        opacity: '0.1',
      },
      {
        type: 'tooltip',
        key: 'my-tooltip',
        // 只对if节点启用，边不显示tooltip
        enable: (e, itemes) => itemes[0].type === 'if-card-node',
        getContent: (e, items) => {
          return `<div>${items[0].data.source.magicName}</div>`;
        },
        style: {
          '.tooltip': {
            visibility: 'hidden',
            background: getThemeColorTool('devui-tooltip-bg', isDarkTheme.value),
            color: getThemeColorTool('control-flow-tip-color', isDarkTheme.value),
          },
        },
      },
    ],
    data: {
      nodes,
      edges,
      combos,
    },
    node: {
      style: {
        size: (d) => {
          const data = d.data;
          if (d.type === PATH_CARD_NODE_TYPE) {
            return data.errorStats ? [200, Object.keys(data.errorStats).length * 30 + 140] : [200, 140];
          } else {
            return [200, 100];
          }
        },
        border: 1,
        halo: false, // 启用光晕
        haloLineWidth: 0,
        ports: [
          {
            placement: 'top',
          },
          {
            placement: 'bottom',
          },
        ],
      },
      // 各种状态下的样式
      state: {
        selected: {
          lineWidth: 0,
        },
        active: {
          lineWidth: 0,
        },
        inactive: {
          opacity: 1,
        },
      },
    },
    combo: comboInitConfig,
    behaviors: [
      'level-of-detail',
      {
        type: 'click-select',
        degree: 1,
        state: 'selected', // 选中的状态
        neighborState: '', // 相邻节点附着状态
        multiple: true,
        trigger: ['shift'],
      },
      'zoom-canvas',
      'hover-activate',
      {
        type: 'drag-canvas',
        enable: (event) => {
          return event.targetType === 'node' || 'canvas' || 'combo';
        },
      },
    ],
  });

  // path内hover事件
  const lineHoverClass = ['func_bg_0', 'func_bg_1', 'func_bg_2', 'path-label', 'path-icon-left'];
  g6Graph.on(NodeEvent.POINTER_OVER, async (event) => {
    const { target, originalTarget } = event;
    if (lineHoverClass.includes(originalTarget.className)) {
      const currentStates = g6Graph.getElementState(target.id);
      await g6Graph.setElementState(target.id, [originalTarget.className, ...currentStates]);
    } else {
      const currentStates = g6Graph.getElementState(target.id);
      const newStates = currentStates.filter((state) => !lineHoverClass.includes(state));
      g6Graph.setElementState(target.id, newStates);
    }
  });

  g6Graph.on(NodeEvent.POINTER_LEAVE, async (event) => {
    const { target } = event;
    const currentStates = g6Graph.getElementState(target.id);
    const newStates = currentStates.filter((state) => !lineHoverClass.includes(state));
    g6Graph.setElementState(target.id, newStates);
  });

  // 监听主题变化
  watch(
    () => isDarkTheme.value,
    async () => {
      g6Graph.draw();
      await g6Graph.render();
      combosNode.value.forEach((node) => {
        const id = node.id;
        g6Graph.setElementState(id, []);
      });
      g6Graph.updatePlugin({
        key: 'my-tooltip',
        style: {
          '.tooltip': {
            visibility: 'hidden',
            background: getThemeColorTool('devui-tooltip-bg', isDarkTheme.value),
            color: getThemeColorTool('control-flow-tip-color', isDarkTheme.value),
          },
        },
      });
    },
  );

  return {
    g6Graph,
  };
}
