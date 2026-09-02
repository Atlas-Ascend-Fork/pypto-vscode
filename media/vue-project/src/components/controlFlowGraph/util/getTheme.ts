/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { ideDarkTheme, ideLightTheme } from '@/theme/theme-data';

/**
 * 获取当前主题下的颜色
 * @param colorName 颜色字段名
 * @param isDarkTheme 当前主题
 * @returns
 */
export function getThemeColorTool(colorName: string, isDarkTheme: boolean) {
  return isDarkTheme ? ideDarkTheme.data[colorName] : ideLightTheme.data[colorName];
}