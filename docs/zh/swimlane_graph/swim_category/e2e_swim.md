# 端到端泳道图

## 功能说明

端到端泳道图展示算子从 AICPU 调度到 Kernel 执行的完整过程。打开端到端泳道图时，插件自动将 AICPU 视图与 Kernel 视图融合为 Device 视图，用户可在同一视图中查看 AICPU 与 Kernel 的信息，支持宏观调度与微观流水双视图模式，帮助开发者快速定位瓶颈、高效调优。

## 前提条件

执行 PyPTO 程序，生成端到端泳道图文件。

1. 设置环境变量。

    ```shell
    export DUMP_DEVICE_PERF=true
    ```

2. 启动性能数据采集功能。

    ```python
    @pypto.frontend.jit(
        debug_options={"runtime_debug_mode": 1}
    )
    ```

3. 重新执行 PyPTO 程序，例如：

    ```bash
    python3 python/tests/st/operator/glm/test_glm_ffn_dense_quant.py
    ```

    在$\{work\_path\}/output/output\_\*/目录（\*代表时间戳）下生成泳道图数据文件，文件名为：merged\_swimlane.json。

## 操作步骤

1. 打开泳道图文件。以下提供两种方式：
    - 在 Visual Studio Code 侧边栏，单击![](../../figures/zh-cn_image_0000002491265870.png)图标，打开 PyPTO Toolkit，在运行结果界面打开泳道图文件。
    - 在 Visual Studio Code 工作区，右键单击泳道图文件，在弹出的菜单中选择“PyPTO Toolkit：打开文件”。

2. 查看 Device 视图。

    打开端到端泳道图后，插件自动将 AICPU 泳道图与 Kernel 泳道图融合为 Device 视图，共享统一时间轴，支持视图的同步缩放与平移联动。融合后的泳道布局如下：

    - AICPU 控制/调度泳道（AICPU-CTRL、AICPU-SCHED）位于视图顶部，核心泳道按核心类型（AIC/AIV）及编号排序。
    - AICPU 核心调度泳道与对应的Kernel核心泳道合并为同一条泳道，同屏展示同一核心的调度与执行信息。

    ![](../../figures/zh-cn_image_view_aicpu.png)

3. 查看控制类节点详情面板

    点击任意控制类节点，系统将弹出详情面板以展示相关信息
    ![](../../figures/zh-cn_image_view_ctrl_aicpu.png)

4. 查看调度类节点详情面板

   点击任意调度类节点，系统将弹出详情面板以展示相关信息
   ![](../../figures/zh-cn_image_view_sched_aicpu.png)
   
5. 查看 Kernel 节点详情面板

   点击任意 Kernel 节点，系统将弹出详情面板以展示节点信息与依赖关系
   ![](../../figures/zh-cn_image_view_kernel_click.png)
