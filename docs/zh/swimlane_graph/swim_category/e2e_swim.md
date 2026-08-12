# 端到端泳道图

## 功能说明

端到端泳道图同屏展示算子从AICPU调度到Kernel执行的完整过程，支持宏观调度与微观流水双视图模式，帮助开发者快速定位瓶颈、高效调优。

## 前提条件

执行PyPTO程序，生成端到端泳道图文件。

1.  设置环境变量。

    ```
    export DUMP_DEVICE_PERF=true
    ```

2.  启动性能数据采集功能。

    ```python
    @pypto.frontend.jit(
        debug_options={"runtime_debug_mode": 1}
    )
    ```

3.  重新执行PyPTO程序，例如：

    ```bash
    python3 python/tests/st/operator/glm/test_glm_ffn_dense_quant.py
    ```

    在$\{work\_path\}/output/output\_\*/目录（\*代表时间戳）下生成泳道图数据文件，文件名为：merged\_swimlane.json。

## 操作步骤

1.  打开泳道图文件。以下提供两种方式：
    -  在Visual Studio Code侧边栏，单击![](../../figures/zh-cn_image_0000002491265870.png)图标，打开PyPTO Toolkit，在运行结果界面打开泳道图文件。
    -  在Visual Studio Code工作区，右键单击泳道图文件，在弹出的菜单中选择“PyPTO Toolkit：打开文件”。

2.  AICPU泳道图与Kernel泳道图采用上下对齐布局，共享统一时间轴，支持视图的同步缩放与平移联动。
   ![](../../figures/zh-cn_image_view_aicpu.png)

3.  查看控制类节点详情面板

    点击任意控制类节点，系统将弹出详情面板以展示相关信息
    ![](../../figures/zh-cn_image_view_ctrl_aicpu.png)

4. 查看调度类节点详情面板

   点击任意调度类节点，系统将弹出详情面板以展示相关信息
   ![](../../figures/zh-cn_image_view_sched_aicpu.png)

5. 查看Core类节点详情面板

   点击任意Core类节点，系统将弹出详情面板以展示相关信息
   ![](../../figures/zh-cn_image_view_core_aicpu.png)

   Core类详情面板的Kernel视图支持点击，可查看其依赖关系
   ![](../../figures/zh-cn_image_view_core_click_aicpu.png)
   
6. 泳道置顶

   插件支持泳道置顶功能。在端到端泳道图中，鼠标悬浮于泳道名称，显示![](../../figures/topButton.png)图标， 单击图标即可置顶，再次单击取消置顶。通过该功能，用户可将 AICPU 视图中的 SCHED 泳道与 Kernel 视图中对应的泳道固定至顶部，从而直观、高效地对比分析任务的调度与执行时序。
   
   ![](../../figures/zh-cn_image_view_top_aicpu.png)



