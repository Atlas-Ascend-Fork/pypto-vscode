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
import { provide, reactive, ref, toRef } from 'vue';

export function createMemoryUsageChildContextMap() {
  return reactive({
    threadEvent: {
      eraseEventLine() {},
      drawEventLine() {},
      getOffset(deltaX: number, scale: number) {
        return deltaX / scale;
      },
      drawTransformEvent() {},
      renderProcessText() {},
      renderProcessPinEvents() {},
      fillTextInfo() {},
      changeNodeColor() {},
      canvasStatusReset() {},
      drawEventThread() {},
      showTooltip() {},
      renderThreadText() {},
      drawNodeHeight() {},
    },
    processHeaderEvent: {
      eraseProcessHeadLine() {},
      drawProcessHeadLine() {},
    },
    process: {
      measureMaskHandleWheel() {},
    },
  });
}

export function provideMemoryUsageSwimGraph({ props, state, methods }: any) {
  provide('swimGraphCfg', { userConfig: reactive(new Map()) });
  provide('swimGraphPinnedState', {
    pinnedThreadsList: ref([]),
    recalculateOffsetY: () => {},
  });
  provide('swimGraphState', {
    ...state,
    isThreeColumn: toRef(props, 'isThreeColumn'),
    freezeVisibleRange: ref(false),
  });
  provide('swimGraphMethods', {
    postMessage: methods.postMessage,
    render: () => {},
    renderFixedTimeline: methods.renderFixedTimeline,
    renderTimeline: methods.renderTimeline,
    calculateGridInterval: methods.calculateGridInterval,
    selectEvent: (event: any) => {
      methods.selectedNode.value = event;
    },
    timeToX: methods.timeToX,
    xToTime: methods.xToTime,
    transform: methods.transform,
    getDisplayName: (val: any) => val,
    resetState: () => {
      methods.viewState.scale = 1;
      methods.viewState.offsetX = 0;
      methods.transform();
    },
    resetMaxScheduleState: () => {},
    resetsearchState: () => {},
    clearHeadState: () => {},
    getTimelineCanvas: () => methods.timelineComponent.value?.timelineCanvas,
    handleWheel: (e: any) => {
      methods.timelineComponent.value?.handleWheel(e);
    },
    flagRender: () => {
      methods.timelineComponent.value?.flagRender();
    },
    changeScale: (zoomFactor: number, centerPositionX: number, needRender = true, isManual = true) => {
      methods.timelineComponent.value?.changeScale(zoomFactor, centerPositionX, needRender, isManual);
    },
    pinnedDrawLine: () => {},
    pinnedEraseLine: () => {},
    drawFixedTimelineSlider: methods.drawFixedTimelineSlider,
  });
}
