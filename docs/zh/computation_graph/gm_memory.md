#  GM内存可视化视图

##  功能说明

用于查看GM内存使用分配情况，包括Tensor的内存分配、冲突等。

##  操作步骤

1. 在Visual Studio Code工作区，右键单击内存分布文件，在弹出的菜单中选择“PyPTO Toolkit：高级操作”，在展开的二级菜单中选择“PyPTO Toolkit：GM内存可视化”。

![打开GM内存可视化](../figures/gm-memory-usage1.gif)

2. 单机Tensor可以查看该Tensor的内存分配信息，并提供表格和图表两种视图展示。

![查看Tensor详细信息](../figures/gm-memory-usage2.gif)

3. 双击region ID进入该region的内存分配，在该模式下，可以通过按住ALT键，鼠标选中两个Tensor，来查看两者的距离。

![测距功能](../figures/gm-memory-usage3.gif)

4 右键点击Tensor，可以查看距离该Tensor最近的Tensor。

![查看最近Tensor](../figures/gm-memory-usage4.gif)
