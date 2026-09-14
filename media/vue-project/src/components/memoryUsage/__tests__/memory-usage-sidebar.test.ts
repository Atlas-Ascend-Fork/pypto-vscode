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
import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MemoryUsageSidebar from '../memoryUsageSidebar.vue';
import MemoryAccessTable from '../detail/MemoryAccessTable.vue';
import { generateColorListExcludingReds } from '../utils';
import { createMemoryUnitFixture } from './memory-unit-fixture';

const chartState = vi.hoisted(() => ({
  options: [] as any[],
  dispatchActions: [] as any[],
  instances: [] as Array<{ options: any[]; dispatchActions: any[]; eventHandlers: Record<string, (event: any) => void> }>,
  eventHandlers: {} as Record<string, (event: any) => void>,
  initCount: 0,
  disposeCount: 0,
}));

vi.mock('echarts', () => ({
  init: vi.fn((dom: HTMLElement) => {
    chartState.initCount++;
    const instance = { options: [] as any[], dispatchActions: [] as any[], eventHandlers: {} as Record<string, (event: any) => void> };
    chartState.instances.push(instance);
    Object.defineProperty(dom, 'clientWidth', { configurable: true, value: 800 });
    dom.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {},
    }));
    return {
      clear: vi.fn(),
      dispatchAction: vi.fn((action: any) => {
        chartState.dispatchActions.push(action);
        instance.dispatchActions.push(action);
      }),
      dispose: vi.fn(() => chartState.disposeCount++),
      getDom: vi.fn(() => dom),
      off: vi.fn((eventName: string) => {
        delete chartState.eventHandlers[eventName];
        delete instance.eventHandlers[eventName];
      }),
      on: vi.fn((eventName: string, handler: (event: any) => void) => {
        chartState.eventHandlers[eventName] = handler;
        instance.eventHandlers[eventName] = handler;
      }),
      resize: vi.fn(),
      setOption: vi.fn((option: any) => {
        chartState.options.push(option);
        instance.options.push(option);
      }),
    };
  }),
  graphic: {
    clipRectByRect: vi.fn((shape) => shape),
  },
}));

const SwitchStub = defineComponent({
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  template: '<button class="access-switch-stub" :aria-pressed="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />',
});

function createSelectedNode(includeSecondTensor = false, size = 400) {
  const fixture = createMemoryUnitFixture();
  const tensor = fixture.rawTensors[0];
  const baseAccess = tensor.accesses[0];

  const firstTensor = {
    ...tensor,
    size,
    accesses: [
      { ...baseAccess, rawmagic: tensor.rawmagic, seqNo: 'write-access', execStart: 130, execEnd: 140, isWrite: true },
      { ...baseAccess, rawmagic: tensor.rawmagic, seqNo: 'read-access', execStart: 150, execEnd: 160, isWrite: false },
    ],
  };
  const tensors = [
    {
      id: 'tensor-a',
      label: 'tensor-a',
      rawTensor: firstTensor,
      color: { base: '#574096', light: '#765cb9' },
    },
  ];

  if (includeSecondTensor) {
    tensors.push({
      id: 'tensor-b',
      label: 'tensor-b',
      rawTensor: {
        ...firstTensor,
        rawId: 'tensor-b',
        rawmagic: 'magic-beta',
        ndim: 3,
        rawShape: [2, 2, 2],
        size: 600,
        accesses: firstTensor.accesses.map((access) => ({
          ...access, rawmagic: 'magic-beta', offset: [0, 0, 0], shape: [1, 1, 1], isWrite: false,
        })),
      },
      color: { base: '#4169a8', light: '#6288c2' },
    });
  }

  return {
    meta: fixture.meta,
    tensors,
  };
}

function getAccessRows(option: any) {
  return option.series
    .flatMap((series: any) => series.data || [])
    .filter((row: any[]) => Array.isArray(row) && row.length === 12 && typeof row[8] === 'boolean');
}

function getRulerLabels(option: any) {
  const ruler = option.series.find((series: any) => series.id === 'dimension-ruler-0');
  const rendered = ruler.renderItem({ coordSys: { x: 110, y: 102, width: 660, height: 1 }});
  return rendered.children.filter((child: any) => child.type === 'text').map((child: any) => child.style.text);
}

