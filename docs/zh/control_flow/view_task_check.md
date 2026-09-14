# 查看Task粒度精度对比报告

## 功能说明

打开TaskCheck页面后，若文件包含Task粒度精度对比数据，可在数据导入成功后查看Task粒度精度对比报告。TaskCheck用于快速定位任务级别的精度问题。

## 前提条件

文件包含Task粒度精度对比数据。

## 操作步骤

### 步骤一：打开TaskCheck页面

在运行结果界面中，单击`Task Check`按钮，打开TaskCheck页面。程序将自动导入Task粒度精度对比数据，导入成功后，左侧Compare List区域会显示可解析的Task粒度精度对比数据列表。

**图 1**  `Task Check`按钮位置
![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/taskcheck_1.gif)
<br />

### 步骤二：解析数据并打开Diff视图

在Compare List中单击需要查看的数据项：

- **未解析的数据项**：点击后弹出解析对话框。单击`开始解析`按钮启动解析过程，解析完成后，右侧将显示Diff视图并更新数据项状态。初始未解析的数据项无状态标识，解析完成后状态更新为`PASS`或`x FAIL`（x表示差异数量，例如：有5个差异时显示为`5 FAIL`）。
- **已解析的数据项**：点击后直接在右侧显示Diff视图。

**图 2**  Diff视图展示效果
![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/taskcheck_2.gif)
<br />

### 步骤三：查看Diff视图及精度结果详情

Diff视图提供以下功能：

- 支持多条件精准搜索（包括OpMagic、RawMagic、TensorAddr、Symbol、FuncHash）
- 支持筛选`全部`、`仅Pass`或`仅Fail`的数据项
- 单击数据项展开按钮，可查看详细数据（包括左侧CodegenPreproc数据和右侧task\_dump数据）
- 单击选中数据项（左侧或右侧），可打开精度结果详情

精度结果页面提供以下功能：

- 展示概览信息：包括数据类型、ValidShape、LoopInfo、rtolAtol等精度统计指标
- 展示详细对比数据：包括Offset、A数据、B数据、相对误差、绝对误差、容差等信息
- 支持自定义排序和单列排序
- 点击跳转按钮，可跳转到对应的计算图（左侧数据）或泳道图（右侧数据）

**图 3**  Diff视图及精度结果详情
![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/taskcheck_3.gif)

### 步骤四：跳转到计算图或泳道图

精度结果页面支持以下跳转功能：

- **左侧数据（CodegenPreproc）**：点击跳转按钮，打开对应的计算图视图，定位到该Task对应的算子节点
- **右侧数据（task\_dump）**：点击跳转按钮，打开对应的泳道图视图，定位到该Task对应的执行位置

通过跳转功能，开发者可以在计算图或泳道图中进一步分析精度问题的根因。

**图 4**  跳转到计算图或泳道图
![](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/taskcheck_4.gif)
<br />