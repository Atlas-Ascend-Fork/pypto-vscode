<!--
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
 -->
<template>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    :width="width" 
    :height="height" 
    viewBox="0 0 32 32"
    v-bind="$attrs"
  >
    <g fill="currentColor">
      <path
        d="M7.417 16.944a1 1 0 0 1 0-1.387l5.113-5.313c.624-.649 1.72-.207 1.72.693V14c0 .138.112.25.25.25h9.75a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H14.5a.25.25 0 0 0-.25.25v3.063c0 .9-1.096 1.342-1.72.693z"
      />
      <path
        d="M6 1a5 5 0 0 0-5 5v20a5 5 0 0 0 5 5h20a5 5 0 0 0 5-5V6a5 5 0 0 0-5-5zM3 6a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"
      />
    </g>
  </svg>
</template>

<script>
export default {
  name: 'ArrowIcon',
  inheritAttrs: false,
  props: {
    width: {
      type: [String, Number],
      default: 32
    },
    height: {
      type: [String, Number],
      default: 32
    }
  }
}
</script>