async function showChartView(wrapper: any) {
  await wrapper.get('[aria-label="Chart view"]').trigger('click');
  await nextTick();
  await nextTick();
}

function getRulerGraphic(option: any, width = 660) {
  const ruler = option.series.find((series: any) => series.id === 'dimension-ruler-0');
  return ruler.renderItem({ coordSys: { x: 110, y: 102, width, height: 1 }});
}

describe('memoryUsageSidebar access filter', () => {
  beforeEach(() => {
    chartState.options = [];
    chartState.dispatchActions = [];
    chartState.instances = [];
    chartState.eventHandlers = {};
    chartState.initCount = 0;
    chartState.disposeCount = 0;
  });

  it('defaults to writes and shows all accesses when the filter is inactive', async () => {
    const wrapper = mount(MemoryUsageSidebar, {
      props: {
        selectedNode: createSelectedNode(),
      },
      global: {
        config: { globalProperties: { $t: () => 'Write only'}},
        provide: {
          root: { isDarkTheme: ref(true) },
        },
        stubs: {
          'd-switch': SwitchStub,
        },
      },
    });

    await showChartView(wrapper);
    await nextTick();
    await nextTick();

    expect(wrapper.get('.filter-switch').text()).toBe('Write only');
    const writeRows = getAccessRows(chartState.options.at(-1));
    expect(writeRows).toHaveLength(2);
    expect(writeRows.every((row: any[]) => row[8] === true)).toBe(true);

    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();

    expect(wrapper.get('.filter-switch').text()).toBe('Write only');
    const allRows = getAccessRows(chartState.options.at(-1));
    expect(allRows).toHaveLength(4);
    expect(new Set(allRows.map((row: any[]) => row[8]))).toEqual(new Set([true, false]));

    await wrapper.setProps({ selectedNode: createSelectedNode() });
    await nextTick();
    await nextTick();

    expect(wrapper.get('.access-switch-stub').attributes('aria-pressed')).toBe('false');
    expect(getAccessRows(chartState.options.at(-1))).toHaveLength(4);

    wrapper.unmount();
  });

  it('always shows tensor tabs and isolates the active tensor model', async () => {
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode: createSelectedNode(true) },
      global: {
        config: { globalProperties: { $t: () => 'Write only'}},
        provide: { root: { isDarkTheme: ref(true)}},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await showChartView(wrapper);
    await nextTick();
    await nextTick();

    const tabs = wrapper.findAll('.tensor-tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[aria-label="Previous tensor"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[aria-label="Next tensor"]').attributes('disabled')).toBeUndefined();
    expect(chartState.options.at(-1).xAxis).toHaveLength(2);

    await tabs[1].trigger('mouseenter');
    expect(wrapper.get('.tensor-preview').text()).toContain('tensor-b');
    expect(wrapper.get('.tensor-preview').text()).toContain('magic-beta');
    expect(wrapper.get('.tensor-preview').text()).toContain('[2,2,2]');
    await tabs[1].trigger('mouseleave');
    expect(wrapper.find('.tensor-preview').exists()).toBe(false);

    await wrapper.get('[aria-label="Next tensor"]').trigger('click');
    await nextTick();

    expect(wrapper.findAll('.tensor-tab')[1].attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[aria-label="Previous tensor"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[aria-label="Next tensor"]').attributes('disabled')).toBeDefined();
    expect(chartState.options.at(-1).xAxis).toHaveLength(3);
    expect(chartState.options.at(-1).xAxis.every((axis: any) => axis.max === 2)).toBe(true);
    expect(getAccessRows(chartState.options.at(-1))).toHaveLength(0);

    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();
    const readOnlyRows = getAccessRows(chartState.options.at(-1));
    expect(readOnlyRows).toHaveLength(6);
    expect(readOnlyRows.every((row: any[]) => row[8] === false)).toBe(true);

    wrapper.unmount();
  });

  it('defaults to the searchable access table and switches to the chart', async () => {
    const selectedNode = createSelectedNode();
    selectedNode.tensors[0].rawTensor.accesses[1].funcId = 'read-func';
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode },
      global: {
        config: {
          globalProperties: {
            $t: (key: string) => ({ tableSearch: 'Search...', chartView: 'Chart view', listView: 'List view' }[key] || 'Write only'),
          },
        },
        provide: { root: { isDarkTheme: ref(true)}},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await nextTick();
    await nextTick();

    expect(wrapper.get('[aria-label="Table view"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('[aria-label="Chart view"] .chart-view-icon').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Table view"] .list-view-icon').exists()).toBe(true);
    expect(wrapper.find('.access-table-view').exists()).toBe(true);

    expect(wrapper.get('[aria-label="Table view"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('.access-table').text()).toContain('HASOVERLAP');
    expect(wrapper.findAll('.access-table tbody tr')).toHaveLength(1);
    expect(wrapper.get('.access-table tbody tr').text()).toContain('W');
    expect(wrapper.get('.access-table tbody tr').text()).toContain('false');
    expect(getComputedStyle(wrapper.get('.access-type').element).fontWeight).not.toBe('700');

    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();
    expect(wrapper.findAll('.access-table tbody tr')).toHaveLength(2);

    await wrapper.get('[aria-label="Search accesses"]').setValue('read-func');
    await nextTick();
    expect(wrapper.findAll('.access-table tbody tr')).toHaveLength(1);
    expect(wrapper.get('.access-table tbody tr').text()).toContain('R');

    await wrapper.get('.access-table tbody tr').trigger('click');
    expect(wrapper.get('.access-table tbody tr').classes()).toContain('selected');

    await wrapper.get('[aria-label="Chart view"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[aria-label="Chart view"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('.memory-lane-chart').isVisible()).toBe(true);
    const selectedRenderer = chartState.options.at(-1).series[0].renderItem;
    const selectedGraphic = selectedRenderer(
      { coordSys: { x: 0, y: 0, width: 400, height: 200 }},
      {
        value: (index: number) => [0, 0, 1, 0, 1, 'read-access', 'read-func', 1, false, 0][index],
        coord: ([x, y]: number[]) => [x, y],
      },
    );
    expect(selectedGraphic.children[0].style).toMatchObject({ stroke: '#ffffff', lineWidth: 3 });

    await wrapper.setProps({ selectedNode: createSelectedNode(true) });
    await nextTick();
    await nextTick();
    expect(wrapper.get('[aria-label="Table view"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('.access-table-view').exists()).toBe(true);

    wrapper.unmount();
  });

  it('sorts access rows by EXECSTART ascending by default and toggles descending', async () => {
    const globalProperties = { $t: () => 'Search...' };
    const root = { isDarkTheme: ref(true) };
    const wrapper = mount(MemoryAccessTable, {
      props: {
        accesses: [
          { isWrite: true, execStart: 150, execEnd: 160 },
          { isWrite: false, execStart: 100, execEnd: 110 },
        ],
        selectedKey: '',
        tensorId: 'tensor-a',
        writesOnly: false,
      },
      global: {
        config: { globalProperties },
        provide: { root },
      },
    });

    const execStartCells = () => wrapper.findAll('.access-table tbody tr').map((row) => row.findAll('td')[7].text());
    const sortButton = wrapper.get('[aria-label="Sort EXECSTART descending"]');
    expect(sortButton.element.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(execStartCells()).toEqual(['100', '150']);

    await sortButton.trigger('click');
    expect(wrapper.get('[aria-label="Sort EXECSTART ascending"]').element.closest('th')?.getAttribute('aria-sort')).toBe('descending');
    expect(execStartCells()).toEqual(['150', '100']);

    wrapper.unmount();
  });

  it('uses consistent distinct colors for access nodes based on taskId', async () => {
    const selectedNode = createSelectedNode();
    selectedNode.tensors[0].rawTensor.accesses[0].taskId = 'task-a';
    selectedNode.tensors[0].rawTensor.accesses[1].taskId = 'task-a';
    selectedNode.tensors[0].rawTensor.accesses.push({
      ...selectedNode.tensors[0].rawTensor.accesses[0],
      seqNo: 'second-task',
      taskId: 'task-b',
    });
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode },
      global: {
        config: { globalProperties: { $t: () => 'Write only'}},
        provide: { root: { isDarkTheme: ref(true)}},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await showChartView(wrapper);
    await nextTick();
    await nextTick();

    const renderer = chartState.options.at(-1).series[0].renderItem;
    const renderApi = (taskId: string, isWrite: number) => ({
      value: (index: number) => [0, 0, 20, 0, 20, 1, 1, 1, isWrite, 0, false, taskId][index],
      coord: ([x, y]: number[]) => [x, y],
    });
    const coordSys = { x: 0, y: 0, width: 400, height: 200 };
    const colors = generateColorListExcludingReds(2, true).baseColorList;

    expect(renderer({ coordSys }, renderApi('task-a', 1)).children[0].style).toMatchObject({ fill: colors[0] });
    expect(renderer({ coordSys }, renderApi('task-a', 0)).children[0].style).toMatchObject({ fill: colors[0] });
    expect(renderer({ coordSys }, renderApi('task-b', 1)).children[0].style).toMatchObject({ fill: colors[1] });
    expect(colors[1]).not.toBe(colors[0]);

    wrapper.unmount();
  });

  it('provides an independent slider, scale, and ruler for every dimension', async () => {
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode: createSelectedNode(true) },
      global: {
        config: { globalProperties: { $t: () => 'Write only'}},
        provide: { root: { isDarkTheme: ref(true)}},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await showChartView(wrapper);
    await nextTick();
    await nextTick();

    const initialOption = chartState.instances[0].options.at(-1);
    expect(initialOption.dataZoom).toHaveLength(4);
    expect(initialOption.dataZoom[0]).toMatchObject({
      id: 'detail-x-slider-0', type: 'slider', show: true, xAxisIndex: 0, filterMode: 'none', start: 0, end: 100, height: 20,
      throttle: 16,
    });
    expect(initialOption.dataZoom[1]).toMatchObject({
      id: 'detail-x-inside-0', type: 'inside', xAxisIndex: 0, filterMode: 'none', start: 0, end: 100,
      throttle: 16, zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, moveOnMouseMove: true, preventDefaultMouseMove: true,
    });
    expect(initialOption.dataZoom[2]).toMatchObject({ id: 'detail-x-slider-1', xAxisIndex: 1 });
    expect(initialOption.dataZoom[3]).toMatchObject({ id: 'detail-x-inside-1', xAxisIndex: 1 });
    expect(initialOption.xAxis.map((axis: any) => axis.max)).toEqual([1, 4]);
    expect(initialOption.series.filter((series: any) => series.id?.startsWith('dimension-ruler-'))).toHaveLength(2);
    expect(wrapper.find('.memory-zoom-controls').exists()).toBe(false);
    expect(wrapper.find('.sidebar-body-wrapper').exists()).toBe(true);
    const cardRenderer = initialOption.series[0].renderItem;
    const renderApi = (row: any[]) => ({
      value: (index: number) => row[index],
      coord: ([x, y]: number[]) => [x, y],
    });
    const coordSys = { x: 0, y: 0, width: 400, height: 200 };
    const taskColor = generateColorListExcludingReds(1, true).baseColorList[0];
    const writeCard = cardRenderer({ coordSys }, renderApi([0, -10, 20, 0, 20, 1, 1, 1, true, 0, false, 1]));
    const readCard = cardRenderer({ coordSys }, renderApi([0, -10, 20, 0, 20, 1, 1, 1, false, 0, false, 1]));
    expect(writeCard.type).toBe('group');
    expect(writeCard.children[0].style).toMatchObject({ fill: taskColor });
    expect(readCard.children[0].style).toMatchObject({ fill: taskColor });
    expect(cardRenderer({ coordSys }, renderApi([0, 17, 18, 0, 20, 1, 1, 1, true, 0]))).toBeNull();
    const overlapRenderer = initialOption.series[1].renderItem;
    expect(overlapRenderer({ coordSys }, renderApi([0, -10, 20, 0, 20, 1]))).not.toBeNull();
    expect(overlapRenderer({ coordSys }, renderApi([0, 17, 18, 0, 20, 1]))).toBeNull();
    expect(cardRenderer({ coordSys }, renderApi([0, 0, 20, 0, 20, 1, 1, 1, true, 0])).type).toBe('group');
    const fullRulerLabels = getRulerLabels(initialOption);
    expect(fullRulerLabels).toHaveLength(16);
    expect(fullRulerLabels.at(-1)).toBe('1');

    const chartElement = wrapper.get('.memory-lane-chart').element;
    const optionCountBeforeDrag = chartState.instances[0].options.length;
    chartElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    chartState.instances[0].eventHandlers.datazoom({
      batch: [{ dataZoomId: 'detail-x-inside-1', start: 25, end: 75 }],
    });
    expect(chartState.instances[0].dispatchActions).toHaveLength(0);
    expect(chartState.instances[0].options).toHaveLength(optionCountBeforeDrag);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(chartState.instances[0].options.at(-1).dataZoom[2]).toMatchObject({ start: 25, end: 75 });

    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();
    const filteredOption = chartState.instances[0].options.at(-1);
    expect(filteredOption.dataZoom[0]).toMatchObject({ start: 0, end: 100 });
    expect(filteredOption.dataZoom[2]).toMatchObject({ start: 25, end: 75 });

    await wrapper.findAll('.tensor-tab')[1].trigger('click');
    await nextTick();
    const secondTensorOption = chartState.options.at(-1);
    expect(secondTensorOption.dataZoom).toHaveLength(6);
    expect(
      secondTensorOption.dataZoom.filter((zoom: any) => zoom.type === 'slider').every((zoom: any) => zoom.start === 0 && zoom.end === 100),
    ).toBe(true);
    expect(secondTensorOption.xAxis.map((axis: any) => axis.max)).toEqual([2, 2, 2]);
    const secondTensorReadCard = secondTensorOption.series[0].renderItem(
      { coordSys },
      renderApi([0, 0, 20, 0, 20, 1, 1, 1, false, 0, false, 1]),
    );
    expect(secondTensorReadCard.children[0].style).toMatchObject({ fill: taskColor });

    expect(chartState.initCount).toBe(1);
    expect(chartState.disposeCount).toBe(0);

    const scrollContainer = wrapper.get('.sidebar-body-wrapper').element;
    const regularWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    chartElement.dispatchEvent(regularWheel);
    expect(regularWheel.defaultPrevented).toBe(true);
    expect(scrollContainer.scrollTop).toBe(120);

    const ctrlWheel = new WheelEvent('wheel', { cancelable: true, ctrlKey: true });
    chartElement.dispatchEvent(ctrlWheel);
    expect(ctrlWheel.defaultPrevented).toBe(true);

    wrapper.unmount();
    expect(chartState.disposeCount).toBe(1);

    const wheelAfterUnmount = new WheelEvent('wheel', { cancelable: true, ctrlKey: true });
    chartElement.dispatchEvent(wheelAfterUnmount);
    expect(wheelAfterUnmount.defaultPrevented).toBe(false);
  });

  it('keeps dimension ruler ticks distinct at minimum zoom', async () => {
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode: createSelectedNode() },
      global: {
        config: { globalProperties: { $t: () => 'Write only'}},
        provide: { root: { isDarkTheme: ref(true)}},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await showChartView(wrapper);
    await nextTick();
    await nextTick();

    chartState.instances[0].eventHandlers.datazoom({
      batch: [{ dataZoomId: 'detail-x-slider-0', start: 99.9, end: 100 }],
    });
    const labels = getRulerLabels(chartState.instances[0].options.at(-1));
    expect(new Set(labels).size).toBe(16);
    expect(labels.at(-1)).toBe('1');
    expect(labels.some((label: string) => label.includes('.'))).toBe(true);

    wrapper.unmount();
  });

  it('fills the live sidebar width with ruler squares and keeps rotated unit labels visible', async () => {
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode: createSelectedNode() },
      global: {
        config: { globalProperties: { $t: () => 'Write only'}},
        provide: { root: { isDarkTheme: ref(true)}},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await showChartView(wrapper);
    await nextTick();
    await nextTick();

    const graphic = getRulerGraphic(chartState.instances[0].options.at(-1), 300);
    const squares = graphic.children.filter((child: any) => child.type === 'rect');
    const labels = graphic.children.filter((child: any) => child.type === 'text');

    expect(graphic.$mergeChildren).toBe(false);
    expect(squares.at(-1).shape.x + squares.at(-1).shape.width).toBeGreaterThan(400);
    expect(labels).toHaveLength(16);
    expect(labels.every((label: any) => label.rotation === -Math.PI / 4 && label.originY === 64)).toBe(true);
    expect(labels.at(-1).style).toMatchObject({ align: 'center', text: '1' });

    wrapper.unmount();
  });
});
