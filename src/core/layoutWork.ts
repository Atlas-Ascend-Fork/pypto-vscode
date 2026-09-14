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

