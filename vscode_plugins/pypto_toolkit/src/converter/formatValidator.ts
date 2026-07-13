/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
export class FormatValidator {
  static validatePerfSwimlane(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data: not an object' };
    }

    if (!Array.isArray(data.tasks)) {
      return { valid: false, error: 'Invalid tasks field: must be an array' };
    }

    return { valid: true };
  }

  static validateMergedSwimlane(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data: not an object' };
    }

    if (!('traceEvents' in data)) {
      return { valid: false, error: 'Missing required field: traceEvents' };
    }

    if (!Array.isArray(data.traceEvents)) {
      return { valid: false, error: 'Invalid traceEvents field: must be an array' };
    }

    return { valid: true };
  }
}