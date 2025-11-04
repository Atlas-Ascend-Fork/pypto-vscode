import { ideDarkTheme, ideLightTheme } from "@/theme/theme-data";

export function getThemeColorTool(colorName: string, isDarkTheme:boolean) {
    return isDarkTheme ? ideDarkTheme.data[colorName] : ideLightTheme.data[colorName];
}