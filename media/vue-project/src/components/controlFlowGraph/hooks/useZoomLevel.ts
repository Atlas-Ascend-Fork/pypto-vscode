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
import { BaseBehavior, BaseBehaviorOptions, CanvasEvent, GraphEvent, RuntimeContext } from '@antv/g6';

const DEFAULT_LEVEL = 'detailed';

export function useLevelOfDetail() {
  // 计算缩放等级用于隐藏细节
  class LevelOfDetail extends BaseBehavior {
    prevLevel = DEFAULT_LEVEL;
    levels = {
      ['overview']: [0, 0.3],
      ['detailed']: [0.3, Infinity],
    };

    /**
     * 初始化，参数由behavior自动传入
     * @param context 上下文
     * @param options 配置项
     */
    constructor(context: RuntimeContext, options: Partial<BaseBehaviorOptions>) {
      super(context, options);
      this.bindEvents();
    }

    /**
     * 更新节点数据
     * @param options 更新配置
     */
    override update(options: Partial<BaseBehaviorOptions>) {
      this.unbindEvents();
      super.update(options);
      this.bindEvents();
    }

    /**
     * 记录缩放等级
     * @param e 由监听器传入当前画布数据
     */
    updateZoomLevel = async (e: PointerEvent) => {
      const { graph } = this.context;
      if (e.data && 'scale' in e.data) {
        const scale = e.data.scale;
        const level = Object.entries(this.levels).find(([key, [min, max]]) => scale > min && scale <= max)?.[0];
        if (level && this.prevLevel !== level) {
          graph.updateNodeData((prev) => prev.map((node) => ({ ...node, data: { ...node.data, level } })));
          this.prevLevel = level;
        }
        graph.updateComboData((prev) => prev.map((node) => ({ ...node, data: { ...node.data, level, scale } })));

        await graph.draw();
      }
    };

    bindEvents() {
      const { graph } = this.context;
      graph.on(GraphEvent.AFTER_TRANSFORM, this.updateZoomLevel);
    }

    unbindEvents() {
      const { graph } = this.context;
      graph.off(CanvasEvent.WHEEL, this.updateZoomLevel);
    }

    override destroy() {
      this.unbindEvents();
      super.destroy();
    }
  }

  return {
    LevelOfDetail,
  };
}
