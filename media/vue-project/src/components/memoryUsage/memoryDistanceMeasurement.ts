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
  aboveCandidates: TensorDistanceMeasurement<T>[];
  belowCandidates: TensorDistanceMeasurement<T>[];
};

type TensorDistanceCandidate<T = any> = {
  measurement: TensorDistanceMeasurement<T>;
  bounds: TensorAddressBounds;
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

function selectNearestCandidates<T>(candidates: TensorDistanceCandidate<T>[]): TensorDistanceMeasurement<T>[] {
  if (!candidates.length) {
    return [];
  }

  const nearestDistance = candidates.reduce((nearest, candidate) => Math.min(nearest, candidate.measurement.distance), Infinity);
  const nearestRow = candidates.find((candidate) => candidate.measurement.distance === nearestDistance);
  if (!nearestRow) {
    return [];
  }

  return candidates
    .filter((candidate) => {
      return (
        candidate.measurement.distance === nearestDistance &&
        candidate.bounds.base === nearestRow.bounds.base &&
        candidate.bounds.end === nearestRow.bounds.end
      );
    })
    .map((candidate) => candidate.measurement);
}

export function findAdjacentTensorMeasurements<T = any>(anchor: T, tensors: T[]): AdjacentTensorMeasurement<T> | null {
  const anchorBounds = getTensorAddressBounds(anchor);
  if (!anchorBounds || !Array.isArray(tensors)) {
    return null;
  }

  const aboveCandidates: TensorDistanceCandidate<T>[] = [];
  const belowCandidates: TensorDistanceCandidate<T>[] = [];

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
      aboveCandidates.push({ measurement, bounds: candidateBounds });
    } else if (candidateBounds.base >= anchorBounds.end) {
      belowCandidates.push({ measurement, bounds: candidateBounds });
    }
  });

  const nearestAboveCandidates = selectNearestCandidates(aboveCandidates);
  const nearestBelowCandidates = selectNearestCandidates(belowCandidates);

  return {
    anchor,
    above: nearestAboveCandidates[0] || null,
    below: nearestBelowCandidates[0] || null,
    aboveCandidates: nearestAboveCandidates,
    belowCandidates: nearestBelowCandidates,
  };
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
