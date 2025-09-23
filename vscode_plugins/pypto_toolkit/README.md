# PyPTO Toolkit 插件使用说明

## 泳道图

  - **打开泳道图**

    在泳道图 json 文件上右键选择`使用PyPTO Toolkit打开`即可打开

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20openSwim.gif)
  
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

    在计算图 json 文件上右键选择`使用PyPTO Toolkit打开`即可

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

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20comLayerConfig.gif)

  - **链路锁定**

    选中节点后，右键可以锁定或仅显示该节点相关链路

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images0.10/0.1.10%20comLockChain.gif)

## 反馈渠道

  如有任何问题和建议，请在用户支撑群反馈，群号：866394745314853397