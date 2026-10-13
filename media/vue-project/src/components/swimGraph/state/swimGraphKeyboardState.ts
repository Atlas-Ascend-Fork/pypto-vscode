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
import { ref, reactive } from 'vue';
import { Animation } from '../swimGraphProcesses/animation';

export const Zoom = {
  None: 0,
  In: 1,
  Out: -1,
};

export const Pan = {
  None: 0,
  Left: -1,
  Right: 1,
};

export const keyboardState = reactive({
  zooming: Zoom.None,
  panning: Pan.None,
  keyInterval: null as ReturnType<typeof setInterval> | null,
  keyTimeOut: null as ReturnType<typeof setTimeout> | null,
  scaleStep: 0.1,
  moveStep: 30,
  activeHandleKeyDown: null as ((e: KeyboardEvent) => void) | null,
  zoomAnimation: null as Animation | null,
  panAnimation: null as Animation | null,
});

export const isKeyPressed = ref(false);
