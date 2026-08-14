/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { Hct } from '@material/material-color-utilities';
import { formatRawShape } from './memoryDataProcessor';

export const regionHoverTemplate = (data: any, isDarkTheme: boolean): string => {
  const region = data.at(9) || {};
  const regionId = data.at(3);
  const span = data.at(6);
  const bgColor = isDarkTheme ? 'rgba(54, 54, 54, 1)' : 'rgba(255, 255, 255, 0.95)';
  const labelColor = isDarkTheme ? '#c7c7c7' : '#555';
  const valueColor = isDarkTheme ? '#fff' : '#191919';

  return `
   <div style="box-sizing: border-box;
    display: flex;
flex-direction: column;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
background: ${bgColor};
min-width:14rem;
border: 1px solid ${isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)'};
border-radius: 8px;
padding: 8px;
">
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Region ID:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${regionId}</span>
      </div>
      
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Span:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${span ?? '-'}</span>
      </div>
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Occupied Bytes:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${region.occupiedBytes ?? '-'}</span>
      </div>
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Fill:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${region.fill ?? '-'}</span>
      </div>
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">addr0:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${region.addr0 ?? '-'}</span>
      </div>
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Count:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${region.count ?? '-'}</span>
      </div>
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Total Bytes:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${region.totalBytes ?? '-'}</span>
      </div>
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Workspace Count:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${region.workspaceCount ?? '-'}</span>
      </div>
      <div style="
display: flex;
flex-direction: row;
justify-content: flex-start;
align-items: flex-start;
gap: 4px;
width:100%
    ">
        <span style="width:50%; color: ${labelColor};">Global Count:</span>
        <span style="width:50%;color: ${valueColor}; font-weight: 500;">${region.globalCount ?? '-'}</span>
      </div>
    </div>
  `;
};

export const tensorHoverTemplate = (data: any, params: any, isDarkTheme: boolean): string => {
  const magicId = data.at(7);
  const size = data.at(8);
  const duration = data.at(11);
  const rawData = data.at(17);
  const rawShape = Array.isArray(rawData?.rawShape) ? `[${rawData.rawShape.join(',')}]` : data.at(10);
  const logicalShape = Array.isArray(rawData?.logicalShape) ? `[${rawData.logicalShape.join(',')}]` : data.at(10);
  const rawId = rawData.rawId;
  const instanceId = rawData.instanceId;
  const base = rawData.base;
  const end = rawData.end;
  const memType = rawData.memType;
  const ndim = rawData.ndim;
  const labelColor = isDarkTheme ? '#c7c7c7' : '#555';
  const valueColor = isDarkTheme ? '#fff' : '#191919';

  if (params.seriesIndex === 1) {
    const overlap = params.data;
    if (!overlap) {
      return '';
    }
    return `
            <div style="font-family: Inter, sans-serif; padding: 6px; line-height: 1.5;">
              <strong style="color: #ff4d4f; font-size: 13px;">⚠️ Memory Overlap (Conflict)</strong><br/>

              </div>
          `;
  }
  let html = `<div style="font-family: Inter, sans-serif; padding: 4px;">`;
  if (magicId) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">magicID:</span> <span style="color: ${valueColor}; font-weight: 500;">${magicId}</span></div>`;
  }
  html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">Duration:</span> <span style="color: ${valueColor}; font-weight: 500;">${formatDuration(
    duration,
  )} </span></div>`;
  if (size) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">Size:</span> <span style="color: ${valueColor}; font-weight: 500;">${formatSize(
      size,
    )}</span></div>`;
  }
  if (rawShape) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">rawShape:</span> <span style="color: ${valueColor}; font-weight: 500;">${rawShape}</span></div>`;
  }
  if (logicalShape) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">logicalShape:</span> <span style="color: ${valueColor}; font-weight: 500;">${logicalShape}</span></div>`;
  }
  if (rawId) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">rawId:</span> <span style="color: ${valueColor}; font-weight: 500;">${rawId}</span></div>`;
  }
  if (instanceId) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">instanceId:</span> <span style="color: ${valueColor}; font-weight: 500;">${instanceId}</span></div>`;
  }
  if (base) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">base:</span> <span style="color: ${valueColor}; font-weight: 500;">${base}</span></div>`;
  }
  if (end) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">end:</span> <span style="color: ${valueColor}; font-weight: 500;">${end}</span></div>`;
  }
  if (memType) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">memType:</span> <span style="color: ${valueColor}; font-weight: 500;">${memType}</span></div>`;
  }
  if (ndim) {
    html += `<div style="margin: 3px 0;"><span style="color: ${labelColor};">ndim:</span> <span style="color: ${valueColor}; font-weight: 500;">${ndim}</span></div>`;
  }
  html += `</div>`;
  return html;
};

