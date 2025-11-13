import { t } from 'i18next';
import { EditorViewRaw } from '../core/editorView';
import { ComputeGraphServer } from '../core/view/com-graph-server';
import { ThreeColumnServer } from '../core/view/three-column-server';
import { swimGraphMsgHandler } from '../handler/swimGraphMsgHandler';
import { SwimGraphServer } from '../core/view/swim-graph-server';
export type EditorViewRoutes = Record<string, Omit<EditorViewRaw, 'viewType'>>;
export const routes: EditorViewRoutes = {
  // 控制流
  controlFlow: {
    title: () => t('PyPTOToolkit.workspace.controlFlowName'),
  },
  // 计算图
  computeGraph: {
    title: 'Compute Graph',
    viewServer:ComputeGraphServer,
  },
   // 对比图
  diffGraph: {
    title: 'Diff Compute Graph',
    viewServer:ComputeGraphServer,
  },
   // 三栏视图
  threeColumnGraph: {
    title: 'Three Column Graph',
    viewServer:ThreeColumnServer,
  },
  swimGraph: {
    title: 'Swim Graph',
    viewServer:SwimGraphServer,
  },
};

