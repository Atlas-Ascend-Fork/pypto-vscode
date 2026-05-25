# 查看Mix子图

## 功能说明

开启Mix模式后，支持查看Wrap内微观任务流水，点击Sub节点可展示其宏观依赖。

## 前提条件

在A5机器上执行PyPTO程序，生成泳道图文件。

## 操作步骤

1.  打开泳道图文件。以下提供两种方式：
    -  在Visual Studio Code侧边栏，单击![](../figures/zh-cn_image_0000002491265870.png)图标，打开PyPTO Toolkit，在运行结果界面打开泳道图文件。
    -  在Visual Studio Code工作区，右键单击泳道图文件，在弹出的菜单中选择“PyPTO Toolkit：打开文件”。

2.  查看Mix子图。

    单击泳道图右侧的![](../figures/zh-cn_image_0000002512322027.png)按钮。

    ![](../figures/swimSetting.png)

    页面右边弹出泳道图渲染配置面板，启用Mix模式。

    ![](../figures/zh-cn_image_setting_panel.png)

    鼠标悬浮Sub节点，支持查看Wrap内微观任务流水。

    ![](../figures/zh-cn_image_hover_mix.png)

     点击Sub节点可展示其宏观依赖。

    ![](../figures/zh-cn_image_click_mix.png)



