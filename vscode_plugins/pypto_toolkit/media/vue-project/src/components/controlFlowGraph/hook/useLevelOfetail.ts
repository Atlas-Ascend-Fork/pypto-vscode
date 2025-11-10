import { BaseBehavior, CanvasEvent, GraphEvent } from '@antv/g6';

export function useLevelOfDetail() {
  const DEFAULT_LEVEL = 'detailed';

  // 计算缩放等级用于隐藏细节
  class LevelOfDetail extends BaseBehavior {
    prevLevel = DEFAULT_LEVEL;
    levels = {
      ['overview']: [0, 0.3],
      ['detailed']: [0.3, Infinity],
    };

    constructor(context, options) {
      super(context, options);
      this.bindEvents();
    }

    update(options) {
      this.unbindEvents();
      super.update(options);
      this.bindEvents();
    }

    updateZoomLevel = async (e) => {
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

    destroy() {
      this.unbindEvents();
      super.destroy();
    }
  }

  return {
    LevelOfDetail,
  };
}