function hctToHex(hue, chroma, tone) {
  const hctColor = Hct.from(hue, chroma, tone);
  const argb = hctColor.toInt();
  const red = (argb >> 16) & 0xff;
  const green = (argb >> 8) & 0xff;
  const blue = argb & 0xff;

  return `#${red.toString(16).padStart(2, '0')}` + `${green.toString(16).padStart(2, '0')}` + `${blue.toString(16).padStart(2, '0')}`;
}
function isRedHue(hue: number) {
  return hue <= 35 || hue >= 330;
}

function getSafeHue(hue: number) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  if (!isRedHue(normalizedHue)) {
    return normalizedHue;
  }

  return normalizedHue <= 35 ? normalizedHue + 40 : normalizedHue - 290;
}
export function generateColorListExcludingReds(count: number, isDark = true) {
  const baseColor = isDark ? [268, 47, 43] : [268, 67, 85];
  const baseLightColor = isDark ? [268, 47, 80] : [268, 67, 43];

  const originBaseColorList: string[] = [];
  const originLightColorList: string[] = [];

  const interval = 137.508;

  for (let index = 0; index < count; index++) {
    const rawHue = (baseColor[0] + interval * index) % 360;
    const safeHue = getSafeHue(rawHue);

    originBaseColorList.push(hctToHex(safeHue, baseColor[1], baseColor[2]));

    originLightColorList.push(hctToHex(safeHue, baseLightColor[1], baseLightColor[2]));
  }

  return {
    baseColorList: originBaseColorList,
    lightColorList: originLightColorList,
  };
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function parseSizeToBytes(sizeStr, datatype) {
  if (sizeStr === undefined || sizeStr === null || sizeStr === '') {
    return 0;
  }
  if (typeof sizeStr === 'number') {
    return sizeStr;
  }
  const s = String(sizeStr).trim();
  const val = parseFloat(s);
  if (!isNaN(val)) {
    const unit = s.replace(/^[\d.\s]+/, '').toUpperCase() || 'B';
    if (unit === 'MB') {
      return val * 1024 * 1024;
    }
    if (unit === 'KB') {
      return val * 1024;
    }
    return val;
  }
  const elementSize = datatype === 8 ? 2 : 4;
  if (Array.isArray(sizeStr)) {
    return sizeStr.reduce((a, b) => a * (b > 0 ? b : 1), 1) * elementSize;
  }
  return 0;
}

export function buildSizeInfo(rt, rawshape, datatype) {
  let sizeStr = rt.size || '';
  let sizeBytes = 0;

  if (!sizeStr) {
    let shapeProduct = 1;
    if (Array.isArray(rawshape)) {
      shapeProduct = rawshape.reduce((a, b) => {
        const value = b > 0 ? b : 1;
        return a * value;
      }, 1);
    }

    const elementSize = datatype === 8 ? 2 : 4;
    sizeBytes = shapeProduct * elementSize;

    sizeStr = sizeBytes > 1024 * 1024 ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`;

    return { sizeStr, sizeBytes };
  }

  sizeBytes = parseSizeToBytes(sizeStr, datatype);

  return { sizeStr, sizeBytes };
}

function formatDuration(duration) {
  if (duration === undefined || duration === null) {
    return '';
  }

  let valueUs;

  if (typeof duration === 'string') {
    const num = parseFloat(duration.replace(/[^0-9+\-.eE]/g, ''));

    if (Number.isNaN(num)) {
      return `${duration} ns`;
    }

    valueUs = num;
  } else if (typeof duration === 'number') {
    valueUs = duration;
  } else {
    return `${String(duration)} ns`;
  }

  const valueNs = valueUs * 1000;
  const valueSec = valueUs / 1e6;
  const valueMin = valueSec / 60;

  if (valueMin >= 1) {
    return `${valueMin.toLocaleString(undefined, { maximumFractionDigits: 2 })} min`;
  }

  if (valueSec >= 1) {
    return `${valueSec.toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;
  }

  if (valueUs >= 1) {
    return `${valueUs.toLocaleString(undefined, { maximumFractionDigits: 2 })} µs`;
  }

  return `${valueNs.toLocaleString(undefined, { maximumFractionDigits: 2 })} ns`;
}

function formatSize(bytes) {
  if (bytes === undefined || bytes === null) {
    return '';
  }

  let value;

  if (typeof bytes === 'string') {
    const num = parseFloat(bytes.replace(/[^0-9+\-.eE]/g, ''));

    if (Number.isNaN(num)) {
      return `${bytes} B`;
    }

    value = num;
  } else if (typeof bytes === 'number') {
    value = bytes;
  } else {
    return `${String(bytes)} B`;
  }

  const absValue = Math.abs(value);

  if (absValue >= 1024 ** 4) {
    return `${(value / 1024 ** 4).toLocaleString(undefined, { maximumFractionDigits: 2 })} TB`;
  }

  if (absValue >= 1024 ** 3) {
    return `${(value / 1024 ** 3).toLocaleString(undefined, { maximumFractionDigits: 2 })} GB`;
  }

  if (absValue >= 1024 ** 2) {
    return `${(value / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 2 })} MB`;
  }

  if (absValue >= 1024) {
    return `${(value / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })} KB`;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} B`;
}

export function getDataZoomConfig(isDarkTheme) {
  return [
    {
      id: 'y-slider',
      type: 'slider',
      show: true,
      yAxisIndex: [0],
      filterMode: 'weakFilter',
      left: 15,
      width: 80,
      top: 20,
      bottom: 25,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      fillerColor: isDarkTheme ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      handleSize: '60%',
      showDetail: false,
      handleStyle: {
        color: isDarkTheme ? '#ffffff' : '#191919',
        borderColor: isDarkTheme ? '#ffffff' : '#191919',
        borderWidth: 1,
        shadowBlur: 5,
        shadowColor: isDarkTheme ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)',
      },
      moveHandleIcon: 'none',
    },
    {
      id: 'x-inside',
      type: 'inside',
      xAxisIndex: [0],
      filterMode: 'weakFilter',
      zoomOnMouseWheel: false,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
      preventDefaultMouseMove: false,
    },
    {
      id: 'y-inside',
      type: 'inside',
      yAxisIndex: [0],
      filterMode: 'none',
      zoomOnMouseWheel: false,
      moveOnMouseMove: true,
      moveOnMouseWheel: true,
    },
  ];
}

export function getxAxisConfig(timelineState) {
  return {
    type: 'value',
    min: timelineState.startTime,
    max: timelineState.endTime,
    position: 'top',
    splitLine: {
      show: false,
      lineStyle: {
        color: '#222222',
      },
    },
    axisLabel: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    axisLine: {
      show: false,
      splitLine: {
        show: false,
      },
    },
  };
}

export function getyAxisConfig(yMin, yMax, isDarkTheme, axisLabelFormatter = null, axisLabelFontSize = 11) {
  return {
    type: 'value',
    min: yMin,
    max: yMax,
    inverse: true,
    minInterval: 1,
    axisLabel: {
      show: typeof axisLabelFormatter === 'function',
      color: '#999999',
      fontSize: axisLabelFontSize,
      margin: 10,
      ...(typeof axisLabelFormatter === 'function' ? { formatter: axisLabelFormatter } : {}),
    },
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    splitArea: {
      show: false,
      areaStyle: {
        color: isDarkTheme ? ['rgba(255, 255, 255, 0.015)', 'transparent'] : ['rgba(0, 0, 0, 0.015)', 'transparent'],
      },
    },
    splitLine: {
      show: false,
      lineStyle: {
        color: isDarkTheme ? '#222' : '#eee',
      },
    },
  };
}

export function getVisibleXAxisRange(myChart, timelineState) {
  if (!myChart || typeof myChart.getModel !== 'function') {
    return {
      min: timelineState.startTime,
      max: timelineState.endTime,
    };
  }

  const model = myChart.getModel();

  if (!model || typeof model.getComponent !== 'function') {
    return {
      min: timelineState.startTime,
      max: timelineState.endTime,
    };
  }

  const xAxisModel = model.getComponent('xAxis', 0);
  const extent = xAxisModel?.axis?.scale?.getExtent?.();

  if (!extent) {
    return {
      min: timelineState.startTime,
      max: timelineState.endTime,
    };
  }

  const a = Number(extent[0]);
  const b = Number(extent[1]);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return {
      min: timelineState.startTime,
      max: timelineState.endTime,
    };
  }

  return {
    min: Math.min(a, b),
    max: Math.max(a, b),
  };
}

export function getVisibleYAxisRange(myChart, maxY) {
  if (!myChart || typeof myChart.getModel !== 'function') {
    return {
      min: 0,
      max: maxY,
    };
  }

  const model = myChart.getModel();

  if (!model || typeof model.getComponent !== 'function') {
    return {
      min: 0,
      max: maxY,
    };
  }

  const yAxisModel = model.getComponent('yAxis', 0);
  const extent = yAxisModel?.axis?.scale?.getExtent?.();

  if (!extent) {
    return {
      min: 0,
      max: maxY,
    };
  }

  const a = Number(extent[0]);
  const b = Number(extent[1]);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return {
      min: 0,
      max: maxY,
    };
  }

  return {
    min: Math.min(a, b),
    max: Math.max(a, b),
  };
}

export function getRegionLayerVisibleYRange(coordSys, myChart, currentLayoutRegions) {
  const getNumberValue = (value) => {
    if (Array.isArray(value)) {
      return Number(value[1] ?? value[0]);
    }

    return Number(value);
  };

  const topValue = myChart.convertFromPixel({ yAxisIndex: 0 }, coordSys.y);

  const bottomValue = myChart.convertFromPixel({ yAxisIndex: 0 }, coordSys.y + coordSys.height);

  const topY = getNumberValue(topValue);
  const bottomY = getNumberValue(bottomValue);

  if (Number.isFinite(topY) && Number.isFinite(bottomY) && topY !== bottomY) {
    return {
      min: Math.min(topY, bottomY),
      max: Math.max(topY, bottomY),
    };
  }

  let fallbackMin = Infinity;
  let fallbackMax = -Infinity;

  currentLayoutRegions.forEach((region) => {
    const yStart = Number(region.yStart);
    const yEnd = Number(region.yEnd);

    if (!Number.isFinite(yStart) || !Number.isFinite(yEnd)) {
      return;
    }

    fallbackMin = Math.min(fallbackMin, yStart, yEnd);
    fallbackMax = Math.max(fallbackMax, yStart, yEnd);
  });

  if (!Number.isFinite(fallbackMin) || !Number.isFinite(fallbackMax)) {
    return {
      min: 0,
      max: 1,
    };
  }

  return {
    min: fallbackMin,
    max: fallbackMax,
  };
}

export function ensureMinimumVisibleRatio(range, fullRange, minimumRatio = 0.2) {
  const fullSize = fullRange.max - fullRange.min;
  const currentSize = range.max - range.min;

  if (!Number.isFinite(fullSize) || !Number.isFinite(currentSize) || fullSize <= 0 || currentSize >= fullSize * minimumRatio) {
    return range;
  }

  const minimumSize = fullSize * minimumRatio;
  const center = (range.min + range.max) / 2;

  let min = center - minimumSize / 2;
  let max = center + minimumSize / 2;

  if (min < fullRange.min) {
    min = fullRange.min;
    max = fullRange.min + minimumSize;
  }

  if (max > fullRange.max) {
    max = fullRange.max;
    min = fullRange.max - minimumSize;
  }

  return {
    min,
    max,
  };
}
