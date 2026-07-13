<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<template>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g v-if="direction === 'default'" clip-path="url(#clip0_3_5)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8.59023 14.5775L12.416 10.1141C12.972 9.46547 12.5111 8.46335 11.6567 8.46335H4.00519C3.15084 8.46335 2.68993 9.46547 3.24594 10.1141L7.07172 14.5775C7.47081 15.0432 8.19114 15.0432 8.59023 14.5775ZM11.6567 9.46335L7.83097 13.9268L4.00519 9.46335H11.6567Z"
        fill="var(--devui-overlay-icon)"
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8.59023 1.34921L12.416 5.81262C12.972 6.46129 12.5111 7.46341 11.6567 7.46341H4.00519C3.15084 7.46341 2.68993 6.46129 3.24594 5.81262L7.07172 1.34921C7.47081 0.883597 8.19114 0.883597 8.59023 1.34921ZM11.6567 6.46341L7.83097 2L4.00519 6.46341H11.6567Z"
        fill="var(--devui-overlay-icon)"
      />
    </g>
    <g v-if="direction === 'asc'" clip-path="url(#clip0_3_5)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8.59022 14.5775L12.416 10.1141C12.972 9.46547 12.5111 8.46335 11.6567 8.46335H4.00518C3.15083 8.46335 2.68992 9.46547 3.24593 10.1141L7.07171 14.5775C7.4708 15.0432 8.19113 15.0432 8.59022 14.5775ZM11.6567 9.46335L7.83096 13.9268L4.00518 9.46335H11.6567ZM12.4164 5.81416L8.59029 1.34936C8.19119 0.883557 7.47074 0.883557 7.07163 1.34936L3.24553 5.81416C2.68963 6.46281 3.15056 7.46482 4.00486 7.46482H11.6571C12.5114 7.46482 12.9723 6.46281 12.4164 5.81416Z"
        fill="#B3B3B3"
      />
    </g>
    <g v-if="direction === 'desc'" clip-path="url(#clip0_3_5)">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8.59022 1.34921L12.416 5.81262C12.972 6.46129 12.5111 7.46341 11.6567 7.46341H4.00518C3.15083 7.46341 2.68992 6.46129 3.24593 5.81262L7.07171 1.34921C7.4708 0.883597 8.19113 0.883597 8.59022 1.34921ZM11.6567 6.46341L7.83096 2L4.00518 6.46341H11.6567ZM12.4164 10.1126L8.59029 14.5774C8.19119 15.0432 7.47074 15.0432 7.07163 14.5774L3.24553 10.1126C2.68963 9.46395 3.15056 8.46194 4.00486 8.46194H11.6571C12.5114 8.46194 12.9723 9.46395 12.4164 10.1126Z"
        fill="var(--devui-overlay-icon)"
      />
    </g>
    <defs>
      <clipPath id="clip0_3_5">
        <rect width="16" height="16" fill="white" />
      </clipPath>
    </defs>
  </svg>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import type { SortDirection } from '../type';

defineProps({ direction: { type: String as PropType<SortDirection>, default: 'default' } });
</script>

<style scoped lang="scss">
svg {
  cursor: pointer;
}
</style>
