/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock(import('../../../src/hismarliteEx'), () => ({
  hismartliteEx: { extensionPath: '/ext/pypto-toolkit' },
}));

vi.mock(import('../../../src/view/servers/controlFlow-server'), () => ({ ControlFlowViewServer: class {} }));
vi.mock(import('../../../src/view/servers/com-graph-server'), () => ({ ComputeGraphServer: class {} }));
vi.mock(import('../../../src/view/servers/three-column-server'), () => ({ ThreeColumnServer: class {} }));
vi.mock(import('../../../src/view/servers/swim-graph-server'), () => ({ SwimGraphServer: class {} }));
vi.mock(import('../../../src/view/servers/gm-memory-visual-server'), () => ({ GmMemoryVisualServer: class {} }));
vi.mock(import('../../../src/view/servers/run-config-view-server'), () => ({ RunConfigViewServer: class {} }));
vi.mock(import('../../../src/view/servers/welcom-server'), () => ({ WelcomeViewServer: class {} }));
vi.mock(import('../../../src/view/servers/memory-trace-server'), () => ({ MemoryTraceServer: class {} }));
vi.mock(import('../../../src/view/servers/opcheck-server'), () => ({ OpCheckViewServer: class {} }));
vi.mock(import('../../../src/view/servers/taskcheck-server'), () => ({ TaskCheckViewServer: class {} }));

import { routes } from '../../../src/view/routes';

describe('routes', () => {
  it('contains all 11 view types', () => {
    const expectedKeys = [
      'controlFlow', 'computeGraph', 'diffGraph', 'threeColumnGraph',
      'swimGraph', 'gmMemoryVisual', 'editRunConfig', 'welcome',
      'memoryTrace', 'opCheck', 'taskCheck',
    ];
    for (const key of expectedKeys) {
      expect(routes).toHaveProperty(key);
    }
    expect(Object.keys(routes)).toHaveLength(11);
  });

  it('each entry has title and viewServer', () => {
    for (const [key, entry] of Object.entries(routes)) {
      expect(entry).toHaveProperty('title');
      expect(entry).toHaveProperty('viewServer');
      expect(entry.viewServer).toBeDefined();
    }
  });

  it('computeGraph has string title', () => {
    expect(routes.computeGraph.title).toBe('Compute Graph');
  });

  it('diffGraph has string title', () => {
    expect(routes.diffGraph.title).toBe('Diff Compute Graph');
  });

  it('threeColumnGraph has string title', () => {
    expect(routes.threeColumnGraph.title).toBe('Three Column Graph');
  });

  it('swimGraph has string title', () => {
    expect(routes.swimGraph.title).toBe('Swim Graph');
  });

  it('gmMemoryVisual has string title', () => {
    expect(routes.gmMemoryVisual.title).toBe('GmMemoryVisual');
  });

  it('memoryTrace has string title', () => {
    expect(routes.memoryTrace.title).toBe('Memory Trace');
  });

  it('opCheck has string title', () => {
    expect(routes.opCheck.title).toBe('OpCheck');
  });

  it('taskCheck has string title', () => {
    expect(routes.taskCheck.title).toBe('TaskCheck');
  });

  it('controlFlow has function title', () => {
    expect(typeof routes.controlFlow.title).toBe('function');
    expect((routes.controlFlow.title as Function)()).toBe('PyPTOToolkit.workspace.controlFlowName');
  });

  it('editRunConfig has function title', () => {
    expect(typeof routes.editRunConfig.title).toBe('function');
    expect((routes.editRunConfig.title as Function)()).toBe('PyPTOToolkit.workspace.ptoNewConfig');
  });

  it('welcome has function title', () => {
    expect(typeof routes.welcome.title).toBe('function');
    expect((routes.welcome.title as Function)()).toBe('PyPTOToolkit.welcome.page');
  });

  it('editRunConfig has iconPath function', () => {
    expect(typeof routes.editRunConfig.iconPath).toBe('function');
    const iconPath = (routes.editRunConfig.iconPath as Function)();
    expect(iconPath.fsPath).toContain('xml.svg');
  });

  it('diffGraph uses same viewServer as computeGraph', () => {
    expect(routes.diffGraph.viewServer).toBe(routes.computeGraph.viewServer);
  });
});
