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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Ref, watch } from 'vue';
import { ComboEvent, Graph, MinimapOptions, NodeEvent } from '@antv/g6';
import { getThemeColorTool } from '@/components/controlFlowGraph/util/getTheme';
import { useComboCardNodes } from './useComboNode';
import { ControlFlowNodesType, EdgesType, CombsType, PreviewState } from '../type/node-detail-types';

/**
 * 初始化绘图
 * @param container g6挂载容器
 * @param minimapOptions 小地图配置项
 * @param nodes 节点数据
 * @param edges 边数据
 * @param combos 组合数据
 * @param isDarkTheme 当前主题
 * @param combosNode 组合记录
 * @param codePreviewState 代码片段预览状态控制
 * @returns 返回graph实例
 */
export function useInitGraph(
  container: HTMLDivElement,
  minimapOptions: Ref<MinimapOptions>,
  nodes: ControlFlowNodesType[],
  edges: EdgesType[],
  combos: CombsType[],
  isDarkTheme: Ref<boolean>,
  combosNode: Ref<CombsType[]>,
  codePreviewState: PreviewState,
) {
  const { comboInitConfig } = useComboCardNodes(isDarkTheme, codePreviewState);

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
    animation:false
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

  const comboHoverClass = ['left-svg', 'hit-area', 'code-view-svg'];
  g6Graph.on(ComboEvent.POINTER_OVER, async (event) => {
    const { target, originalTarget } = event;
    if (comboHoverClass.includes(originalTarget.className)) {
      const currentStates = g6Graph.getElementState(target.id);
      await g6Graph.setElementState(target.id, [originalTarget.className, ...currentStates]);
    } else {
      const currentStates = g6Graph.getElementState(target.id);
      const newStates = currentStates.filter((state) => !comboHoverClass.includes(state));
      g6Graph.setElementState(target.id, newStates);
    }
  });
  g6Graph.on(ComboEvent.POINTER_LEAVE, async (event) => {
    const { target } = event;
    const currentStates = g6Graph.getElementState(target.id);
    const newStates = currentStates.filter((state) => !comboHoverClass.includes(state));
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
