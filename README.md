# PyPTO Toolkit 插件

简体中文 | [English](https://gitcode.com/cann/pypto-vscode/blob/master/README_en.md)

PyPTO Toolkit是一款PyPTO框架全流程辅助工具，提供包括编译、运行时状态的可视化、算子开发作业流的作业能力，使能开发者快速建立对PyPTO框架的理解，提升算子开发和调试调优效率。

详细使用说明请参考 [PyPTO Toolkit文档中心](https://pypto-tools.gitcode.com/)

## 核心特性

- **控制流可视：** 将基于PyPTO框架表达的计算逻辑可视化，提供计算逻辑表达代码、控制流图及计算图的映射关系视图。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/openControlFlow.gif)

- **计算图：** 基于Tensor和Operation的基础图结构，提供原始计算图到可执行图编译过程的全流程可视化展示能力。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/openCom.gif)

- **泳道图：** 提供核间、核内流水和统计信息的可视化展示，支持任务的依赖关系分析和多种维度(整体、单任务和框选范围内)的统计报告信息展示。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/openSwimGraph.gif)

- **三栏联动视图：** 支持算子代码-计算图-泳道图之间的实时联动，降低使用PyPTO框架调试调优的门槛，提升一站式的调试调优效率。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeView.gif)

- **精度报告：** 若当前数据有精度异常，可在控制流或计算图中打开精度报告，下图示意从控制流打开精度报告

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/accuracy_zh.gif)

## 新增特性

- **端到端泳道图：** 支持在同一个视图内同时展示 AICPU 和 Kernel 节点，帮助开发者快速定位性能瓶颈，高效调优。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/deviceView_zh.gif)

- **GM内存可视化：** 可直观的显示Tensor冲突的大概位置，并且支持通过ctrl+鼠标滚轮缩放时间轴，alt+鼠标滚轮缩放纵轴来快速定位到具体冲突位置，并且支持点击单个Tensor查看其详细信息。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/memory-usage.gif)

## 贡献指南

如需贡献代码，请参考 [贡献指南](https://gitcode.com/cann/pypto-vscode/blob/master/CONTRIBUTING.md)

## 安全声明和免责声明

如您安装了本插件，代表您已同意 [安全声明](https://gitcode.com/cann/pypto-vscode/blob/master/SECURITY.md) 和 [免责声明](https://gitcode.com/cann/pypto-vscode/blob/master/desclaimer.md)

## 许可证

本项目使用 Apache 2.0 许可证，如需查看详细信息请查阅 [许可证](https://gitcode.com/cann/pypto-vscode/blob/master/LICENSE)