import { EventRender } from './eventRender';
import { Dependencies } from './utils';

export const spaceInThreeCol = 2;

interface Point {
  leftTop: [number, number];
  rightTop: [number, number];
  leftBottom: [number, number];
  rightBottom: [number, number];
  width: number;
}

export class ThreeRender extends EventRender {
  declare deps: Dependencies;

  constructor(dependencies: Dependencies) {
    super(dependencies);
  }

  // 三栏模式，高亮描边
  drawBoundary(boundaries: any, processKey: string) {
    const { viewState, isDarkTheme } = this.deps;
    const boundaryCanvas: HTMLCanvasElement = document.querySelector(`[data-three-column-process-key="${processKey}"]`);
    if (!boundaryCanvas) return;
    const boundaryCtx = boundaryCanvas.getContext('2d');
    if (!boundaryCtx) return;
    boundaryCtx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
    if (!boundaries) return;

    const space = spaceInThreeCol;
    const xSpace = space / viewState.scale;
    const { minLeft, maxRight } = boundaries.reduce((acc, group) => {
      return group.reduce((groupAcc, item) => {
        const [left] = item.leftTop;
        const [right] = item.rightTop;
        return {
          minLeft: Math.min(groupAcc.minLeft, left),
          maxRight: Math.max(groupAcc.maxRight, right)
        };
      }, acc);
    }, { minLeft: Infinity, maxRight: -Infinity });
    const isAtLeftEdge = viewState.offsetX === 0 && minLeft <= xSpace;
    const isAtRightEdge = viewState.offsetX === 0 && maxRight >= viewState.canvasWidth;
    // 计算每个区域的左右边界范围
    const tempRegions = boundaries.map(region => {
      return region.map((row: any) => {
        const leftX = isAtLeftEdge ? row.leftTop[0] : row.leftTop[0] - xSpace;
        const rightX = isAtRightEdge ? row.rightTop[0] : row.rightTop[0] + xSpace;
        const topY = row.leftTop[1] - space;
        const bottomY = row.leftBottom[1] + space;
        return {
          leftTop: [leftX, topY],
          leftBottom: [leftX, bottomY],
          rightTop: [rightX, topY],
          rightBottom: [rightX, bottomY],
          width: rightX - leftX
        };
      });
    });
    boundaryCtx.fillStyle = isDarkTheme.value ? 'rgba(49, 127, 255, 0.2)' : 'rgba(10, 89, 247, 0.2)';
    boundaryCtx.strokeStyle = isDarkTheme.value ? '#317AF7' : '#0A59F7';
    boundaryCtx.lineWidth = 1 / viewState.scale;
    // 遍历每个区域并绘制路径
    let lineArray: Point[] = [];
    this.drawPath(boundaryCtx, tempRegions, lineArray);
    // 绘制不同区域的连线
    this.drawConnectLines(lineArray, boundaryCtx);
  }

  private drawPath(ctx: CanvasRenderingContext2D, tempRegions: Point[][], lineArray: any) {
    tempRegions.forEach((region, index) => {
      ctx.beginPath();
      const [ firstRow ] = region;
      const lastRow = region[region.length - 1];
      if (index === 0 || index === tempRegions.length - 1) {
        lineArray.push(index === 0 ? lastRow : firstRow);
      } else {
        lineArray.push(firstRow);
        if (region.length > 1) {
          lineArray.push(lastRow);
        }
      }
      // 起点：首行左上
      ctx.moveTo(...firstRow.leftTop);
      // 绘制左边界
      for (let i = 0; i < region.length; i++) {
        const currentRow = region[i];
        if (i === 0) {
          // 首行：直接左上 -> 左下
          ctx.lineTo(...currentRow.leftBottom);
        } else {
          const preRow = region[i - 1];
          // 从上一行左下 -> 水平移动到当前行X坐标 -> 垂直上升到当前行左上
          const [preLeftBottomX] = preRow.leftBottom;
          const [currLeftBottomX] = currentRow.leftBottom;
          const [preRightBottomX] = preRow.rightBottom;
          const [currRightBottomX] = currentRow.rightBottom;
          const isNodeRegistration = Math.abs(preLeftBottomX - currLeftBottomX) < currentRow.width;
          const isLineCross = (Math.abs(preLeftBottomX - currLeftBottomX) - currentRow.width) === (Math.abs(preRightBottomX - currRightBottomX) - preRow.width);
          if (!isLineCross || isNodeRegistration) {
            ctx.lineTo(preLeftBottomX, currentRow.leftTop[1]);  // 水平过渡
          }
          ctx.lineTo(...currentRow.leftTop);  // 垂直上升
          ctx.lineTo(...currentRow.leftBottom);  // 垂直上升
        }
      }
      // 绘制右边界
      // 从最下行左下 -> 右下
      ctx.lineTo(...lastRow.rightBottom);
      for (let i = region.length - 1; i >= 0; i--) {
        const currentRow = region[i];
        if (i === region.length - 1) {
          // 最下行： 直接右下 -> 右上
          ctx.lineTo(...currentRow.rightTop);
        } else {
          const nextRow = region[i + 1];
          // 从下一行右上 -> 水平移动到当前行X坐标 -> 垂直下降到当前行右下
          const isNodeRegistration = Math.abs(currentRow.leftBottom[0] - nextRow.leftBottom[0]) < nextRow.width;
          const isLineCross = (Math.abs(currentRow.leftBottom[0] - nextRow.leftBottom[0]) - nextRow.width) === (Math.abs(currentRow.rightBottom[0] - nextRow.rightBottom[0]) - currentRow.width);
          if (!isLineCross || isNodeRegistration) {
            ctx.lineTo(nextRow.rightTop[0], currentRow.rightBottom[1]);  // 水平过渡
          }
          ctx.lineTo(...currentRow.rightBottom);  // 垂直上升
          ctx.lineTo(...currentRow.rightTop);  // 垂直下降
        }
      }
      // 闭合路径: 首行右上 -> 左下
      ctx.lineTo(...firstRow.rightTop);
      ctx.lineTo(...firstRow.leftTop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }

  private drawConnectLines(lineArray: Point[], ctx: CanvasRenderingContext2D) {
    if (!lineArray.length || lineArray.length < 2 || !ctx) {
      return;
    }
    lineArray.slice(0, -1).forEach((current, i) => {
      const next = lineArray[i + 1];
      const [cp1, cp2] = this.calculateControlPoints(current.rightBottom, next.leftTop);
      ctx.beginPath();
      ctx.moveTo(...current.rightBottom);
      ctx.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], ...next.leftTop);
      ctx.stroke();
    });
  }

  private calculateControlPoints(start: [number, number], end: [number, number]) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    // 根据目标点在上方调整控制点逻辑
    const isAbove = end[1] < start[1];  // 判断是否在上方
    return [
      // 第一个控制点： 向右下方偏移
      [start[0] + (absDx * 0.3), start[1] + (absDy * (isAbove ? 0.2 : 0.4))],
      // 第二个控制点： 向左上方偏移
      [end[0] - (absDx * 0.3), end[1] - (absDy * (isAbove ? 0.4 : 0.2))]
    ];
  }
}