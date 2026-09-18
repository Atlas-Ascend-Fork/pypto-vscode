# MIX 模式

## 功能说明

Mix模式用于展示Wrap内微观任务流水，支持在同个视图中查看任务的宏观调度与微观执行细节。通过该模式，开发者可以深入分析任务内部的同步事件、等待时间及子任务依赖关系，快速定位性能瓶颈。

## 前提条件

执行PyPTO程序，生成包含Wrap信息的泳道图文件。

1. 启动性能数据采集功能。

    ```python
    @pypto.frontend.jit(
        debug_options={"runtime_debug_mode": 1}
    )
    ```

2. 重新执行PyPTO程序，例如：

    ```bash
    python3 python/tests/st/operator/glm/test_glm_ffn_dense_quant.py
    ```

    在$\{work\_path\}/output/output\_\*/目录（\*代表时间戳）下生成泳道图数据文件，文件名为：merged\_swimlane.json。

## 限制说明

- 当前仅 A5 芯片采集的泳道图支持此功能

## 操作步骤

1. 打开泳道图文件。以下提供两种方式：
    - 在Visual Studio Code侧边栏，单击![](../../figures/zh-cn_image_0000002491265870.png)图标，打开PyPTO Toolkit，在运行结果界面打开泳道图文件。
    - 在Visual Studio Code工作区，右键单击泳道图文件，在弹出的菜单中选择"PyPTO Toolkit：打开文件"。

2. 启用Mix模式。

    单击泳道图右侧的![](../../figures/zh-cn_image_0000002512322027.png)按钮。

    ![](../../figures/swimSetting.png)

    页面右边弹出泳道图渲染配置面板，启用Mix模式开关。

    ![](../../figures/useMix.png)

3. 查看Wrap内微观任务流水。

    鼠标悬浮在Sub节点上，可查看Wrap内的微观任务流水，包括子任务的执行顺序、同步事件和等待时间。

    ![](../../figures/hoverMix.png)

4. 查看Sub节点宏观依赖。

    点击Sub节点，可展示其宏观依赖关系，包括前序依赖和后续依赖。

    ![](../../figures/clickMix.png)

    **表 1**  Sub节点依赖关系说明

    |参数|说明|
    |--|--|
    |![](../../figures/zh-cn_image_0000002521510305.png)|查看前序依赖节点|
    |![](../../figures/zh-cn_image_0000002502354012.png)|查看后续依赖节点|
    |![](../../figures/zh-cn_image_0000002533954015.png)|查看前后序依赖节点|
    |依赖连线层级|配置为-1表示展示全部依赖层级|
