import { window, ColorThemeKind } from 'vscode';

const ThemeMap = {
  [ColorThemeKind.Dark]: 'dark',
  [ColorThemeKind.Light]: 'light',
  [ColorThemeKind.HighContrast]: 'dark',
  [ColorThemeKind.HighContrastLight]: 'light',
};

export function getIDETheme() {
  return ThemeMap[window.activeColorTheme.kind] || ThemeMap[ColorThemeKind.Dark];
}
