/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect } from 'vitest';

import { FormatValidator } from '../../../src/converter/formatValidator';

describe('FormatValidator.validatePerfSwimlane', () => {
  it('returns valid for correct data with tasks array', () => {
    expect(FormatValidator.validatePerfSwimlane({ tasks: [] })).toEqual({ valid: true });
  });

  it('returns invalid when data is null', () => {
    expect(FormatValidator.validatePerfSwimlane(null)).toEqual({ valid: false, error: 'Invalid data: not an object' });
  });

  it('returns invalid when data is undefined', () => {
    expect(FormatValidator.validatePerfSwimlane(undefined)).toEqual({ valid: false, error: 'Invalid data: not an object' });
  });

  it('returns invalid when data is a primitive', () => {
    expect(FormatValidator.validatePerfSwimlane(42)).toEqual({ valid: false, error: 'Invalid data: not an object' });
  });

  it('returns invalid when data is a string', () => {
    expect(FormatValidator.validatePerfSwimlane('hello')).toEqual({ valid: false, error: 'Invalid data: not an object' });
  });

  it('returns invalid when tasks is missing', () => {
    expect(FormatValidator.validatePerfSwimlane({})).toEqual({ valid: false, error: 'Invalid tasks field: must be an array' });
  });

  it('returns invalid when tasks is not an array', () => {
    expect(FormatValidator.validatePerfSwimlane({ tasks: 'not array' })).toEqual({ valid: false, error: 'Invalid tasks field: must be an array' });
  });

  it('returns invalid when tasks is an object', () => {
    expect(FormatValidator.validatePerfSwimlane({ tasks: {} })).toEqual({ valid: false, error: 'Invalid tasks field: must be an array' });
  });
});

describe('FormatValidator.validateMergedSwimlane', () => {
  it('returns valid for correct data with traceEvents array', () => {
    expect(FormatValidator.validateMergedSwimlane({ traceEvents: [] })).toEqual({ valid: true });
  });

  it('returns invalid when data is null', () => {
    expect(FormatValidator.validateMergedSwimlane(null)).toEqual({ valid: false, error: 'Invalid data: not an object' });
  });

  it('returns invalid when data is undefined', () => {
    expect(FormatValidator.validateMergedSwimlane(undefined)).toEqual({ valid: false, error: 'Invalid data: not an object' });
  });

  it('returns invalid when data is a number', () => {
    expect(FormatValidator.validateMergedSwimlane(0)).toEqual({ valid: false, error: 'Invalid data: not an object' });
  });

  it('returns invalid when traceEvents is missing', () => {
    expect(FormatValidator.validateMergedSwimlane({})).toEqual({ valid: false, error: 'Missing required field: traceEvents' });
  });

  it('returns invalid when traceEvents is not an array', () => {
    expect(FormatValidator.validateMergedSwimlane({ traceEvents: 'string' })).toEqual({ valid: false, error: 'Invalid traceEvents field: must be an array' });
  });

  it('returns invalid when traceEvents is an object', () => {
    expect(FormatValidator.validateMergedSwimlane({ traceEvents: {} })).toEqual({ valid: false, error: 'Invalid traceEvents field: must be an array' });
  });

  it('returns invalid when traceEvents is null', () => {
    expect(FormatValidator.validateMergedSwimlane({ traceEvents: null })).toEqual({ valid: false, error: 'Invalid traceEvents field: must be an array' });
  });
});
