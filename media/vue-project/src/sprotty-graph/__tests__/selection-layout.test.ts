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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ComputedBoundsApplicator, LocalModelSource, SEdgeImpl, SGraphImpl, SModelFactory,
  SModelRegistry, SNodeImpl, UpdateModelCommand,
} from 'sprotty';
import { useNodeActions } from '../node-actions';
import { comGraphStore } from '../../service/com-graph-store';
import type { SprottyContext } from '../context';

vi.mock('../menu', () => ({ findDestNode: vi.fn(), findNeighborNode: vi.fn() }));
vi.mock('../svgExport', () => ({ createSvg: vi.fn() }));
vi.mock('../animation', () => ({ cancelRectAnimation: vi.fn(), startRectAnimation: vi.fn() }));

function setup(preserveSelectionLayout = true) {
  const schema = {
    id: 'root', type: 'graph', zoom: 0.5, scroll: { x: 10, y: 20 },
    children: [
      { id: 'a', type: 'node', position: { x: 120, y: 80 }, size: { width: 260, height: 80 }, baseColor: '#9e4970' },
      { id: 'b', type: 'node', position: { x: 520, y: 180 }, size: { width: 120, height: 31 }, baseColor: '#00707c' },
      { id: 'a-b', type: 'edge', sourceId: 'a', targetId: 'b', routingPoints: [{ x: 380, y: 120 }, { x: 520, y: 195 }] },
    ],
  };
  const factory = new SModelFactory();
  (factory as any).registry = new SModelRegistry([
    { type: 'graph', constr: SGraphImpl }, { type: 'node', constr: SNodeImpl },
    { type: 'rect', constr: SNodeImpl }, { type: 'edge', constr: SEdgeImpl },
  ]);
  let displayed = factory.createRoot(schema);
  const initial = factory.createSchema(displayed);
  const source = new LocalModelSource();
  source.commitModel(schema);
  const layout = vi.fn((root) => root);
  const request = vi.fn(async () => ({
    kind: 'computedBounds', bounds: ['a', 'b'].map((elementId) => ({ elementId, newSize: { width: 0, height: 0 } })),
  }));
  const dispatch = vi.fn(async (action) => {
    if (action.kind === 'updateModel') {
      // Execute the real Sprotty update against the currently displayed model.
      displayed = new UpdateModelCommand({ ...action, animate: false }).execute({
        root: displayed, modelFactory: factory,
      } as any) as SGraphImpl;
    }
  });
  Object.assign(source, {
    viewerOptions: { needsClientLayout: true }, computedBoundsApplicator: new ComputedBoundsApplicator(),
    actionDispatcher: { dispatch, request }, layoutEngine: { layout }, lastSubmittedModelType: 'graph',
  });
  const actions = useNodeActions({ modelSource: source } as SprottyContext, preserveSelectionLayout);
  const geometry = () => factory.createSchema(displayed).children?.filter((node) => node.id !== 'show-node-rect');
  return { actions, source, initial, geometry, displayed: () => displayed, request, layout };
}

beforeEach(() => {
  Object.assign(comGraphStore.data, {
    fourColRectNodeIds: [], fourColFocusNodeIds: [], fourColDimNodeIds: [], selectedNodeSemanticLabel: '', notNeedLayout: false,
  });
});

describe('four-column selection preserves displayed geometry', () => {
  it('preserves nodes, colors and edge routing through repeated lock/unlock updates', async () => {
    const test = setup();
    for (let cycle = 0; cycle < 6; cycle++) {
      await test.actions.createSelectNodesRectByIds(['a', 'b'], false);
      expect(test.displayed().index.getById('show-node-rect')).toBeDefined();
      await test.actions.removeSelectNodesRect();
      await test.actions.updateModelAction();
      expect(test.displayed().index.getById('show-node-rect')).toBeUndefined();
      expect(test.geometry()).toEqual(test.initial.children);
      expect(test.source.model.children?.filter((node) => node.type === 'node').map((node: any) => node.size.width)).toEqual([260, 120]);
    }
    expect(test.request).not.toHaveBeenCalled();
    expect(test.layout).not.toHaveBeenCalled();
    expect((comGraphStore.data as any).notNeedLayout).toBe(false);
  });

  it('keeps the displayed geometry when consecutive CCE locks replace or reuse the same box', async () => {
    const test = setup();
    for (const ids of [['a'], ['a', 'b'], ['a', 'b'], ['b'], ['a']]) {
      await test.actions.createSelectNodesRectByIds(ids, false);
      await test.actions.updateModelAction();
      expect(test.geometry()).toEqual(test.initial.children);
      expect((test.displayed().index.getById('show-node-rect') as any).selectedNodes).toEqual(ids);
      expect(test.displayed().children.filter((node) => node.id === 'show-node-rect')).toHaveLength(1);
    }
    expect(test.request).not.toHaveBeenCalled();
  });

  it('refreshes the displayed model even when the source contains stale zero bounds', async () => {
    const test = setup();
    for (const node of test.source.model.children ?? []) {
      if (node.type === 'node') (node as any).size = { width: 0, height: 0 };
    }
    await test.actions.updateModelAction();
    expect(test.geometry()).toEqual(test.initial.children);
  });

  it('retains the existing bounds/layout submission for other modes', async () => {
    const test = setup(false);
    await test.actions.createSelectNodesRectByIds(['a'], false);
    expect(test.request).toHaveBeenCalledOnce();
    expect(test.layout).toHaveBeenCalledOnce();
  });
});
