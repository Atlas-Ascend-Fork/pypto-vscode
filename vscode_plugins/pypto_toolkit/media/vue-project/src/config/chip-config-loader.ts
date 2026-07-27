/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import * as chipConfig910b from './chip-config-910b.json';
import * as chipConfigAscend91095Sample from './chip-config-ascend910-95-sample.json';
import type { ChipConfig, SelectedChipConfig } from './chip-config.types';
import { validateChipConfig } from './chip-config-validator';
import { getKnownStyleTokens } from './chip-style-resolver';

export const DEFAULT_CHIP_ARCH = 'DAV_2201';

const bundledChipConfigs: Record<string, ChipConfig> = {
  DAV_2201: chipConfig910b as ChipConfig,
  DAV_3510: chipConfigAscend91095Sample as ChipConfig,
};

const knownStyleTokens = getKnownStyleTokens();

export const defaultChipConfig = bundledChipConfigs[DEFAULT_CHIP_ARCH];

export const selectChipConfig = (chipArch?: string | null): SelectedChipConfig => {
  const requestedArch = chipArch || DEFAULT_CHIP_ARCH;
  const selectedConfig = bundledChipConfigs[requestedArch];
  const isUnknownArch = !selectedConfig;
  const config = selectedConfig || defaultChipConfig;
  let validation = validateChipConfig(config, knownStyleTokens);

  if (!validation.valid && config !== defaultChipConfig) {
    const fallbackValidation = validateChipConfig(defaultChipConfig, knownStyleTokens);
    return {
      config: defaultChipConfig,
      isFallback: true,
      warning: `Invalid chip config for ${requestedArch}; using ${defaultChipConfig.chip.displayName}.`,
      validation: fallbackValidation,
    };
  }

  if (!validation.valid && config === defaultChipConfig) {
    validation = {
      ...validation,
      warnings: [...validation.warnings, 'Default chip config is invalid. Rendering may be incomplete.'],
    };
  }

  return {
    config,
    isFallback: isUnknownArch,
    warning: isUnknownArch ? `Unsupported chip architecture ${requestedArch}; using ${defaultChipConfig.chip.displayName}.` : undefined,
    validation,
  };
};
