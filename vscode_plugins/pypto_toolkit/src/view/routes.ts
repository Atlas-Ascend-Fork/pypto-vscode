import { t } from 'i18next';
import { EditorViewRaw } from '../core/editorView';

export type EditorViewRoutes = Record<string, Omit<EditorViewRaw, 'viewType'>>;

export const routes: EditorViewRoutes = {
  // 控制流
  controlFlow: {
    title: () => t('PyPTOToolkit.workspace.controlFlowName'),
  },
};
