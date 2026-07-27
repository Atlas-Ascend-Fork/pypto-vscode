/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MemoryUsageSidebar from '../memoryUsageSidebar.vue';
import { createMemoryUnitFixture } from './memory-unit-fixture';

const chartState = vi.hoisted(() => ({
  options: [] as any[],
  dispatchActions: [] as any[],
  eventHandlers: {} as Record<string, (event: any) => void>,
  initCount: 0,
  disposeCount: 0,
}));

vi.mock('echarts', () => ({
  init: vi.fn((dom: HTMLElement) => {
    chartState.initCount++;
    Object.defineProperty(dom, 'clientWidth', { configurable: true, value: 800 });
    dom.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {},
    }));
    return {
      clear: vi.fn(),
      dispatchAction: vi.fn((action: any) => chartState.dispatchActions.push(action)),
      dispose: vi.fn(() => chartState.disposeCount++),
      getDom: vi.fn(() => dom),
      off: vi.fn((eventName: string) => delete chartState.eventHandlers[eventName]),
      on: vi.fn((eventName: string, handler: (event: any) => void) => {
        chartState.eventHandlers[eventName] = handler;
      }),
      resize: vi.fn(),
      setOption: vi.fn((option: any) => chartState.options.push(option)),
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

function createSelectedNode(includeSecondTensor = false) {
  const fixture = createMemoryUnitFixture();
  const tensor = fixture.rawTensors[0];
  const baseAccess = tensor.accesses[0];

  const firstTensor = {
    ...tensor,
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
    .filter((row: any[]) => Array.isArray(row) && row.length === 10 && typeof row[8] === 'boolean');
}

function getRulerLabels(option: any) {
  const ruler = option.series.at(-1);
  const rendered = ruler.renderItem({ coordSys: { x: 110, y: 65, width: 660, height: 165 }});
  return rendered.children.filter((child: any) => child.type === 'text').map((child: any) => child.style.text);
}

describe('memoryUsageSidebar access filter', () => {
  beforeEach(() => {
    chartState.options = [];
    chartState.dispatchActions = [];
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
        provide: {
          root: { isDarkTheme: ref(true) },
        },
        stubs: {
          'd-switch': SwitchStub,
        },
      },
    });

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
        provide: { root: { isDarkTheme: ref(true) }},
        stubs: { 'd-switch': SwitchStub },
      },
    });
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
    expect(chartState.options.at(-1).xAxis.every((axis: any) => axis.max === 600)).toBe(true);
    expect(getAccessRows(chartState.options.at(-1))).toHaveLength(0);

    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();
    const readOnlyRows = getAccessRows(chartState.options.at(-1));
    expect(readOnlyRows).toHaveLength(6);
    expect(readOnlyRows.every((row: any[]) => row[8] === false)).toBe(true);

    wrapper.unmount();
  });

  it('uses one default tensor color when color metadata is unavailable', async () => {
    const selectedNode = createSelectedNode();
    delete selectedNode.tensors[0].color;
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode },
      global: {
        provide: { root: { isDarkTheme: ref(true) }},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await nextTick();
    await nextTick();

    const renderer = chartState.options.at(-1).series[0].renderItem;
    const renderApi = (isWrite: number) => ({
      value: (index: number) => [0, 0, 20, 0, 20, 1, 1, 1, isWrite, 0][index],
      coord: ([x, y]: number[]) => [x, y],
    });
    const coordSys = { x: 0, y: 0, width: 400, height: 200 };

    expect(renderer({ coordSys }, renderApi(1)).children[0].style).toMatchObject({ fill: '#574096', opacity: 1 });
    expect(renderer({ coordSys }, renderApi(0)).children[0].style).toMatchObject({ fill: '#574096', opacity: 0.6 });

    wrapper.unmount();
  });

  it('zooms every dimension around the pointer, preserves zoom on filtering, and resets it on tab changes', async () => {
    const wrapper = mount(MemoryUsageSidebar, {
      props: { selectedNode: createSelectedNode(true) },
      global: {
        provide: { root: { isDarkTheme: ref(true) }},
        stubs: { 'd-switch': SwitchStub },
      },
    });
    await nextTick();
    await nextTick();

    const initialOption = chartState.options.at(-1);
    expect(initialOption.dataZoom).toHaveLength(2);
    expect(initialOption.dataZoom[0]).toMatchObject({
      id: 'detail-x-slider', type: 'slider', show: true, xAxisIndex: [0, 1], filterMode: 'none', startValue: 0, endValue: 400,
    });
    expect(initialOption.dataZoom[1]).toMatchObject({
      id: 'detail-x-inside', type: 'inside', xAxisIndex: [0, 1], filterMode: 'none', startValue: 0, endValue: 400,
    });
    const cardRenderer = initialOption.series[0].renderItem;
    const renderApi = (row: any[]) => ({
      value: (index: number) => row[index],
      coord: ([x, y]: number[]) => [x, y],
    });
    const coordSys = { x: 0, y: 0, width: 400, height: 200 };
    const writeCard = cardRenderer({ coordSys }, renderApi([0, -10, 20, 0, 20, 1, 1, 1, true, 0]));
    const readCard = cardRenderer({ coordSys }, renderApi([0, -10, 20, 0, 20, 1, 1, 1, false, 0]));
    expect(writeCard.type).toBe('group');
    expect(writeCard.children[0].style).toMatchObject({ fill: '#574096', opacity: 1 });
    expect(readCard.children[0].style).toMatchObject({ fill: '#574096', opacity: 0.6 });
    expect(cardRenderer({ coordSys }, renderApi([0, 410, 430, 0, 20, 1, 1, 1, true, 0]))).toBeNull();
    const overlapRenderer = initialOption.series[1].renderItem;
    expect(overlapRenderer({ coordSys }, renderApi([0, -10, 20, 0, 20, 1]))).not.toBeNull();
    expect(overlapRenderer({ coordSys }, renderApi([0, 410, 430, 0, 20, 1]))).toBeNull();
    expect(cardRenderer({ coordSys }, renderApi([0, 0, 20, 0, 20, 1, 1, 1, true, 0])).type).toBe('group');
    const fullRulerLabels = getRulerLabels(initialOption);
    expect(fullRulerLabels).toHaveLength(16);
    expect(fullRulerLabels.at(-1)).toBe('0,39KB');

    wrapper.get('.echarts-dom').element.dispatchEvent(
      new WheelEvent('wheel', { ctrlKey: true, clientX: 455, deltaY: -100, bubbles: true }),
    );
    const zoomAction = chartState.dispatchActions.at(-1);
    expect(zoomAction).toMatchObject({ type: 'dataZoom' });
    expect(zoomAction.batch.map((entry: any) => entry.dataZoomId)).toEqual(['detail-x-slider', 'detail-x-inside']);
    expect(zoomAction.batch[0].startValue).toBeGreaterThan(0);
    expect(zoomAction.batch[0].endValue - zoomAction.batch[0].startValue).toBeCloseTo(320);
    const zoomedRulerLabels = getRulerLabels(initialOption);
    expect(zoomedRulerLabels).toHaveLength(16);
    expect(zoomedRulerLabels).not.toEqual(fullRulerLabels);

    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();
    expect(chartState.options.at(-1).dataZoom[0]).toMatchObject({
      startValue: zoomAction.batch[0].startValue,
      endValue: zoomAction.batch[0].endValue,
    });
    expect(getRulerLabels(chartState.options.at(-1))).toEqual(zoomedRulerLabels);

    await wrapper.findAll('.tensor-tab')[1].trigger('click');
    await nextTick();
    const secondTensorOption = chartState.options.at(-1);
    expect(secondTensorOption.dataZoom[0]).toMatchObject({ xAxisIndex: [0, 1, 2], startValue: 0, endValue: 600 });
    expect(getRulerLabels(secondTensorOption).at(-1)).toBe('0,59KB');
    const secondTensorReadCard = secondTensorOption.series[0].renderItem(
      { coordSys },
      renderApi([0, 0, 20, 0, 20, 1, 1, 1, false, 0]),
    );
    expect(secondTensorReadCard.children[0].style).toMatchObject({ fill: '#4169a8', opacity: 0.6 });

    expect(chartState.eventHandlers.datazoom).toBeTypeOf('function');
    chartState.eventHandlers.datazoom({ batch: [{ startValue: 100, endValue: 500 }]});
    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();
    expect(getAccessRows(chartState.options.at(-1))).toHaveLength(0);
    expect(chartState.options.at(-1).dataZoom[0]).toMatchObject({ startValue: 100, endValue: 500 });

    await wrapper.get('.access-switch-stub').trigger('click');
    await nextTick();
    expect(getAccessRows(chartState.options.at(-1))).toHaveLength(6);
    expect(chartState.options.at(-1).dataZoom[0]).toMatchObject({ startValue: 100, endValue: 500 });
    expect(chartState.initCount).toBe(1);
    expect(chartState.disposeCount).toBe(0);

    wrapper.unmount();
  });
});
