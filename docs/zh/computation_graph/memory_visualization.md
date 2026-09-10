#  内存可视化视图

##  功能说明

根据内存trace文件，将其转换成内存可视化页面

##  前提条件

计算图文件和内存trace文件在同一目录

##  操作步骤

1. 在Visual Studio Code工作区，右键单击计算图文件或者内存trace文件，在弹出的菜单中选择“PyPTO Toolkit：打开文件”，点击“查看模拟执行内存分配”。

![打开内存可视化](../figures/memory-usage1.gif)

2. 打开内存可视化界面，最下方是事件条，按发生时间点clock划分。点击对应clock可以展示对应时间点的所有事件列表。

![事件条](../figures/memory-usage2.gif)

3. 事件列表允许事件按列表播放或者单个事件播放。单击事件名可以查看事件详情。

![事件播放](../figures/memory-usage3.gif)
