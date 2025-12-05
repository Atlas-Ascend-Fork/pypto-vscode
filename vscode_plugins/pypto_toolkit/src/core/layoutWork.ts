// ../core/layoutWork.js 子线程代码
const ELK = require('elkjs');

function calculateLayout(graphData) {
  const timeoutMs = 30_000; // 30秒超时
  const layoutPromise = new ELK().layout(graphData);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('ELK layout timeout')), timeoutMs)
  );
  
  Promise.race([layoutPromise, timeoutPromise])
    .then(result => {
      if (process.send) {
        process.send({ type: 'result', data: result });
      }
    })
    .catch(error => {
      if (process.send) {
        process.send({
          type: 'error',
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

// 添加对进程错误的监听，防止进程崩溃
process.on('uncaughtException', (error) => {
  if (process.send) {
    process.send({
      type: 'error',
      message: '未捕获的异常',
      data: error.message || error
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  if (process.send) {
    process.send({
      type: 'error',
      message: '未处理的Promise拒绝',
      data: reason
    });
  }
});