/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { getRegionLayerVisibleYRange, getVisibleXAxisRange, getVisibleYAxisRange } from './utils';

const REGION_BACKGROUND_GAP_PX = 10;

type RegionRendererOptions = {
  getChart: () => any;
  getCurrentRegions: () => any[];
  getIsDarkTheme: () => boolean;
  getMaxY: () => number;
  getSelectedRegionId: () => number | null;
  getTimelineState: () => any;
  setHoverAreas: (areas: any[]) => void;
};

const emptyGroup = (silent: boolean) => ({ type: 'group', silent, children: []});

const renderRegionAxisLabelLayerItem = (options: RegionRendererOptions, params: any) => {
  const chart = options.getChart();
  const regions = options.getCurrentRegions();
  if (options.getSelectedRegionId() !== null || !regions.length) {
    options.setHoverAreas([]);
    return emptyGroup(false);
  }

  const { min: visibleXMin, max: visibleXMax } = getVisibleXAxisRange(chart, options.getTimelineState());
  const { min: visibleYMin, max: visibleYMax } = getVisibleYAxisRange(chart, options.getMaxY());
  const xCenter = (visibleXMin + visibleXMax) / 2;
  const children: any[] = [];
  const hoverAreas: any[] = [];

  regions.forEach((region) => {
    if (region.yEnd < visibleYMin || region.yStart > visibleYMax) return;
    const visibleRegionTop = Math.max(region.yStart, visibleYMin);
    const visibleRegionBottom = Math.min(region.yEnd, visibleYMax);
    const fixedLabelY = Math.min(Math.max((region.yStart + region.yEnd) / 2, visibleRegionTop), visibleRegionBottom);
    const yPixel = chart.convertToPixel({ yAxisIndex: 0 }, fixedLabelY);
    const startPixel = chart.convertToPixel({ yAxisIndex: 0 }, visibleRegionTop);
    const endPixel = chart.convertToPixel({ yAxisIndex: 0 }, visibleRegionBottom);
    if (![yPixel, startPixel, endPixel].every(Number.isFinite)) return;

    const regionData = [
      xCenter,
      fixedLabelY,
      `Region\nID:${region.regionId}`,
      region.regionId,
      region.yStart,
      region.yEnd,
      region.span,
      region.addr0,
      region.addrEnd,
      region.rawRegion,
    ];
    const labelX = params.coordSys.x - 50;
    const labelWidth = 44;
    const labelHeight = 30;
    const pixelTop = Math.min(startPixel, endPixel);
    const pixelBottom = Math.max(startPixel, endPixel);
    const fitsCanvas = labelX >= 0 && labelX + labelWidth <= chart.getWidth();
    const fitsRegion = yPixel - labelHeight / 2 >= pixelTop && yPixel + labelHeight / 2 <= pixelBottom;
    if (!fitsCanvas || !fitsRegion) return;

    hoverAreas.push({ x: labelX, y: yPixel - labelHeight / 2, width: labelWidth, height: labelHeight, regionData });
    children.push({
      type: 'rect',
      name: 'region-axis-hit-area',
      silent: false,
      z: 199,
      shape: { x: labelX, y: yPixel - labelHeight / 2, width: labelWidth, height: labelHeight },
      style: { fill: 'rgba(0, 0, 0, 0)' },
    });
    children.push({
      type: 'text',
      name: 'region-axis-label',
      silent: false,
      z: 200,
      style: {
        x: labelX,
        y: yPixel,
        text: `Region\nID:${region.regionId}`,
        fill: options.getIsDarkTheme() ? 'rgba(230, 230, 230, 1)' : 'rgba(25, 25, 25, 1)',
        fontSize: 11,
        lineHeight: 15,
        textAlign: 'left',
        textVerticalAlign: 'middle',
      },
    });
  });

  options.setHoverAreas(hoverAreas);
  return { type: 'group', silent: false, children };
};

