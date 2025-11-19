import { t } from 'i18next';
import { EditorViewRaw } from '../core/editorView';
import { ComputeGraphServer } from './servers/com-graph-server';
import { ThreeColumnServer } from './servers/three-column-server';
import { SwimGraphMsgHandler } from '../handler/swimGraphMsgHandler';
import { SwimGraphServer } from './servers/swim-graph-server';
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

