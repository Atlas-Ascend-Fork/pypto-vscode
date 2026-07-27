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
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MemoryUsage from '../memoryUsage.vue';
import { createMemoryUnitFixture } from './memory-unit-fixture';

/* eslint-disable vue/one-component-per-file */

const testState = vi.hoisted(() => ({
  server: {} as Record<string, any>,
  chart: null as any,
  charts: [] as any[],
  eventHandlers: new Map<string, (...args: any[]) => void>(),
}));

vi.mock('@/core/use-view-server.ts', () => ({
  useViewServer: () => ({ server: testState.server }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('echarts', () => {
  const init = vi.fn((dom: HTMLElement) => {
    const zrHandlers = new Map<string, (...args: any[]) => void>();
    const chart = {
      convertFromPixel: vi.fn((_axis, value) => value),
      convertToPixel: vi.fn((_axis, value) => Number(value)),
      dispatchAction: vi.fn(),
      dispose: vi.fn(),
      getDom: vi.fn(() => dom),
      getModel: vi.fn(() => ({
        getComponent: vi.fn((name: string) => ({
          axis: {
            scale: {
              getExtent: vi.fn(() => name === 'xAxis' ? [1, 11.5] : [0, 2250]),
            },
          },
        })),
      })),
      getWidth: vi.fn(() => 1000),
      getZr: vi.fn(() => ({
        on: vi.fn((event: string, handler: (...args: any[]) => void) => zrHandlers.set(event, handler)),
        setCursorStyle: vi.fn(),
      })),
      on: vi.fn((event: string, filterOrHandler: unknown, maybeHandler?: (...args: any[]) => void) => {
        const handler = (typeof filterOrHandler === 'function' ? filterOrHandler : maybeHandler) as
          | ((...args: any[]) => void)
          | undefined;
        if (handler) {
          testState.eventHandlers.set(event, handler);
        }
      }),
      resize: vi.fn(),
      setOption: vi.fn(),
    };
    testState.chart = chart;
    testState.charts.push(chart);
    return chart;
  });

  return {
    init,
    graphic: {
      clipRectByRect: vi.fn((shape) => shape),
    },
  };
});

const TimelineStub = defineComponent({
  name: 'SwimGraphTimeline',
  setup(_, { expose }) {
    expose({
      flagRender: vi.fn(),
      initCanvases: vi.fn(),
      resizeCanvases: vi.fn(),
    });
    return () => null;
  },
});

const IconStub = defineComponent({
  inheritAttrs: false,
  emits: ['click'],
  template: '<button class="icon-stub" @click="$emit(\'click\', $event)" />',
});

const SidebarStub = defineComponent({
  name: 'MemoryUsageSidebar',
  props: {
    selectedNode: { type: Object, default: null },
  },
  template: '<div class="memory-sidebar-test" />',
});

function mountMemoryUsage() {
  return mount(MemoryUsage, {
    global: {
      provide: {
        root: { isDarkTheme: ref(true) },
      },
      stubs: {
        DataError: { template: '<div class="data-error" />' },
        Loading: { template: '<div class="loading-test" />' },
        MemoryUsageSidebar: SidebarStub,
        SwimGraphConfig: true,
        SwimGraphTimeline: TimelineStub,
        'd-icon': IconStub,
      },
    },
  });
}

async function settleMemoryView() {
  await flushPromises();
  await nextTick();
  await nextTick();
}

describe('memoryUsage happy path', () => {
  beforeEach(() => {
    testState.server = {
      GmMemoryVisualData: ref(createMemoryUnitFixture()),
      reportGmMemoryVisualReady: vi.fn(),
      showMessage: vi.fn(),
    };
    testState.chart = null;
    testState.charts = [];
    testState.eventHandlers.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders valid data, searches tensors, resets, and opens tensor details', async () => {
    const wrapper = mountMemoryUsage();
    await settleMemoryView();

    expect(wrapper.find('.loading-test').exists()).toBe(false);
    expect(wrapper.find('.data-error').exists()).toBe(false);
    expect(wrapper.find('.echarts-container').exists()).toBe(true);
    expect(testState.chart.setOption).toHaveBeenCalled();
    expect(testState.server.reportGmMemoryVisualReady).not.toHaveBeenCalled();
    testState.eventHandlers.get('finished')?.();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    expect(testState.server.reportGmMemoryVisualReady).toHaveBeenCalledWith({ tensorCount: 3, regionCount: 2, hasChart: true });

    const initialOption = testState.chart.setOption.mock.calls[0][0];
    expect(initialOption.series.map((series: any) => series.id)).toEqual([
      'tensors',
      'overlaps',
      'regions',
      'region-axis-labels',
    ]);
    expect(initialOption.tooltip.formatter({ seriesId: 'overlaps', data: initialOption.series[1].data[0] })).toContain('Conflict');
    const tensorGraphic = initialOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      { coord: (value: number[]) => value.map((entry) => entry * 100), value: (index: number) => initialOption.series[0].data[0][index] },
    );
    expect(tensorGraphic.children).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text' })]));

    vi.useFakeTimers();
    const search = wrapper.get('input.search-input');
    await search.setValue('magic');
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(wrapper.get('.search-results-count').text()).toBe('1/3');

    await wrapper.findAll('.icon-stub')[1].trigger('click');
    expect(wrapper.get('.search-results-count').text()).toBe('2/3');

    await search.setValue('missing-tensor');
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(wrapper.get('.search-results-count').text()).toBe('0/0');
    const noResultRow = [...initialOption.series[0].data[0]];
    noResultRow[18] = 0;
    noResultRow[19] = 1;
    const noResultTensorGraphic = initialOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      { coord: (value: number[]) => value.map((entry) => entry * 100), value: (index: number) => noResultRow[index] },
    );
    expect(noResultTensorGraphic.children).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text' })]));

    await wrapper.get('.reset-filters-btn').trigger('click');
    expect((search.element as HTMLInputElement).value).toBe('');

    const clickHandler = testState.eventHandlers.get('click');
    expect(clickHandler).toBeTypeOf('function');
    clickHandler?.({ seriesId: 'tensors', data: initialOption.series[0].data[0], event: { offsetX: 3, offsetY: 200 }});
    await nextTick();
    expect(wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode')).toMatchObject({
      tensors: [expect.objectContaining({ label: 'RawTensormagic-alpha', rawTensor: expect.objectContaining({ rawId: 'tensor-a' }) })],
    });

    clickHandler?.({ seriesId: 'overlaps', data: initialOption.series[1].data[0], event: { offsetX: 6, offsetY: 400 }});
    await nextTick();
    expect(wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode')).toMatchObject({
      tensors: [expect.objectContaining({ label: 'RawTensormagic-alpha' }), expect.objectContaining({ label: 'RawTensormagic-beta' })],
    });

    const overlapSelection = wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode');
    clickHandler?.({ seriesId: 'overlaps', data: initialOption.series[1].data[0], event: { offsetX: 4, offsetY: 290 }});
    await nextTick();
    expect(wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode')).toMatchObject({
      tensors: [expect.objectContaining({ label: 'RawTensormagic-alpha' }), expect.objectContaining({ label: 'RawTensormagic-beta' })],
    });

    const visualOverlapSelection = wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode');
    clickHandler?.({ seriesId: 'regions', data: initialOption.series[2].data[0], event: { offsetX: 6, offsetY: 700 }});
    await nextTick();
    expect(overlapSelection).not.toBe(visualOverlapSelection);
    expect(wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode')).toBe(visualOverlapSelection);

    wrapper.unmount();
  });

  it('shows the data error state for invalid server data', async () => {
    testState.server.GmMemoryVisualData = ref({ meta: {}, rawTensors: []});
    const wrapper = mountMemoryUsage();
    await settleMemoryView();

    expect(wrapper.find('.data-error').exists()).toBe(true);
    expect(wrapper.find('.echarts-container').exists()).toBe(false);
    expect(testState.chart).toBeNull();

    testState.server.GmMemoryVisualData.value = null;
    await settleMemoryView();
    expect(wrapper.find('.data-error').exists()).toBe(true);
    expect(wrapper.find('.loading-test').exists()).toBe(false);

    wrapper.unmount();
  });

  it('reinitializes for updated data and disposes resources on unmount', async () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const wrapper = mountMemoryUsage();
    await settleMemoryView();

    const firstChart = testState.charts[0];
    const nextData = createMemoryUnitFixture();
    nextData.rawTensors = nextData.rawTensors.slice(0, 1);
    testState.server.GmMemoryVisualData.value = JSON.stringify(nextData);
    await settleMemoryView();

    expect(firstChart.dispose).toHaveBeenCalledOnce();
    expect(testState.charts).toHaveLength(2);
    const secondChart = testState.charts[1];
    expect(secondChart.setOption.mock.calls[0][0].series[0].data).toHaveLength(1);

    wrapper.unmount();
    expect(secondChart.dispose).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it.each(['', '   ', '{invalid-json'])('shows the data error state for malformed JSON text', async (rawText) => {
    testState.server.GmMemoryVisualData = ref(rawText);
    const wrapper = mountMemoryUsage();
    await settleMemoryView();

    expect(wrapper.find('.data-error').exists()).toBe(true);
    expect(testState.chart).toBeNull();

    testState.server.GmMemoryVisualData.value = null;
    await settleMemoryView();
    expect(wrapper.find('.data-error').exists()).toBe(true);
    expect(wrapper.find('.loading-test').exists()).toBe(false);

    wrapper.unmount();
  });
});