const getRegionLabelLayerData = (options: RegionRendererOptions) => {
  if (options.getSelectedRegionId() !== null) {
    options.setHoverAreas([]);
    return [];
  }
  const chart = options.getChart();
  const { min: xMin, max: xMax } = getVisibleXAxisRange(chart, options.getTimelineState());
  const { min: yMin, max: yMax } = getVisibleYAxisRange(chart, options.getMaxY());
  return [['region-label-layer', (xMin + xMax) / 2, (yMin + yMax) / 2, 'sa']];
};

const renderRegionLayerItem = (options: RegionRendererOptions, params: any) => {
  const chart = options.getChart();
  const regions = options.getCurrentRegions();
  const { coordSys } = params;
  if (!regions.length || !coordSys || ![coordSys.x, coordSys.y, coordSys.width, coordSys.height].every(Number.isFinite)) {
    return emptyGroup(true);
  }

  const children: any[] = [];
  const gridBottom = coordSys.y + coordSys.height;
  const gridColor = options.getIsDarkTheme() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const regionFill = options.getIsDarkTheme() ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.018)';
  const regionStroke = options.getIsDarkTheme() ? '#333' : '#ddd';
  const { min: visibleYMin, max: visibleYMax } = getRegionLayerVisibleYRange(coordSys, chart, regions);
  const visibleRegions = regions.map((region) => {
    const rawStart = Number(region.yStart);
    const rawEnd = Number(region.yEnd);
    if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;
    const visibleStart = Math.max(Math.min(rawStart, rawEnd), visibleYMin);
    const visibleEnd = Math.min(Math.max(rawStart, rawEnd), visibleYMax);
    return visibleEnd > visibleStart ? { visibleSpan: visibleEnd - visibleStart } : null;
  }).filter(Boolean);

  const addRegionRect = (y: number, height: number, withGrid: boolean) => {
    const shape = { x: coordSys.x, y, width: coordSys.width, height };
    children.push({ type: 'rect', silent: true, shape, style: { fill: regionFill, stroke: regionStroke, lineWidth: 1 }});
    if (!withGrid) return;
    for (let x = shape.x + 100; x < shape.x + shape.width; x += 100) {
      children.push({
        type: 'line',
        silent: true,
        shape: { x1: x, y1: shape.y, x2: x, y2: shape.y + shape.height },
        style: { stroke: gridColor, lineWidth: 1 },
      });
    }
  };

  if (!visibleRegions.length) {
    regions.forEach((region) => {
      const startPixel = chart.convertToPixel({ yAxisIndex: 0 }, region.yStart);
      const endPixel = chart.convertToPixel({ yAxisIndex: 0 }, region.yEnd);
      if (!Number.isFinite(startPixel) || !Number.isFinite(endPixel)) return;
      const top = Math.max(Math.min(startPixel, endPixel), coordSys.y);
      const bottom = Math.min(Math.max(startPixel, endPixel), gridBottom);
      if (bottom > top) addRegionRect(top, bottom - top, false);
    });
    return { type: 'group', silent: true, children };
  }

  const availableHeight = Math.max(0, coordSys.height - Math.max(0, visibleRegions.length - 1) * REGION_BACKGROUND_GAP_PX);
  const totalSpan = visibleRegions.reduce((sum, item) => sum + item.visibleSpan, 0);
  if (availableHeight <= 0 || totalSpan <= 0) return emptyGroup(true);
  let currentY = coordSys.y;
  visibleRegions.forEach((item) => {
    const height = (item.visibleSpan / totalSpan) * availableHeight;
    if (height > 0) addRegionRect(currentY, height, true);
    currentY += height + REGION_BACKGROUND_GAP_PX;
  });
  return { type: 'group', silent: true, children };
};

export function createMemoryRegionRenderers(options: RegionRendererOptions) {
  return {
    getRegionLabelLayerData: () => getRegionLabelLayerData(options),
    renderRegionAxisLabelLayerItem: (params: any) => renderRegionAxisLabelLayerItem(options, params),
    renderRegionLayerItem: (params: any) => renderRegionLayerItem(options, params),
  };
}
