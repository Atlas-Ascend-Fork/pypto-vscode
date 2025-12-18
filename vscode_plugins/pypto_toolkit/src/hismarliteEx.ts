import { ExtensionContext } from 'vscode';

export const hismartliteEx = {
  context: null as ExtensionContext | null,
  extensionPath: '',
  webviews: {},
  swimPerformanceBase: {
    first: {
      130: 10,
      380: 20,
      677: 50,
      1000: 68,
      1300: 88,
      1600: 120,
    },
    useCache: {
      130: 10,
      380: 12,
      677: 50,
    }, // 大于500M就不走cache了, 677的数据只是一个边界
  },

  async initHismartliteEx(context: ExtensionContext) {
    this.context = context;
    if (this.context) {
      this.extensionPath = context.extensionPath;
    }
  },
};