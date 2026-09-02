/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { defineComponent, inject, nextTick, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MemoryUsage from '../memoryUsage.vue';
import { createMemoryUnitFixture } from './memory-unit-fixture';

const testState = vi.hoisted(() => ({
  server: {} as Record<string, any>,
  chart: null as any,
  charts: [] as any[],
  eventHandlers: new Map<string, (...args: any[]) => void>(),
  zrHandlers: new Map<string, (...args: any[]) => void>(),
  timelineState: null as any,
  viewState: null as any,
  swimGraphMethods: null as any,
}));

vi.mock('@/core/use-view-server.ts', () => ({
  useViewServer: () => ({ server: testState.server }),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => ({ memoryShowAdjacentTensors: 'Show adjacent tensors' }[key] || key) }),
}));

vi.mock('echarts', () => {
  class GraphicElement {
    children: any[] = [];

    constructor(options: Record<string, any>) {
      Object.assign(this, options);
    }

    add(child: any) {
      this.children.push(child);
    }
  }

  const init = vi.fn((dom: HTMLElement) => {
    const zrHandlers = new Map<string, (...args: any[]) => void>();
    const zr = {
      add: vi.fn(),
      on: vi.fn((event: string, handler: (...args: any[]) => void) => zrHandlers.set(event, handler)),
      remove: vi.fn(),
      setCursorStyle: vi.fn(),
    };
    const chart = {
      clear: vi.fn(),
      convertFromPixel: vi.fn((_axis, value) => value),
      convertToPixel: vi.fn((_axis, value) => Array.isArray(value) ? value.map(Number) : Number(value)),
      dispatchAction: vi.fn(),
      dispose: vi.fn(),
      getDom: vi.fn(() => dom),
      getModel: vi.fn(() => ({
        getComponent: vi.fn((name: string) => {
          if (name === 'grid') {
            return {
              coordinateSystem: {
                getRect: vi.fn(() => ({ x: 180, y: 20, width: 800, height: 940 })),
              },
            };
          }
          return {
            axis: {
              scale: {
                getExtent: vi.fn(() => name === 'xAxis' ? [1, 11.5] : [0, 2250]),
              },
            },
          };
        }),
      })),
      getWidth: vi.fn(() => 1000),
      getZr: vi.fn(() => zr),
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
    testState.zrHandlers = zrHandlers;
    return chart;
  });

  return {
    init,
    graphic: {
      Group: GraphicElement,
      Rect: GraphicElement,
      clipRectByRect: vi.fn((shape) => shape),
    },
  };
});

const TimelineStub = defineComponent({
  name: 'SwimGraphTimeline',
  setup(_, { expose }) {
    const swimGraphState = inject<any>('swimGraphState');
    testState.timelineState = swimGraphState.timelineState;
    testState.viewState = swimGraphState.viewState;
    testState.swimGraphMethods = inject<any>('swimGraphMethods');
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

function mountMemoryUsage(isDarkTheme = true, theme = ref(isDarkTheme)) {
  return mount(MemoryUsage, {
    global: {
      provide: {
        root: { isDarkTheme: theme },
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

function enterRegionDetail(initialOption: any) {
  initialOption.series.find((series: any) => series.id === 'region-axis-labels').renderItem(
    { coordSys: { x: 180, y: 20, width: 800, height: 940 }},
    {},
  );
  testState.zrHandlers.get('dblclick')?.({ offsetX: 135, offsetY: 500 });
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
    testState.zrHandlers.clear();
    testState.timelineState = null;
    testState.viewState = null;
    testState.swimGraphMethods = null;
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
      'tensor-distance',
      'regions',
      'region-axis-labels',
    ]);
    expect(initialOption.series.find((series: any) => series.id === 'tensor-distance').clip).toBe(true);
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
    clickHandler?.({ seriesId: 'regions', data: initialOption.series[3].data[0], event: { offsetX: 6, offsetY: 700 }});
    await nextTick();
    expect(overlapSelection).not.toBe(visualOverlapSelection);
    expect(wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode')).toBe(visualOverlapSelection);

    wrapper.unmount();
  });

  it('keeps the level-2 timeline range synchronized for chart and timeline zoom', async () => {
    const wrapper = mountMemoryUsage();
    await settleMemoryView();

    const chartElement = wrapper.get('.echarts-container').element;
    const ctrlWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    Object.defineProperties(ctrlWheel, {
      clientX: { value: 6 },
      ctrlKey: { value: true },
      deltaY: { value: -1 },
    });
    chartElement.dispatchEvent(ctrlWheel);

    expect(ctrlWheel.defaultPrevented).toBe(true);
    const zoomAction = testState.chart.dispatchAction.mock.calls.findLast(([action]) => action.dataZoomIndex === 1)?.[0];
    expect(zoomAction.endValue - zoomAction.startValue).toBeLessThan(10.5);
    expect(testState.timelineState.startTime).toBeCloseTo(zoomAction.startValue);
    expect(testState.timelineState.endTime).toBeCloseTo(zoomAction.endValue);

    testState.viewState.canvasCssWidth = 800;
    testState.viewState.scale = 2;
    testState.viewState.offsetX = -100;
    testState.swimGraphMethods.transform();

    const timelinePerPixel = testState.viewState.timeRange / (testState.viewState.canvasCssWidth * testState.viewState.scale);
    const expectedStart = testState.viewState.minTime + Math.abs(testState.viewState.offsetX * timelinePerPixel);
    const expectedEnd = expectedStart + testState.viewState.canvasCssWidth * timelinePerPixel;
    expect(testState.timelineState.startTime).toBeCloseTo(expectedStart);
    expect(testState.timelineState.endTime).toBeCloseTo(expectedEnd);

    wrapper.unmount();
  });

  it('selects two tensors with Alt and renders their signed address distance without opening details', async () => {
    const data = createMemoryUnitFixture();
    data.rawTensors = [
      ...data.rawTensors,
      {
        ...data.rawTensors[1],
        rawId: 'tensor-d',
        instanceId: 'instance-d',
        base: 1700,
        end: 1800,
        size: 100,
        rawmagic: 'magic-beta',
      },
    ];
    testState.server.GmMemoryVisualData = ref(data);
    const wrapper = mountMemoryUsage();
    await settleMemoryView();

    const initialOption = testState.chart.setOption.mock.calls[0][0];
    const clickHandler = testState.eventHandlers.get('click');
    enterRegionDetail(initialOption);
    await nextTick();

    const detailOption = testState.chart.setOption.mock.calls.at(-1)[0];
    const firstTensor = [...detailOption.series.find((series: any) => series.id === 'tensors').data[0]];
    const overlappingTensor = [...detailOption.series.find((series: any) => series.id === 'tensors').data[1]];
    const secondTensor = [...detailOption.series.find((series: any) => series.id === 'tensors').data[2]];

    clickHandler?.({ seriesId: 'tensors', data: firstTensor, event: { event: { altKey: true }, offsetX: 3, offsetY: 200 }});
    await nextTick();
    expect(wrapper.getComponent({ name: 'MemoryUsageSidebar' }).props('selectedNode')).toBeNull();

    clickHandler?.({ seriesId: 'tensors', data: secondTensor, event: { event: { altKey: true }, offsetX: 6, offsetY: 400 }});
    await nextTick();

    const measurementOption = testState.chart.setOption.mock.calls.at(-1)[0];
    const measurementSeries = measurementOption.series.find((series: any) => series.id === 'tensor-distance');
    expect(measurementSeries.data).toHaveLength(1);
    expect(measurementSeries.data[0][8]).toBe(200);
    expect(measurementSeries.data[0][9]).toBe('200');
    expect(wrapper.get('.memory-measurement-status').text()).toBe('Distance: 200');

    const measuredGraphic = initialOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      { coord: (value: number[]) => value.map((entry) => entry * 100), value: (index: number) => firstTensor[index] },
    );
    expect(measuredGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rect',
        style: expect.objectContaining({ stroke: '#2f80ed', lineWidth: 2 }),
      }),
    ]));

    const measurementGraphic = initialOption.series.find((series: any) => series.id === 'tensor-distance').renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => Number(entry) * 100),
        value: (index: number) => measurementSeries.data[0][index],
      },
    );
    expect(measurementGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'line', style: expect.objectContaining({ lineWidth: 1 }) }),
      expect.objectContaining({ type: 'rect', shape: expect.objectContaining({ width: 32, height: 15, r: 2 }) }),
      expect.objectContaining({ type: 'text', style: expect.objectContaining({ fontSize: 9, fontWeight: 500 }) }),
    ]));
    const arrowPoints = measurementGraphic.children.find((child: any) => child.type === 'polygon').shape.points;
    expect(arrowPoints[2][0] - arrowPoints[1][0]).toBe(6);
    expect(Math.abs(arrowPoints[1][1] - arrowPoints[0][1])).toBe(4);
    expect(arrowPoints[0][1]).toBeLessThan(arrowPoints[1][1]);

    clickHandler?.({ seriesId: 'tensors', data: firstTensor, event: { event: { altKey: true }, offsetX: 3, offsetY: 200 }});
    await nextTick();
    const restartedOption = testState.chart.setOption.mock.calls.at(-1)[0];
    expect(restartedOption.series.find((series: any) => series.id === 'tensor-distance').data).toEqual([]);
    expect(wrapper.find('.memory-measurement-status').exists()).toBe(false);

    clickHandler?.({ seriesId: 'tensors', data: overlappingTensor, event: { event: { altKey: true }, offsetX: 4, offsetY: 300 }});
    await nextTick();
    const overlappingOption = testState.chart.setOption.mock.calls.at(-1)[0];
    const overlappingMeasurement = overlappingOption.series.find((series: any) => series.id === 'tensor-distance');
    expect(overlappingMeasurement.data[0][8]).toBe(-200);
    expect(overlappingMeasurement.data[0][9]).toBe('-200');
    expect(wrapper.get('.memory-measurement-status').text()).toBe('Distance: -200');
    const overlappingGraphic = initialOption.series.find((series: any) => series.id === 'tensor-distance').renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => Number(entry) * 100),
        value: (index: number) => overlappingMeasurement.data[0][index],
      },
    );
    expect(overlappingGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'line' }),
      expect.objectContaining({ type: 'text', style: expect.objectContaining({ text: '-200' }) }),
    ]));

    clickHandler?.({ seriesId: 'tensors', data: firstTensor, event: { offsetX: 3, offsetY: 200 }});
    await nextTick();
    const clearedOption = testState.chart.setOption.mock.calls.at(-1)[0];
    expect(clearedOption.series.find((series: any) => series.id === 'tensor-distance').data).toEqual([]);

    clickHandler?.({ seriesId: 'tensors', data: firstTensor, event: { event: { altKey: true }, offsetX: 3, offsetY: 200 }});
    await nextTick();
    testState.zrHandlers.get('click')?.({});
    await nextTick();
    expect(wrapper.find('.memory-measurement-status').exists()).toBe(false);

    wrapper.unmount();
  });

  it('shows the adjacent tensor action only in region detail and highlights adjacent tensors', async () => {
    const data = createMemoryUnitFixture();
    data.rawTensors = [
      ...data.rawTensors,
      {
        ...data.rawTensors[1],
        rawId: 'tensor-d',
        instanceId: 'instance-d',
        base: 1700,
        end: 1800,
        size: 100,
        rawmagic: 'magic-delta',
      },
      {
        ...data.rawTensors[1],
        rawId: 'tensor-f',
        instanceId: 'instance-f',
        base: 1700,
        end: 1800,
        size: 100,
        rawmagic: 'magic-delta-tie',
      },
      {
        ...data.rawTensors[1],
        rawId: 'tensor-e',
        instanceId: 'instance-e',
        base: 1850,
        end: 1950,
        size: 100,
        rawmagic: 'magic-beta',
      },
      {
        ...data.rawTensors[1],
        rawId: 'tensor-e',
        instanceId: 'instance-e',
        base: 3200,
        end: 3300,
        size: 100,
        regionId: 1,
        rawmagic: 'magic-beta',
      },
      {
        ...data.rawTensors[1],
        rawId: 'tensor-above-a',
        instanceId: 'instance-above-a',
        base: 1000,
        end: 1100,
        size: 100,
        rawmagic: 'magic-above-a',
        lifeStart: 220,
        lifeEnd: 260,
        isWorkspace: false,
        hasOverlap: false,
      },
      {
        ...data.rawTensors[1],
        rawId: 'tensor-above-b',
        instanceId: 'instance-above-b',
        base: 1000,
        end: 1100,
        size: 100,
        rawmagic: 'magic-above-b',
        rawShape: [2, 2],
        logicalShape: [2, 2],
        lifeStart: 270,
        lifeEnd: 310,
        isWorkspace: false,
        hasOverlap: false,
      },
    ];
    testState.server.GmMemoryVisualData = ref(data);
    const wrapper = mountMemoryUsage(false);
    await settleMemoryView();

    const initialOption = testState.chart.setOption.mock.calls[0][0];
    const contextMenuHandler = testState.eventHandlers.get('contextmenu');
    const preventDefault = vi.fn();

    contextMenuHandler?.({
      seriesId: 'tensors',
      data: initialOption.series[0].data[1],
      event: { event: { preventDefault }, offsetX: 300, offsetY: 200 },
    });
    await nextTick();
    expect(wrapper.find('.tensor-context-menu').exists()).toBe(false);

    enterRegionDetail(initialOption);
    await nextTick();
    const detailOption = testState.chart.setOption.mock.calls.at(-1)[0];
    const detailTensors = detailOption.series.find((series: any) => series.id === 'tensors').data;
    const getTensorRow = (rawId: string) => detailTensors.find((row: any[]) => row[17]?.rawId === rawId);
    const anchorTensor = getTensorRow('tensor-b');
    if (!anchorTensor) {
      throw new Error('Expected tensor-b in Region 0 detail');
    }

    contextMenuHandler?.({
      seriesId: 'tensors',
      data: anchorTensor,
      event: { event: { preventDefault }, offsetX: 300, offsetY: 200 },
    });
    await nextTick();

    expect(preventDefault).toHaveBeenCalled();
    expect(wrapper.get('.tensor-context-menu').attributes('role')).toBe('menu');
    expect(wrapper.get('.tensor-context-menu').classes()).toContain('theme-light');
    expect(wrapper.get('.tensor-context-menu-item').text()).toBe('Show adjacent tensors');
    await wrapper.get('.tensor-context-menu-item').trigger('click');
    await nextTick();

    expect(wrapper.find('.tensor-context-menu').exists()).toBe(false);
    const measurementOption = testState.chart.setOption.mock.calls.at(-1)[0];
    const measurementSeries = measurementOption.series.find((series: any) => series.id === 'tensor-distance');
    expect(measurementSeries.data).toHaveLength(2);
    expect(measurementSeries.data[0][8]).toBe(200);
    expect(measurementSeries.data[1][8]).toBe(100);
    expect(measurementSeries.data[0][9]).toBe('Addr: 200');
    expect(measurementSeries.data[1][9]).toBe('Addr: 100');
    expect(wrapper.get('.memory-measurement-status').text()).toBe('Addr: 200, Addr: 100');

    const highlightedGraphic = initialOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => entry * 100),
        value: (index: number) => {
          if (index === 17) {
            return Number.NaN;
          }
          return anchorTensor[index];
        },
      },
    );
    expect(highlightedGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rect',
        style: expect.objectContaining({ stroke: '#0a59f7', lineWidth: 2 }),
      }),
      expect.objectContaining({
        type: 'text',
        style: expect.objectContaining({
          text: expect.stringContaining('{label|MagicID:} {value|'),
          rich: {
            label: expect.objectContaining({ fill: '#6f7280' }),
            value: expect.objectContaining({ fill: '#232631' }),
          },
        }),
      }),
    ]));

    const nearestTensor = detailOption.series.find((series: any) => series.id === 'tensors').data[2];
    const nearestGraphic = detailOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => entry * 100),
        value: (index: number) => index === 17 ? { ...nearestTensor[index] } : nearestTensor[index],
      },
    );
    expect(nearestGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rect',
        style: expect.objectContaining({ fill: 'rgba(211, 212, 220, 1)', opacity: 0.9, stroke: 'transparent' }),
      }),
    ]));

    const tiedTensor = detailOption.series.find((series: any) => series.id === 'tensors').data[3];
    const tiedGraphic = detailOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => entry * 100),
        value: (index: number) => index === 17 ? { ...tiedTensor[index] } : tiedTensor[index],
      },
    );
    expect(tiedGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rect',
        style: expect.objectContaining({ fill: 'rgba(211, 212, 220, 1)', opacity: 0.9, stroke: 'transparent' }),
      }),
    ]));

    const aboveTensor = getTensorRow('tensor-above-b');
    if (!aboveTensor) {
      throw new Error('Expected tied above tensor in Region 0 detail');
    }
    const aboveGraphic = detailOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => entry * 100),
        value: (index: number) => index === 17 ? { ...aboveTensor[index] } : aboveTensor[index],
      },
    );
    expect(aboveGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'rect',
        style: expect.objectContaining({ fill: 'rgba(211, 212, 220, 1)', opacity: 0.9, stroke: 'transparent' }),
      }),
    ]));

    const fartherSameMagicTensor = detailOption.series.find((series: any) => series.id === 'tensors').data[4];
    const fartherSameMagicGraphic = detailOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => entry * 100),
        value: (index: number) => index === 17 ? { ...fartherSameMagicTensor[index] } : fartherSameMagicTensor[index],
      },
    );
    const fartherSameMagicRects = fartherSameMagicGraphic.children.filter((child: any) => child.type === 'rect');
    expect(fartherSameMagicRects).toHaveLength(1);
    expect(fartherSameMagicRects[0].style).toMatchObject({ fill: 'rgb(255, 234, 225)', opacity: 0.8 });

    const unrelatedTensor = detailOption.series.find((series: any) => series.id === 'tensors').data[0];
    const unrelatedGraphic = detailOption.series[0].renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      { coord: (value: number[]) => value.map((entry) => entry * 100), value: (index: number) => unrelatedTensor[index] },
    );
    const unrelatedRects = unrelatedGraphic.children.filter((child: any) => child.type === 'rect');
    expect(unrelatedRects).toHaveLength(1);
    expect(unrelatedRects[0].style).toMatchObject({ fill: expect.stringMatching(/^rgb\(/), opacity: 0.8 });
    expect(unrelatedRects[0].style.fill).not.toBe(fartherSameMagicRects[0].style.fill);
    expect(unrelatedGraphic.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'text',
        style: expect.objectContaining({ fill: 'rgba(82, 82, 88, 0.65)', opacity: 0.45 }),
      }),
    ]));

    wrapper.unmount();
  });

  it('drills into a region, scopes search, renders address guides, and returns to overview', async () => {
    const wrapper = mountMemoryUsage();
    await settleMemoryView();

    const initialOption = testState.chart.setOption.mock.calls[0][0];
    initialOption.series.find((series: any) => series.id === 'region-axis-labels').renderItem(
      { coordSys: { x: 180, y: 20, width: 800, height: 940 }},
      {},
    );

    testState.zrHandlers.get('dblclick')?.({ offsetX: 135, offsetY: 500 });
    await nextTick();

    expect(wrapper.get('.region-detail-name').text()).toBe('Region ID: 0');
    expect(wrapper.get('.region-back-btn').attributes('aria-label')).toBe('Back to all regions');
    const detailOption = testState.chart.setOption.mock.calls.at(-1)[0];
    expect(detailOption.series.find((series: any) => series.id === 'tensors').data).toHaveLength(2);
    expect(detailOption.series.find((series: any) => series.id === 'region-axis-labels').data).toEqual([]);
    expect(detailOption.yAxis).toMatchObject({ min: 0, max: 1000, axisLabel: { show: true, color: 'transparent' }});
    expect(detailOption.yAxis.minInterval).toBeUndefined();
    expect(detailOption.yAxis.axisLabel.formatter(0)).toBe('1000');
    expect(detailOption.yAxis.axisLabel.formatter(500.5)).toBe('');
    expect(detailOption.yAxis.axisLabel.formatter(1000)).toBe('2000');
    const addressLabels = wrapper.findAll('.axis-address-label');
    expect(addressLabels).toHaveLength(9);
    const addressLabelTops = addressLabels.map((label) => Number.parseFloat(label.attributes('style').match(/top:\s*([^;]+)/)?.[1] || ''));
    const addressLabelGaps = addressLabelTops.slice(1).map((top, index) => Math.abs(top - addressLabelTops[index]));
    expect(addressLabelGaps.every((gap) => Math.abs(gap - addressLabelGaps[0]) < 0.001)).toBe(true);
    testState.zrHandlers.get('mousemove')?.({ offsetX: 100, offsetY: addressLabelTops[1] });
    await nextTick();
    expect(wrapper.get('.axis-address-tooltip').text()).toBe(addressLabels[1].text());
    testState.zrHandlers.get('mousemove')?.({ offsetX: 300, offsetY: 500 });
    await nextTick();
    expect(wrapper.find('.axis-address-tooltip').exists()).toBe(false);
    expect(testState.chart.dispatchAction).toHaveBeenCalledWith(expect.objectContaining({
      batch: expect.arrayContaining([expect.objectContaining({ dataZoomId: 'x-inside', startValue: 1, endValue: 11.5 })]),
    }));

    testState.server.GmMemoryVisualData.value = null;
    await settleMemoryView();
    expect(wrapper.get('.region-detail-name').text()).toBe('Region ID: 0');

    vi.useFakeTimers();
    await wrapper.get('input.search-input').setValue('magic');
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    expect(wrapper.get('.search-results-count').text()).toBe('1/2');

    const firstDetailRow = detailOption.series[0].data[0];
    const secondDetailRow = detailOption.series[0].data[1];
    testState.eventHandlers.get('mouseover')?.({ data: firstDetailRow });
    const hoverOption = testState.chart.setOption.mock.calls.at(-1)[0];
    const hoverChildren = hoverOption.graphic[0].children;
    expect(hoverChildren.filter((item: any) => item.type === 'line')).toHaveLength(2);
    expect(hoverChildren[0].style.lineDash).toEqual([6, 4]);

    testState.eventHandlers.get('mouseover')?.({ data: secondDetailRow });
    testState.eventHandlers.get('mouseout')?.({ data: firstDetailRow });
    const secondHoverOption = testState.chart.setOption.mock.calls.at(-1)[0];
    expect(secondHoverOption.graphic[0].children.filter((item: any) => item.type === 'line')).toHaveLength(2);

    testState.eventHandlers.get('mouseout')?.({ data: secondDetailRow });
    expect(testState.chart.setOption.mock.calls.at(-1)[0]).toEqual({
      graphic: [{ id: 'tensor-address-guide-2', $action: 'remove' }],
    });

    await wrapper.get('.region-back-btn').trigger('click');
    await nextTick();
    expect(wrapper.find('.region-detail-title').exists()).toBe(false);
    const overviewOption = testState.chart.setOption.mock.calls.at(-1)[0];
    expect(overviewOption.series.find((series: any) => series.id === 'tensors').data).toHaveLength(3);
    expect(overviewOption.yAxis.axisLabel.show).toBe(false);
    expect(overviewOption.yAxis.axisLabel.formatter).toBeUndefined();

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

  it('regenerates tensor colors when the theme changes', async () => {
    const theme = ref(true);
    const wrapper = mountMemoryUsage(true, theme);
    await settleMemoryView();

    const initialOption = testState.chart.setOption.mock.calls[0][0];
    const tensorSeries = initialOption.series.find((series: any) => series.id === 'tensors');
    const renderTensor = () => tensorSeries.renderItem(
      { coordSys: { height: 1000, width: 1000, x: 0, y: 0 }},
      {
        coord: (value: number[]) => value.map((entry) => entry * 100),
        value: (index: number) => tensorSeries.data[0][index],
      },
    );
    const darkFill = renderTensor().children.find((child: any) => child.type === 'rect').style.fill;

    theme.value = false;
    await nextTick();

    const lightFill = renderTensor().children.find((child: any) => child.type === 'rect').style.fill;
    expect(lightFill).not.toBe(darkFill);

    wrapper.unmount();
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
