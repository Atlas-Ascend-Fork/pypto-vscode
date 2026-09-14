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
import { ref, onMounted, provide } from 'vue';
import { ThemeServiceInit } from 'devui-theme';
import { ideLightTheme, ideDarkTheme } from './theme-data';

export function useTheme() {
  const themeService = ThemeServiceInit({ ideLightTheme, ideDarkTheme });
  const isDarkTheme = ref(true);

  const updateTheme = (theme: string) => {
    isDarkTheme.value = theme === 'dark';
    (window as any).isAscDark = isDarkTheme.value;
    if (isDarkTheme.value) {
      themeService?.applyTheme(ideDarkTheme);
    } else {
      themeService?.applyTheme(ideLightTheme);
    }
  };

  provide('root', { isDarkTheme });

  onMounted(() => {
    updateTheme((window as any).ascTheme);
  });

  return { isDarkTheme, updateTheme };
}
