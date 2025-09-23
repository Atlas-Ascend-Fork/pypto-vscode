import { ExtensionContext } from 'vscode';

export const hismartliteEx = {
  context: null as ExtensionContext | null,
  extensionPath: '',
  webviews: {},

  async initHismartliteEx(context: ExtensionContext) {
    this.context = context;
    if (this.context) {
      this.extensionPath = context.extensionPath;
    }
  },
};