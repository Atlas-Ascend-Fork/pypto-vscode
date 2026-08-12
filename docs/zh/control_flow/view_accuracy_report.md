# 查看精度执行报告

## 功能说明

打开控制流图后，若文件有精度执行结果数据，可在导入成功后查看精度执行报告

## 前提条件

文件有精度执行结果数据。详细请参见[数据准备](https://gitcode.com/cann/pypto/blob/master/docs/zh/tutorials/debug/precision.md)。

## 操作步骤

1.  在运行结果界面中，单击“结果总览”，打开控制流图。程序自动导入精度执行结果数据，导入成功后右上角显示`打开精度执行报告`按钮。

    **图 1**  `打开精度执行报告`按钮
    ![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/accuracyEntryContrlFlow.png)

2.  查看精度执行报告及精度pass分布列表
    - 单击页面右上角`打开精度执行报告`按钮，右侧弹出精度执行报告页面。

        精度pass分布总览列表通过数字标号颜色区分校验结果状态（详见表1）。

        **表 1** 列表颜色状态说明
        |颜色|状态|
        |--|--|
        |绿色|精度校验成功|
        |红色|精度校验失败|
        |黄色|精度校验异常|
    - 鼠标点击精度校验结果的`FAIL`卡片,将高亮卡片并显示对应状态的精度pass分布列表，再次点击卡片将取消选中。

        **图 2**  查看精度执行报告  
        ![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/accuracyContrlFlow.png)

3.  查看精度pass对应的PATH节点
    
    - 鼠标点击精度pass分布列表中状态为FAIL的节点，将高亮对应PATH并聚焦首错PATH，点击`取消选择`或再次点击卡片将取消选中。

    - 点击`首错PATH`标签将跳转对应计算图。(计算图精度报告操作详见[操作文档](../computation_graph/view_accuracy_report.md))

        **图 3**  查看精度pass对应的PATH节点
        ![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/accuracyFirstError.png)

4.  PATH节点-所有计算图查看pass精度执行结果

    点击PATH节点右上角图标，在右侧弹窗中查看`所有计算图`，列表以颜色区分pass执行结果（同表1）。点击跳转对应计算图。(计算图精度报告操作详见详见[操作文档](../computation_graph/view_accuracy_report.md))

    **图 4**  查看`所有计算图`
    ![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/accuracyAllCom.png)

