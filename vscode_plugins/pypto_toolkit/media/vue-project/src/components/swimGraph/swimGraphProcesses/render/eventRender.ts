import { eventTextSize, getFontStyle } from '../../swimGraphUtils';
import { Dependencies } from './utils';

export class EventRender {
  deps: Dependencies;

  constructor(dependencies: Dependencies) {
    this.deps = dependencies;
  }

  drawEvent(eventDatas: any, ctx: CanvasRenderingContext2D, isDimmed = false) {
    const { viewState, colorCfg } = this.deps;
    const devicePixelRatio = window.devicePixelRatio || 1;
    // 当偏移量过大时，Canvas的float32变换矩阵会出现精度丢失，导致图形抖动或消失，此时切换到js手动计算坐标的高精度模式。
    const useHighPrecision = Math.abs(viewState.pixelOffsetX) > 100000;
    ctx.save();
    if (useHighPrecision) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.setTransform(viewState.pixelScale, 0, 0, devicePixelRatio, viewState.pixelOffsetX, 0);
    }
    
    for (const drawData of eventDatas) {
      if (!drawData) {
        continue;
      }
      let width: number;
      if (drawData.eventWidth < viewState.minWidth) {
        width = viewState.minWidth;
      } else {
        width = drawData.eventWidth;
      }

      ctx.fillStyle = isDimmed ? colorCfg.eventRectNoColor : drawData.rectColor;
      ctx.strokeStyle = drawData.strokeColor;
      ctx.beginPath();
      if (useHighPrecision) {
        const x = drawData.rectX * viewState.pixelScale + viewState.pixelOffsetX;
        const y = drawData.rectY * devicePixelRatio;
        const w = width * viewState.pixelScale;
        const h = drawData.height * devicePixelRatio;
        ctx.rect(x, y, w, h);
      } else {
        ctx.rect(drawData.rectX, drawData.rectY, width, drawData.height);
      }
      ctx.fill();
      if (drawData.strokeColor && width * viewState.scale > 10) {
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawEventText(drawDatas: any, ctx: CanvasRenderingContext2D, isDimmed = false) {
    const { colorCfg } = this.deps;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const { show, text, textX, textY, fontColor } of drawDatas) {
      if (!show || !text) { continue }
      ctx.fillStyle = isDimmed ? colorCfg.eventFontNoColor : fontColor;
      ctx.font = getFontStyle(eventTextSize);
      ctx.fillText(text, textX, textY);
    }

    ctx.restore();
  }
}