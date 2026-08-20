/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

export type TensorAddressBounds = {
  base: number;
  end: number;
};

export type TensorDistanceMeasurement<T = any> = {
  lower: T;
  upper: T;
  lowerBoundary: number;
  upperBoundary: number;
  distance: number;
};

export type AdjacentTensorMeasurement<T = any> = {
  anchor: T;
  above: TensorDistanceMeasurement<T> | null;
  below: TensorDistanceMeasurement<T> | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function getTensorAddressBounds(tensor: any): TensorAddressBounds | null {
  const base = toFiniteNumber(tensor?.absoluteBase ?? tensor?.rawObj?.base ?? tensor?.base);
  const end = toFiniteNumber(tensor?.absoluteEnd ?? tensor?.rawObj?.end ?? tensor?.end);

  if (base === null || end === null || base >= end) {
    return null;
  }

  return { base, end };
}

export function calculateTensorDistance<T = any>(first: T, second: T): TensorDistanceMeasurement<T> | null {
  if (!first || !second || first === second) {
    return null;
  }

  const firstBounds = getTensorAddressBounds(first);
  const secondBounds = getTensorAddressBounds(second);

  if (!firstBounds || !secondBounds) {
    return null;
  }

  if (!isSameRegion(first, second)) {
    return null;
  }

  const firstIsLower = firstBounds.base <= secondBounds.base;
  const lower = firstIsLower ? first : second;
  const upper = firstIsLower ? second : first;
  const lowerBounds = firstIsLower ? firstBounds : secondBounds;
  const upperBounds = firstIsLower ? secondBounds : firstBounds;

  return {
    lower,
    upper,
    lowerBoundary: lowerBounds.end,
    upperBoundary: upperBounds.base,
    distance: upperBounds.base - lowerBounds.end,
  };
}

function getRegionId(tensor: any): unknown {
  return tensor?.regionId ?? tensor?.rawObj?.regionId;
}

function isSameRegion(first: any, second: any): boolean {
  const firstRegionId = getRegionId(first);
  const secondRegionId = getRegionId(second);

  if (firstRegionId === undefined || firstRegionId === null || secondRegionId === undefined || secondRegionId === null) {
    return firstRegionId === secondRegionId;
  }

  return String(firstRegionId) === String(secondRegionId);
}

function compareCandidate<T>(
  current: TensorDistanceMeasurement<T> | null,
  candidate: TensorDistanceMeasurement<T>,
): TensorDistanceMeasurement<T> {
  if (!current || candidate.distance < current.distance) {
    return candidate;
  }
  if (candidate.distance > current.distance) {
    return current;
  }

  return candidate.lowerBoundary < current.lowerBoundary ? candidate : current;
}

export function findAdjacentTensorMeasurements<T = any>(anchor: T, tensors: T[]): AdjacentTensorMeasurement<T> | null {
  const anchorBounds = getTensorAddressBounds(anchor);
  if (!anchorBounds || !Array.isArray(tensors)) {
    return null;
  }

  let above: TensorDistanceMeasurement<T> | null = null;
  let below: TensorDistanceMeasurement<T> | null = null;

  tensors.forEach((candidate) => {
    if (!candidate || candidate === anchor || !isSameRegion(candidate, anchor)) {
      return;
    }

    const candidateBounds = getTensorAddressBounds(candidate);
    const measurement = calculateTensorDistance(anchor, candidate);
    if (!candidateBounds || !measurement) {
      return;
    }

    if (candidateBounds.end <= anchorBounds.base) {
      above = compareCandidate(above, measurement);
    } else if (candidateBounds.base >= anchorBounds.end) {
      below = compareCandidate(below, measurement);
    }
  });

  return { anchor, above, below };
}

export function getMeasurementTensorIdentity(tensor: any): string {
  return [tensor?.instanceId, tensor?.rawId, tensor?.base, tensor?.end, tensor?.lifeStart, tensor?.lifeEnd]
    .map((value) => (value === undefined || value === null ? '' : String(value)))
    .join('|');
}

export function serializeTensorMeasurement(measurement: TensorDistanceMeasurement<any>, label: string): unknown[] {
  const { lower, upper } = measurement;
  return [
    Number(lower.start),
    Number(lower.end),
    Number(lower.startAddr),
    Number(lower.endAddr),
    Number(upper.start),
    Number(upper.end),
    Number(upper.startAddr),
    Number(upper.endAddr),
    measurement.distance,
    label,
  ];
}
