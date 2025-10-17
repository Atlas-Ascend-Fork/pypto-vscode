# PyPTO Toolkit Plugin User Guide

## Swimlane Diagram

  - **Open Swimlane Diagram**

    Right-click on the swimlane diagram json file and select `PyPTO Toolkit: Open file`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.11%20swimOpen.gif)
  
  - **View Node Details**

    Click on the node to view its details in the lower panel

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20swimNodeDetail.gif)

  - **Node Search**

    Inputting the node name in the search box allows for a fuzzy search of the node

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20swimSearch.gif)

  - **Jump to Computation Graph**

    Support jumping to computation graph based on `rootHash` and `leafHash`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20swimToCom.gif)

  - **Jump to Dump Tensor**

    Support viewing dump tensor based on `rawmagic`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20swimToDumpTensor.gif)

  - **Add observation line**

    Clicking on the second axis can add observation lines, and clicking on an observation line can delete or modify it

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20addFlag.gif)

  - **Shortcut Key List**

    | Shortcut | Function Description |
    | --- | --- |
    | Mouse Wheel | **Vertical** movement |
    | Left Mouse Button + CTRL | **Horizontal** movement |
    | Mouse Wheel + CTRL | Zoom |
    | Left Mouse Button + ALT | Manual distance measurement |
    | w / s (configurable in settings page) | Zoom in / Zoom out |
    | a / d (configurable in settings page) | Horizontal movement |

## Computation Graph

  - **Open Computation Graph**

    Right-click on the computation graph json file and select `PyPTO Toolkit: Open file`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20openCom.gif)

  - **View Computation Graph**

    Support page dragging, thumbnail viewing, zooming to view nodes, and clicking to view node details

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20optCom.gif)
  
  - **Node Search**

    Enter directly and press Enter, or click the search button for fuzzy search; click the search box to select the corresponding category for category search. Click on nodes to view json data details. Select full graph search to search content in other functions within the json

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20comSearch.gif)
 
  - **Subgraph Navigation**

    Double-click on call nodes to navigate to subgraphs. Call nodes are identified by an FX icon in the bottom right corner

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20comToSubgraph.gif)    

  - **Health Report**

    Click the health report button in the upper right corner to search for the health report related json corresponding to the current file and display its content. You can quickly locate related nodes through the health report

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20comHealthReport.gif)
  
  - **Layer Control**

    The button in the top right corner can open the layer control panel, which supports changing the layout direction and adjusting the node display mode

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/comgraphSetting.gif)

  - **Link Locking**

    After selecting a node, you can right-click to lock or display only the links related to that node

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/lockPath.gif)

  - **Comparison Mode Activation**

    Right-click the calculation graph file and select "Open Calculation Graph Difference Comparison Using PyPTO Toolkit" to open it. It will automatically select the associated comparison file in the same folder. If it is not found, you can manually select the file path for the comparison.
    
    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/comgraphDiff.gif)

## Feedback Channel

  If you have any questions or suggestions, please provide feedback in the user support group. Group ID: 866394745314853397