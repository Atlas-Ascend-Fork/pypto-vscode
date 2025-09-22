import ElkConstructor from "elkjs";

function calculateLayout(graphData) {
    const elkFactory = new ElkConstructor({
        algorithms: ['layered'],
    });
    elkFactory.layout(graphData).then((result) => {
      if (process.send) {
        process.send({
          type: 'result',
          data: result
        });
      }
    });
}

// 监听主进程发送的消息
process.on('message', (data: any) => {
  if (data.type === 'layout') {
    const { graphData } = data;
    
    // 执行计算
    calculateLayout(graphData);
  }
});