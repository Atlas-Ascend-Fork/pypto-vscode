import { devicePixelRatio } from '../../swimGraphUtils';

export interface Dependencies {
  viewState: any;
  isDarkTheme: any;
  spaceInThreeCol: number;
  colorCfg: any;
  selectedEvent: any;
  highlightedPaths: any;
  devicePixelRatio: number;
  layout: any;
}

export function isPointInPolygonFun(point: any, polygonBoundaries: any): boolean {
  if (!polygonBoundaries || polygonBoundaries.length === 0) {
    return false;
  }

  const [x, y] = point;

  // 构建边界多边形的所有顶点
  const polygonPoints = [];

  // 收集左边界点（从上到下）
  for (let i = 0; i < polygonBoundaries.length; i++) {
    for (let j = 0; j < polygonBoundaries[i].length; j++) {
      polygonPoints.push(polygonBoundaries[i][j].leftTop);
    }
  }
  polygonPoints.push(polygonBoundaries[polygonBoundaries.length - 1][polygonBoundaries[polygonBoundaries.length - 1].length - 1].leftBottom);

  // 收集右边界点（从下到上）
  for (let i = polygonBoundaries.length - 1; i >= 0; i--) {
    for (let j = polygonBoundaries[i].length - 1; j >= 0; j--) {
      polygonPoints.push(polygonBoundaries[i][j].rightBottom);
      polygonPoints.push(polygonBoundaries[i][j].rightTop);
    }
  }

  // 使用射线法判断点是否在多边形内
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const [xi, yi] = polygonPoints[i];
    const [xj, yj] = polygonPoints[j];

    // 检查点是否在多边形边界上
    const pointsObj = {
      p1: { x: xi, y: yi },
      p2: { x: xj, y: yj },
      point: { x, y }
    };
    if (isPointOnVertex(pointsObj)) {
      return true;
    }

    // 射线法核心判断
    const intersect = ((yi > y) !== (yj > y)) && 
      (x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointOnVertex({ p1, p2, point }): boolean {
  return (p1.x === point.x && p1.y === point.y) || (p2.x === point.x && p2.y === point.y);
}

export function computeLocalXY(canvasRef: any, mousePosition: any, viewState: any) {
  const rect = canvasRef.getBoundingClientRect();
  const x = (mousePosition.x - rect.left - viewState.offsetX) / viewState.scale;
  const y = mousePosition.y - rect.top;
  return { x, y };
}

export function getNoZoomX(x: number, viewState: any) {
  return viewState.pixelOffsetX + (x * viewState.pixelScale)
}

export function getEventColor(event: any, deps: Dependencies, processKey: string, highlight = false, stroke = true) {
  const { colorCfg, isDarkTheme, selectedEvent, highlightedPaths } = deps;
  const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
  let fillColor = eventColor ? eventColor.base : '';
  let fontColor = colorCfg.eventFont;
  let strokeColor = '';

  if (event.renderInfo.processKey === processKey) {
    const isSelf = selectedEvent.value && selectedEvent.value.id === event.id;
    let selectedDep: any[] = [];
    if (selectedEvent.value) {
      selectedDep = [...selectedEvent.value.dependencies.predecessors, ...selectedEvent.value.dependencies.successors];
    }
    if (highlightedPaths.size > 0 && !isSelf && !highlightedPaths.has(event.id) && !selectedDep.includes(event.id)) {
      fillColor = colorCfg.eventRectNoColor;
      fontColor = colorCfg.eventFontNoColor;
    }
  }

  if (highlight) {
    fillColor = eventColor.light;
    fontColor = colorCfg.eventFontHighLight;
    if (stroke) strokeColor = colorCfg.eventHighLightStroke;
  }

  const colors = { fillColor, fontColor, strokeColor };
  return colors;
}

export function renderInfo2pixelData(renderInfo: any, viewState: any) {
  const { x, width, y, height } = renderInfo;
  return {
    x: getNoZoomX(x, viewState),
    width: width * viewState.pixelScale,
    y: y * devicePixelRatio,
    height: height * devicePixelRatio,
  };
}
