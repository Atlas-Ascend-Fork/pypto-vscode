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

const NANOSECONDS_PER_MICROSECOND = 1000;
const MICROSECONDS_PER_SECOND = 1e6;

export function formatTimelineUnit(timelineRange: number, time: number, interval: number): { value: string; unit: string } {
  const seconds = timelineRange / MICROSECONDS_PER_SECOND;
  const minutes = seconds / 60;
  const milliseconds = timelineRange / 1000;
  let divisor: number;
  let unit: string;

  if (minutes >= 1) {
    divisor = MICROSECONDS_PER_SECOND * 60;
    unit = 'min';
  } else if (seconds >= 1) {
    divisor = MICROSECONDS_PER_SECOND;
    unit = 's';
  } else if (milliseconds >= 1) {
    divisor = 1000;
    unit = 'ms';
  } else if (timelineRange >= 1) {
    divisor = 1;
    unit = 'µs';
  } else {
    divisor = 1 / NANOSECONDS_PER_MICROSECOND;
    unit = 'ns';
  }

  const intervalInUnit = Math.abs(interval / divisor);
  const precision = Math.min(3, Math.max(0, Math.ceil(-Math.log10(intervalInUnit))));
  const value = time / divisor;
  return { value: (Math.abs(value) < Number.EPSILON ? 0 : value).toFixed(precision), unit };
}

export function getTimelineLabelPosition(
  context: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>,
  labels: string[],
  tickX: number,
  canvasWidth: number,
  lastLabelRight: number,
): { x: number; right: number } | null {
  const edgePadding = 2;
  const labelGap = 8;
  const currentFont = context.font;
  context.font = '14px Arial';
  const labelWidth = Math.max(...labels.map((label) => context.measureText(label).width));
  context.font = currentFont;
  if (labelWidth > canvasWidth - edgePadding * 2) return null;

  const labelX = Math.max(edgePadding, Math.min(tickX + edgePadding, canvasWidth - labelWidth - edgePadding));
  return labelX < lastLabelRight + labelGap ? null : { x: labelX, right: labelX + labelWidth };
}

export function formatTimelineTimestamp(time: number, minimumTime: number): string {
  const currentTime = Math.round((time - minimumTime) * NANOSECONDS_PER_MICROSECOND);
  const truncatedTime = currentTime.toString().length > 10 ? parseInt(currentTime.toString().slice(-9)) : currentTime;
  return truncatedTime.toString().padStart(9, '0').replace(/\B(?=(?:\d{3})+(?!\d))/g, ' ');
}

export function isValidChartTimeRange(startTime: number, endTime: number): boolean {
  return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime < endTime;
}
