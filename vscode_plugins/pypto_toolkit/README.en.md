# PyPTO Toolkit Plugin User Guide

PyPTO Toolkit is a PyPTO framework full process auxiliary tool that provides visualization of compilation, runtime status, and operator development workflow capabilities, enabling developers to quickly establish an understanding of the PyPTO framework and improve operator development and debugging optimization efficiency.

## Key Features

-**Control flow visualization:** Visualize the computational logic expressed based on the PyPTO framework, providing a mapping relationship view of the computational logic expression code, control flow diagram, and computational diagram.

-**Computation Graph:** Based on the basic graph structure of Tensor and Operation, it provides the ability to visualize the entire process from the original computational graph to the executable graph compilation process.

-**Swimlane Diagram:** Provides visual display of inter core, intra core flow, and statistical information, supporting dependency analysis of tasks and display of statistical report information from multiple dimensions (overall, single task, and box selection range).

-**Three column linkage view:** Supports real-time linkage between operator code, computation graph, and swimlane diagram, reducing the threshold for debugging and tuning using PyPTO framework and improving one-stop debugging and tuning efficiency.

## Compilation Result

- **Check compilation result**

    Click the icon in the VS Code sidebar, if the icon is not displayed, right-click in the sidebar and check `PyPTO Toolkit`.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20openSidebar.gif)

- **Search from compilation result**

    The output file name is in the format of `Run Type + Execution Date + Execution Time`.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20sidebarSearch.gif)

## Control Flow

- **Open result overview**

    Select any result directory, expand it, and click `Result Overview`.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20openControlFlow.gif)

- **Search for nodes**

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20controlFlowSearch.gif)

- **Check PATH node detail**

    Click the icon in the upper right corner of the PATH card to view details.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20controlFlowOpenPathDrawer.gif)

## Computation Graph

- **Open Computation Graph**

    Right-click on the computation graph json file and select `PyPTO Toolkit: Open file`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/openCom.gif)

- **View Computation Graph**

    Support page dragging, thumbnail viewing, zooming to view nodes, and clicking to view node details

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/optCom.gif)
  
- **Node Search**

    Enter directly and press Enter, or click the search button for fuzzy search; click the search box to select the corresponding category for category search. Click on nodes to view json data details. Select full graph search to search content in other functions within the json

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comSearch.gif)

- **Subgraph Navigation**

    Double-click on call nodes to navigate to subgraphs. Call nodes are identified by an FX icon in the bottom right corner

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comToSubgraph.gif)

- **Health Report**

    Click the health report button in the upper right corner to search for the health report related json corresponding to the current file and display its content. You can quickly locate related nodes through the health report

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/healthReport.gif)
  
- **Layer Control**

    The button in the top right corner can open the layer control panel, which supports changing the layout direction and adjusting the node display mode

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comGraphSetting.gif)

- **Link Locking**

    After selecting a node, you can right-click to lock or display only the links related to that node

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/lockPath.gif)

- **Comparison Mode Activation**

    Right-click the calculation graph file and select "Open Calculation Graph Difference Comparison Using PyPTO Toolkit" to open it. It will automatically select the associated comparison file in the same folder. If it is not found, you can manually select the file path for the comparison.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comgraphDiff.gif)

- **Local Search**

    When the number of open file nodes exceeds 10000, you can choose to render all nodes or search for a specific node and render its related linked. It is recommended to use this feature as needed when file size is too large.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.12localSearch.gif)

## Swimlane Diagram

- **Open Swimlane Diagram**

    Right-click on the swimlane diagram json file and select `PyPTO Toolkit: Open file`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/swimOpen.gif)
  
- **View Node Details**

    Click on the node to view its details in the lower panel

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/swimNodeDetail.gif)

- **Node Search**

    Inputting the node name in the search box allows for a fuzzy search of the node

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/swimSearch.gif)

- **Jump to Computation Graph**

    Support jumping to computation graph based on `rootHash` and `leafHash`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/swimToCom.gif)

- **Add observation line**

    Clicking on the second axis can add observation lines, and clicking on an observation line can delete or modify it

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/addFlag.gif)

- **PMU performance panel**

    Click the report button in the upper left corner to view the PMU performance.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/pmu.gif)

- **Core utilization statistics**

    Click the metric mode button in the upper left corner, or use the mouse to select nodes to view core utilization statistics.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/coreUti.gif)

- **Shortcut Key List**

  | Shortcut | Function Description |
  | --- | --- |
  | Mouse Wheel | **Vertical** movement |
  | Left Mouse Button + CTRL | **Horizontal** movement |
  | Mouse Wheel + CTRL | Zoom |
  | Left Mouse Button + ALT | Manual distance measurement |
  | w / s (configurable in settings page) | Zoom in / Zoom out |
  | a / d (configurable in settings page) | Horizontal movement |

## Three-Panel Linked View

The three-panel linked view simultaneously displays code, a computational graph, and a swimlane diagram within a single page. These three panels are linked through semantic tags, allowing users to click on any panel to synchronously highlight corresponding content across all three views. This helps developers quickly understand the entire process—from the code implementation, to its representation in the computational graph, and finally to its performance characteristics as shown in the on-board swimlane diagram.

- **Opening the Three-Panel Linked View**

  Right-click on a C++ or Python file and select "PyPTO Toolkit: Open linkage mode" to open the three-panel linked view.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeView.gif)

- **Lock Mode**

  Click the lock button in any of the three panels to enable Lock Mode. In this mode, the highlighting state remains fixed and will not change. To exit Lock Mode, click the unlock button in any panel.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeViewLock.gif)

## Other Helper Features

- **Close all pages opened by PyPTO Toolkit**

  When you have multiple pages open, you can use the `PyPTO Toolkit: Close all tool page` menu to instantly close all pages opened by the plugin.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.3%20allTabsOneClose.gif)

## Feedback Channel

  If you have any questions or suggestions, please submit an issue:[https://gitcode.com/sunmaxwell/pypto-toolkit/issues](https://gitcode.com/sunmaxwell/pypto-toolkit/issues)
