# 性能统计

## 功能说明

性能报告面板提供泳道图的全局性能统计数据、按时间范围查看性能数据、框选部分节点查看性能数据，帮助开发者快速了解算子的整体性能概况，识别性能瓶颈。

## 前提条件

执行PyPTO程序，生成泳道图文件。

## 操作步骤

打开泳道图文件。以下提供两种方式：

- 在Visual Studio Code侧边栏，单击![](../figures/zh-cn_image_0000002491265870.png)图标，打开PyPTO Toolkit，在运行结果界面打开泳道图文件。

- 在Visual Studio Code工作区，右键单击泳道图文件，在弹出的菜单中选择"PyPTO Toolkit：打开文件"。

## 查看全局性能报告<a id="viewGlobalReport"></a>

全局性能报告面板提供泳道图的整体性能统计数据，帮助开发者快速了解算子的性能概况。

### 打开性能报告面板

单击泳道图右侧的![](../figures/zh-cn_image_0000002521522013.png)按钮。

![](../figures/swimReport.png)

页面右边弹出性能报告面板，包含多个标签页。

### 性能概览标签页

性能概览标签页展示全局性能统计数据，包括调度间隔分析、任务耗时统计、整体时间指标、AICore性能指标等。

<img src="https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/reportOverview.png" width="400">

**表 1**  性能概览参数说明

|参数|说明|
|--|--|
|最大调度间隙|显示当前泳道图中最大的调度间隔值及其时间单位，展示调度间隔前的任务名称和调度间隔后的子任务名称，点击可跳转到对应任务|
|任务最长耗时|显示当前泳道图中耗时最长的任务，包含数值、时间单位和任务列表，点击任务名称可跳转|
|任务最短耗时|显示当前泳道图中耗时最短的任务，包含数值、时间单位和任务列表，点击任务名称可跳转|
|AICore 端到端时间|去除 fake core 之外的AI核上的任务执行端到端时间|
|总耗时|所有任务执行的端到端时间|
|iCache命中率|指令缓存命中率|
|AICore Time|所有AICore泳道（AIC和AIV）中任务的总耗时|
|AICore利用率|计算公式：AICore Time / (任务面板时间 * AICore泳道个数)|
|Cube Cycles|Cube计算单元占用的时钟周期数|
|Vector Cycles|Vector计算单元占用的时钟周期数|
|AICPU 总耗时（仅端到端泳道图）|AICPU_CTRL、AICPU_SCHED泳道中所有节点持续时间之和|
|AICPU 执行利用率（仅端到端泳道图）|所有kernel任务持续时间之和 / (时间轴总时长 * 这些任务所占泳道数)|
|头开销（仅端到端泳道图）|AIC(V)-{n}-SCHED{m}泳道中，按轮次看，每轮次中，最早开始的kernel任务前面的aicpu任务之和|
|尾开销（仅端到端泳道图）|AIC(V)-{n}-SCHED{m}泳道中，按轮次看，每轮次中，最晚结束的kernel任务后面的aicpu任务之和|

### 耗时统计标签页

耗时统计标签页仅对 Kernel 泳道图生效，提供按 Leaf 编号或语义标签分类的任务耗时统计功能。

### 按 Leaf 编号统计

选择"按 Leaf 编号"模式时，展示 Leaf 编号维度的耗时分布。

<img src="https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/reportTimeLeafNo.png" width="400">

**表 2**  按 Leaf 编号统计参数说明

|参数|说明|
|--|--|
|任务耗时极差|显示子图内耗时最长和最短的任务|

### 按语义标签统计

选择"按语义标签"模式时，展示语义标签维度的耗时统计。

 <img src="https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/reportTimeSemanticLabel.png" width="400">

**表 3**  按语义标签统计参数说明

|参数|说明|
|--|--|
|任务耗时极差|显示同一语义标签内耗时最长和最短的任务|
|累计耗时|同一语义标签下所有任务的耗时总和|
|周期时长|同一语义标签下从最早开始到最晚结束的时间跨度|

## 按时间范围查看性能数据<a id="viewByTimeRange"></a>

支持通过度量模式特定时间段的泳道图和性能报告。

1. 在泳道图界面中，单击右侧的![](../figures/zh-cn_image_0000002521083697.png)按钮。

    ![](../figures/swimMeasureModeButton.png)

2. 在任务面板单击并拖拽出待度量的起点和终点，从而决定时间范围。

    系统具有自动吸附功能，拖拽完成后，起点和终点会自动吸附到一定范围内的最近位置。

3. 拖拽完成后，度量范围会变亮，时间轴上会显示度量区域的时间，下方则会弹出度量区域的性能汇总数据。

    ![](../figures/swimMeatureMode.png)

## 框选区域统计

在泳道图界面直接单击并拖拽出框选区域，可以快速查看该区域内的性能数据。

框选区域会高亮显示，下方弹出性能汇总面板，展示框选范围内的性能统计数据。

![](../figures/swimBoxSelection.png)

## 性能数据搜索

在度量或框选完成后，右下方的搜索页面可根据条件搜索相关事件的性能数据。

**表 4**  事件性能数据参数说明

|参数|说明|
|--|--|
|Root Func. Hash|选中范围内所有事件的event-hint里的root hash列表|
|Leaf Func. Hash|选中范围内所有事件的event-hint里的leaf hash列表|
|Occurrences|选中范围内该leaf hash有多少个任务|
|Wall duration(ms)|选中范围内该leaf hash的所有任务的总时间|
|Avg. Wall duration|选中范围内该leaf hash的所有任务的总时间 / 该leaf hash的任务数量|
