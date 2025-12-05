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

