# PMU Trace 泳道图

## 功能说明

PMU Trace 用于核内流水分析，是算子深度性能调优的重要工具。开启该能力后，开发者可以直观地观察 kernel 在 AI Core 上执行时，各硬件流水线（如 MTE2、MTE3、Vector、Cube 等）的时序排布与重叠情况。通过分析流水排布，可以识别搬运与计算之间的空闲等待、判断各流水线的利用率是否充分，从而有针对性地调整 Tiling 配置或计算编排策略，提升算子性能。

## 前提条件

采集好 PMU Trace 数据，参考 [PMU Trace 采集](https://pypto.gitcode.com/tutorials/debug/performance.html#pmu-trace)

## 操作步骤

1. 打开泳道图文件。以下提供两种方式：

    -  在Visual Studio Code侧边栏，单击![](../../figures/zh-cn_image_0000002491265870.png)图标，打开PyPTO Toolkit，在运行结果界面打开泳道图文件。

    -  在Visual Studio Code工作区，右键单击泳道图文件，在弹出的菜单中选择"PyPTO Toolkit：打开文件"。

2. 展开 Biu Perf，即可查看核内流水

    ![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/msprof.png)