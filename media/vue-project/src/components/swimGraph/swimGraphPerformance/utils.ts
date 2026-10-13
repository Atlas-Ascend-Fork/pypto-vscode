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
export const executionTimeData = {
    ticksMap: new Map(),
    timelineGroupsMap: new Map(),
    echartsMap: new Map(),
    tableData: []
  };
  export const US_TO_MS_THRESHOLD = 1000;
  export const US_TO_S_THRESHOLD = 1000000;
  export const UNIT_US = '\u03BCs';
  export const UNIT_MS = 'ms';
  export const UNIT_S = 's';
  export const formatTimeUnit = (valueInUs) => {
    if (!valueInUs) return UNIT_US;
    if (valueInUs >= US_TO_S_THRESHOLD) return UNIT_S;
    if (valueInUs >= US_TO_MS_THRESHOLD) return UNIT_MS;
    return UNIT_US;
  };
  
  export const formatTimeValue = (valueInUs) => {
    if (!valueInUs) return 0;
    if (valueInUs >= US_TO_S_THRESHOLD) {
      return parseFloat((valueInUs / US_TO_S_THRESHOLD).toFixed(3));
    }
    if (valueInUs >= US_TO_MS_THRESHOLD) {
      return parseFloat((valueInUs / US_TO_MS_THRESHOLD).toFixed(3));
    }
    return valueInUs;
  };