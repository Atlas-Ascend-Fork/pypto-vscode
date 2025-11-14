import { eventTextSize, getFontStyle } from '../../swimGraphUtils';
import { Dependencies } from './utils';

export class EventRender {
  deps: Dependencies;

  constructor(dependencies: Dependencies) {
    this.deps = dependencies;
  }

  drawEvent(eventDatas: any, ctx: CanvasRenderingContext2D, isDimmed = false) {
    const { viewState, colorCfg } = this.deps;
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
      ctx.rect(drawData.rectX, drawData.rectY, width, drawData.height);
      ctx.fill();
      if (drawData.strokeColor && width * viewState.scale > 10) {
        ctx.stroke();
      }
    }
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