# PyPTO Toolkit Plugin

English | [简体中文](https://gitcode.com/cann/pypto-vscode/blob/master/README.md)

PyPTO Toolkit is a full-process auxiliary tool for the PyPTO framework. It provides visualization of compilation and runtime status, along with operator development workflow capabilities, enabling developers to quickly build an understanding of the PyPTO framework and improve operator development, debugging, and tuning efficiency.

For detailed usage instructions, please refer to the [PyPTO Toolkit Documentation Center](https://pypto-tools.gitcode.com/)

## Core Features

- **Control Flow Visualization:** Visualizes the computational logic expressed based on the PyPTO framework, providing a mapping relationship view of the computational logic expression code, control flow graph, and computation graph.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/openControlFlow.gif)

- **Computation Graph:** Based on the fundamental graph structure of Tensor and Operation, it provides full-process visualization from the original computation graph to the executable graph compilation.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/openCom.gif)

- **Swimlane Diagram:** Provides visual display of inter-core and intra-core pipelines along with statistical information, supporting task dependency analysis and multi-dimensional (overall, single task, and selected range) statistical report display.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/openSwimGraph_en.gif)

- **Three-Panel Linked View:** Supports real-time linkage among operator code, computation graph, and swimlane diagram, lowering the barrier for debugging and tuning with the PyPTO framework and improving one-stop debugging and tuning efficiency.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/threeView_en.gif)

- **Accuracy Report:** If the current data contains accuracy anomalies, you can open the accuracy report from the control flow or computation graph. The figure below illustrates opening the accuracy report from the control flow.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/accuracyFromContrl.gif)

## New Features

- **End-to-End Swimlane Diagram:** Supports displaying AICPU and Kernel nodes simultaneously within the same view, helping developers quickly locate performance bottlenecks and tune efficiently.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/deviceView.gif)

- **GM Memory Visualization:** Intuitively displays the approximate locations of Tensor conflicts. It supports zooming the time axis via Ctrl + mouse wheel and zooming the vertical axis via Alt + mouse wheel to quickly locate specific conflict positions. Clicking on a single Tensor displays its detailed information.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/memory-usage.gif)

## Contributing

To contribute code, please refer to the [Contributing Guide](https://gitcode.com/cann/pypto-vscode/blob/master/CONTRIBUTING_en.md)

## Security Statement and Disclaimer

By installing this plugin, you agree to the [Security Statement](https://gitcode.com/cann/pypto-vscode/blob/master/SECURITY_en.md) and [Disclaimer](https://gitcode.com/cann/pypto-vscode/blob/master/desclaimer_en.md)

## License

This project uses the CANN 2.0 license. For details, please refer to the [License](https://gitcode.com/cann/pypto-vscode/blob/master/LICENSE)