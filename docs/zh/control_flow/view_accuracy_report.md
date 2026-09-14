# 查看精度执行报告

## 功能说明

打开控制流图后，若文件有精度执行结果数据，可在导入成功后查看精度执行报告

## 前提条件

文件有精度执行结果数据。详细请参见[数据准备](https://gitcode.com/cann/pypto/blob/master/docs/zh/guide/programming_guide/tensor/debug/precision.md)。

## 操作步骤

1. 在运行结果界面中，单击“结果总览”，打开控制流图。程序自动导入精度执行结果数据，导入成功后右上角显示`打开精度执行报告`按钮。若文件无精度执行结果数据，该按钮不显示。

   **图 1**  `打开精度执行报告`按钮
   ![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/accuracyEntryContrlFlow.png)
2. 查看精度执行报告及精度pass分布列表
   - 单击页面右上角`打开精度执行报告`按钮，右侧弹出精度执行报告页面。

     精度校验结果区域展示 4 张状态卡片：`PASS`（精度校验成功）、`FAIL`（精度校验失败）、`EXCEPTION`（精度校验异常）、`SKIP`（跳过校验），每张卡片右上角带有帮助图标，鼠标悬停可查看状态说明。卡片下方为精度pass分布总览列表，通过数字标号颜色区分校验结果状态（详见表1），并通过标签标识首错（`First Fail`）与首异常（`First Exc`）：首个精度校验失败的pass显示`First Fail`标签，首个精度校验异常的pass显示`First Exc`标签；同时存在失败与异常的pass若非首个，则以`Fail`、`Exc`简写标识。

     **表 1** 列表颜色状态说明
     | 颜色 | 状态     |
     | -- | ------ |
     | 绿色 | 精度校验成功 |
     | 橙色 | 精度校验失败 |
     | 红色 | 精度校验异常 |
     | 灰色 | 跳过校验 |
   - 鼠标点击任一状态卡片，将高亮该卡片并过滤精度pass分布列表，仅显示对应状态的pass；再次点击该卡片取消选中并恢复显示全部pass。切换卡片时，若已选中某pass，对应PATH节点的高亮边框颜色会同步更新：`FAIL`优先时重合节点显橙色，否则显红色。

     **图 2**  查看精度执行报告\
     ![](../figures/accuracy_1.png)
3. 查看精度pass对应的PATH节点
   - 鼠标点击精度pass分布列表中状态为`FAIL`或`EXCEPTION`的节点（`PASS`、`SKIP`节点不可点击），将高亮对应PATH并自动聚焦标签节点：优先聚焦同时为首错（`First Fail`）与首异常（`First Exc`）的节点，其次聚焦首异常PATH节点，再次聚焦首错PATH节点。点击`取消选择`或再次点击同一列表项将取消选中。
   - 首错PATH节点显示橙色`First Fail`标签，首异常PATH节点显示红色`First Exc`标签；同一节点同时为首错与首异常时，两个标签上下排列显示。
   - 点击节点上的`First Fail`或`First Exc`标签，将跳转对应计算图。(计算图精度报告操作详见[操作文档](../computation_graph/view_accuracy_report.md))

     **图 3**  查看精度pass对应的PATH节点
     ![](../figures/accuracy_2.png)
4. PATH节点-所有计算图查看pass精度执行结果

   点击PATH节点右上角图标，右侧弹出抽屉（打开抽屉时精度执行报告将自动关闭）。在`所有计算图`页签中，列表按计算图类型（如Tensor/Tile/Block Graph）分组展示，每组以颜色区分pass执行结果（同表1），并显示`First Fail`/`First Exc`/`Fail`/`Exc`标签（规则同精度pass分布列表）。点击列表项跳转对应计算图。(计算图精度报告操作详见[操作文档](../computation_graph/view_accuracy_report.md))

   **图 4**  查看`所有计算图`
   ![](../figures/accuracy_3.png)

