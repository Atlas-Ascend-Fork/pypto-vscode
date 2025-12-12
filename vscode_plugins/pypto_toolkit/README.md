# PyPTO Toolkit 插件使用说明

## 历史运行结果

  - **查看历史运行结果**

    点击VS Code侧边栏PyPTO图标，未显示图标可在侧边栏点击右键，勾选 `PyPTO Toolkit`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20openSidebar.gif)

  - **搜索运行结果**

    运行结果名称为 `执行方式 + 执行日期 + 执行时间`，可根据需要自行搜索

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20sidebarSearch.gif)

## 结果总览

  - **打开结果总览**

    选择任意运行结果目录，展开后点击 `结果总览`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20openControlFlow.gif)

  - **搜索节点**

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20controlFlowSearch.gif)

  - **查看PATH详情**

    点击PATH卡片右上角图标查看详情

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20controlFlowOpenPathDrawer.gif)

## 泳道图

  - **打开泳道图**

    在泳道图 json 文件上右键选择`PyPTO Toolkit: 打开文件`即可打开

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.11%20swimOpen.gif)
  
  - **查看节点详情**

    点击节点可以在下方面板查看节点详情

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20swimNodeDetail.gif)

  - **节点搜索**

    在搜索框输入节点名称可以模糊搜索节点

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20swimSearch.gif)

  - **跳转计算图**

    支持根据`rootHash`和`leafHash`跳转至计算图

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20swimToCom.gif)

  - **跳转dump tensor**

    支持根据`rawmagic`查看dump tensor

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20swimToDumpTensor.gif)

  - **添加观测线**

    在二段轴上点击可以添加观测线，点击观测线可以删除或修改

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20addFlag.gif)

  - **PMU性能看板**

    点击左上角的报告按钮，即可查看PMU性能

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.12pmu.gif)

  - **核利用率统计**

    点击左上角的度量模式按钮，或者鼠标框选节点，可查看核利用率统计信息

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.12coreUti.gif)

  - **快捷键列表**

    | 快捷键 | 功能描述 |
    | --- | --- |
    | 鼠标滚轮 | **纵向**移动 |
    | 鼠标左键 + CTRL | **横向**移动 |
    | 鼠标滚轮 + CTRL | 缩放 |
    | 鼠标左键 + ALT | 手动测距 |
    | w / s（支持在配置页面配置） | 放大 / 缩小 |
    | a / d（支持在配置页面配置） | 横向移动 |

## 计算图

  - **打开计算图**

    在计算图 json 文件上右键选择`PyPTO Toolkit: 打开文件`即可

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20openCom.gif)

  - **查看计算图**

    支持页面拖拽查看、缩略图中查看，以及缩放查看节点、点击查看节点详情

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20optCom.gif)
  
  - **节点搜索**

    直接输入并回车，或者点击搜索按钮，可进行模糊搜索；点击搜索框选择相应分类，可进行分类搜索，节点点击可以查看json数据详情选择整图搜索，可搜索json内其他function中内容

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20comSearch.gif)
 
  - **子图跳转**

    双击call节点可进行子图跳转，call节点右下角有FX图标标识

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20comToSubgraph.gif)    

  - **健康报告**

    点击右上角健康报告按钮，会搜索当前文件对应的健康报告相关json，并展示其内容，可通过健康报告快速定位相关节点

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.8%20comHealthReport.gif)

  - **图层控制**

    右上角按钮可以开启图层控制面板，支持更改布局方向，更改节点显示模式

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/comgraphSetting.gif)

  - **链路锁定**

    选中节点后，右键可以锁定或仅显示该节点相关链路

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/lockPath.gif)

    **对比图开启**

    右键计算图文件，选择 “使用PyPTO Toolkit打开计算图差异对比” 打开，会自动选择同文件夹下的关联对比文件，如果未找到，可以自行选择需要对比的文件路径
    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/comgraphDiff.gif)

  - **局部搜索**

    打开文件节点数超过1万时，允许选择全量渲染或者搜索某个节点，渲染其相关链路，建议在文件过大时按需使用

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/0.1.12localSearch.gif)

## 三栏联动视图

三栏联动视图指的是在一个页面视图里同时展示代码、计算图和泳道图，三者通过语义标签关联，可以通过在任一视图点击，联动高亮显示三栏视图的对应内容，帮助开发者快速理解从代码实现到对应的计算图表达，再到上板泳道图最终的性能表现的整个过程。

  - **打开三栏联动视图**

  在 cpp/python 文件右键，选择 “PyPTO Toolkit: 开启联动模式” 即可打开三栏联动视图

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeView.gif)

  - **锁定模式**

  在三栏视图中的任一视图点击锁定按钮，即可开启锁定模式，在该模式下，高亮效果不会改变。在任一视图点击解锁按钮，即可退出该模式。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeViewLock.gif)

## 一键关闭所有插件的页面

![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.3%20allTabsOneClose.gif)

## 反馈渠道

  如有任何问题和建议，请在用户支撑群反馈，群号：866394745314853397