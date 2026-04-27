import { ExtensionContext } from 'vscode';
import { IS_DEBUG } from './env';

export const hismartliteEx = {
  context: null as ExtensionContext | null,
  extensionPath: '',
  webviews: {},
  isDebug: IS_DEBUG,
  startTime: 0,
  transformStartTime: 0,
  swimPerformanceBase: {
    first: {
      vsOpen: {
        130: 10,
        380: 20,
        677: 50,
        1000: 68,
        1300: 88,
        1600: 120,
      },
      vsHW: {
        130: 13,
        380: 28,
        677: 110,
        1000: 130,
        1300: 175,
        1600: 327,
      }
    },
    useCache: {
      vsOpen: {
        130: 10,
        380: 12,
        677: 50,
      }, // 大于500M就不走cache了, 677的数据只是一个边界
      vsHW: {
        130: 12,
        380: 27,
        677: 101,
      }
    },
  },

  async initHismartliteEx(context: ExtensionContext) {
    this.context = context;
    if (this.context) {
      this.extensionPath = context.extensionPath;
    }
  },
};