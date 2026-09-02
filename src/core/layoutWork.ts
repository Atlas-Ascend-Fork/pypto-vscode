/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import ElkConstructor from "elkjs";

function calculateLayout(graphData) {
  new ElkConstructor().layout(graphData)
    .then(result => {
      if (process.send) {
        process.send({ type: 'result', data: result });
      }
    })
    .catch(error => {
      if (process.send) {
        process.send({
          type: 'error',
          message: 'ELK 布局计算失败',
          data: error.message || error
        });
      }
    });
}

// 监听主进程发送的消息
process.on('message', (data: { type?: any; graphData?: any; }) => {
  if (data.type === 'layout') {
    const { graphData } = data;

    // 执行计算
    calculateLayout(graphData);
  }
});

