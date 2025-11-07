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