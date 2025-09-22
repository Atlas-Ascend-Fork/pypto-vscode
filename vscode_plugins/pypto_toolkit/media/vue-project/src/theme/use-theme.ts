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
