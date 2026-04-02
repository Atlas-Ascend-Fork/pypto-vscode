# PyPTO Toolkit 插件使用说明

PyPTO Toolkit是一款PyPTO框架全流程辅助工具，提供包括编译、运行时状态的可视化、算子开发作业流的作业能力，使能开发者快速建立对PyPTO框架的理解，提升算子开发和调试调优效率。

## 核心特性

- **控制流可视：** 将基于PyPTO框架表达的计算逻辑可视化，提供计算逻辑表达代码、控制流图及计算图的映射关系视图。

- **计算图：** 基于Tensor和Operation的基础图结构，提供原始计算图到可执行图编译过程的全流程可视化展示能力。

- **泳道图：** 提供核间、核内流水和统计信息的可视化展示，支持任务的依赖关系分析和多种维度(整体、单任务和框选范围内)的统计报告信息展示。

- **三栏联动视图：** 支持算子代码-计算图-泳道图之间的实时联动，降低使用PyPTO框架调试调优的门槛，提升一站式的调试调优效率。

## 历史运行结果

- **查看历史运行结果**

    点击VS Code侧边栏PyPTO图标，未显示图标可在侧边栏点击右键，勾选 `PyPTO Toolkit`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20openSidebar.gif)

- **搜索运行结果**

    运行结果名称为 `执行方式 + 执行日期 + 执行时间`，可根据需要自行搜索

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20sidebarSearch.gif)

## 控制流

- **查看控制流**

    选择任意运行结果目录，展开后点击 `结果总览`，即可查看控制流相关信息，控制流从上到下表示实际执行的先后顺序

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/openControlFlow.gif)

- **搜索节点**

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/nodeSearch.gif)

- **查看PATH详情**

    点击PATH卡片右上角图标查看详情

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/pathNodeDetail.gif)

## 计算图

- **打开计算图**

    在计算图 json 文件上右键选择`PyPTO Toolkit: 打开文件`即可

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/openCom.gif)

- **查看计算图**

    支持页面拖拽查看、缩略图中查看，以及缩放查看节点、点击查看节点详情

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/optCom.gif)
  
- **节点搜索**

    直接输入并回车，或者点击搜索按钮，可进行模糊搜索；点击搜索框选择相应分类，可进行分类搜索，节点点击可以查看json数据详情选择整图搜索，可搜索json内其他function中内容

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comSearch.gif)

- **子图跳转**

    双击call节点可进行子图跳转，call节点右下角有FX图标标识

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comToSubgraph.gif)

- **健康报告**

    点击右上角健康报告按钮，会搜索当前文件对应的健康报告相关json，并展示其内容，可通过健康报告快速定位相关节点

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/healthReport.gif)

- **图层控制**

    右上角按钮可以开启图层控制面板，支持更改布局方向，更改节点显示模式, 控制节点显示数量

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comGraphSetting.gif)

- **链路锁定**

    选中节点后，右键可以锁定或仅显示该节点相关链路, 可以在新标签查看当前通路, 通过快捷键快速实现节点跳转到上一个和下一个

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/lockPath.gif)

- **对比图开启**

    右键计算图文件，选择 “使用PyPTO Toolkit高级操作” 下级的 “PyPTO Toolkit打开计算图差异对比”，会自动选择同文件夹下的关联对比文件，如果未找到，可以自行选择需要对比的文件路径

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comgraphDiff.gif)

- **按节点搜索开启**

    右键计算图文件，选择 “使用PyPTO Toolkit高级操作” 下级的 “PyPTO Toolkit按节点搜索打开计算图”，可以通过搜索节点的关键字及属性打开计算图
    
    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/nodeSearch.gif)

- **局部搜索**

    打开文件节点数超过1万时，允许选择全量渲染或者搜索某个节点，渲染其相关链路，建议在文件过大时按需使用

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/localSearch.gif)

## 泳道图

- **打开泳道图**

    在泳道图 json 文件上右键选择`PyPTO Toolkit: 打开文件`即可打开

    - **Kernel泳道图**

        ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/openSwimGraph.gif)

    - **端到端（AICPU + Kernel）泳道图**

        ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.9/aicpuOpen.gif)
  
- **查看节点详情**

    点击节点可以在下方面板查看节点详情

    - **Kernel View**

        ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/swimGraphNodeDetail.gif)

    - **AICPU View**

        ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.9/aicpuDetail.gif)

- **节点搜索**

    在搜索框输入节点名称可以模糊搜索节点

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/swimSearch.gif)

- **跳转计算图**

    支持根据`rootHash`和`leafHash`跳转至计算图

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/swimToCom.gif)

- **泳道图导出**

    支持导出泳道图为 png 图片

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/exportSwimGraph.gif)

- **添加观测线**

    在二段轴上点击可以添加观测线，点击观测线可以删除或修改

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/addFlag.gif)

- **性能看板**

    点击左上角的报告按钮，即可查看性能报告，在页面点击节点可以自动定位到图上对应位置，便于用户快速查看性能问题。

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.6performanceReport.gif)

- **核利用率统计**

    点击左上角的度量模式按钮，或者鼠标框选节点，可查看核利用率统计信息

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/coreUti.gif)

- **泳道置顶**

    鼠标悬浮泳道左侧区域，会显示置顶图标，点击即可将本泳道置顶

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.9/pinn.gif)

- **快捷键列表**

  | 快捷键 | 功能描述 |
  | --- | --- |
  | 鼠标滚轮 | **纵向**移动 |
  | 鼠标左键 + CTRL | **横向**移动 |
  | 鼠标滚轮 + CTRL | 缩放 |
  | 鼠标左键 + ALT | 手动测距 |
  | w / s（支持在配置页面配置） | 放大 / 缩小 |
  | a / d（支持在配置页面配置） | 横向移动 |

## 三栏联动视图

三栏联动视图指的是在一个页面视图里同时展示代码、计算图和泳道图，三者通过语义标签关联，可以通过在任一视图点击，联动高亮显示三栏视图的对应内容，帮助开发者快速理解从代码实现到对应的计算图表达，再到上板泳道图最终的性能表现的整个过程。

- **打开三栏联动视图**

  在 cpp/python 文件右键，选择 “PyPTO Toolkit: 开启联动模式” 即可打开三栏联动视图

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeView.gif)

- **锁定模式**

  在三栏视图中的任一视图点击锁定按钮，即可开启锁定模式，在该模式下，高亮效果不会改变。在任一视图点击解锁按钮，即可退出该模式。

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeViewLock.gif)

## 其他辅助功能

- **一键关闭插件所有页面**

  当打开的页面较多时，可以通过`PyPTO Toolkit: 关闭所有工具页面`菜单来一键关闭插件打开的所有页面

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.3%20allTabsOneClose.gif)

## 反馈渠道

  如有任何问题和建议，欢迎提ISSUE：[https://gitcode.com/cann/pypto/issues](https://gitcode.com/cann/pypto/issues)

## 免责声明

### 1. 适用范围

本许可协议（下称“本协议”）适用于您及您有权代表的公司（统称为“您”或“您的”）与华为技术有限公司及其关联公司（统称为“华为”）之间在中华人民共和国境内在华为AI处理器上对PyPTO Toolkit（下称“PyPTO Toolkit”）的非排他的使用。您同意本协议的约定，方可下载、安装以及按照本协议约定使用（下称“接受”） PyPTO Toolkit。如果您不同意本协议的约定或者您没有本协议约定的上述缔约资格，请不要下载、安装以及按照本协议约定使用 PyPTO Toolkit。本协议不适用于PyPTO Toolkit中所包含的开源软件。为免疑义，在 PyPTO Toolkit 中包含的开源及第三方软件，也可能受单独的许可条款管辖。如果本协议中的条款与第三方许可条款之间存在任何冲突，则第三方许可条款仅应在解决冲突所需的范围内适用。

### 2. 定义

2.1 PyPTO Toolkit是指由华为主导的仅用于CANN的开发、维护、并在本协议所在的网页发布的仅用于华为AI处理器的PyPTO Toolkit软件、文档等及其更新。

2.2 CANN是指Compute Architecture for Neural Networks，即由华为面向AI推出的端云一致的异构计算架构。

2.3 用户是指与华为签订本协议下载PyPTO Toolkit，并使用该PyPTO Toolkit的个人或实体。

2.4 目标代码是指二进制形式的计算机可执行的程序代码。

2.5 源代码是指按照程序设计语言规范编写的、未编译的、人类可读的软件代码。

2.6 开源软件是指任何受“开源许可证”约束的源代码或者目标代码。PyPTO Toolkit中以源代码形式、非公开分发的软件不属于开源软件。开源许可证是指一种软件许可协议，它允许用户在遵守该许可证所设定的特定条件的前提下，自由地使用、修改以及分发该软件及其源代码。

2.7 华为AI处理器是指（i）带有“昇腾”、“麒麟”、“越影”或其他华为拥有或控制品牌的AI芯片；或（ii）由华为制造（包括委托制造）、供应（包括委托供应）或设计（包括委托设计）的AI芯片。

### 3. 许可范围

在本协议有效期内，您遵守本协议全部约定的前提下，华为授权作为用户的您：

（1）下载、安装 PyPTO Toolkit；

（2）基于PyPTO Toolkit开发仅在华为AI处理器上运行的软件；

（4）基于PyPTO Toolkit编译仅在华为AI处理器上运行的软件；

（5）基于PyPTO Toolkit测试仅在华为AI处理器上运行的软件；

（6）基于PyPTO Toolkit诊断仅在华为AI处理器上运行的软件；

（7）基于PyPTO Toolkit以其他方式使用仅在华为AI处理器上运行的软件。

### 4. 使用限制

4.1 除本协议明确约定外，您不得：

（1）使用、复制、披露、分发或公开展示PyPTO Toolkit；

（2）共享、发布、出租或租赁PyPTO Toolkit给任何第三方；

（3）转让您在本协议中的权利及义务或转让PyPTO Toolkit；

（4）全部或部分修改、改编或翻译PyPTO Toolkit；

（5）逆向工程、反编译或反汇编PyPTO Toolkit，或试图以其他方式导出PyPTO Toolkit软件的源代码；

（6）规避或破解PyPTO Toolkit中的任何技术限制；

（7）将PyPTO Toolkit用于非华为AI处理器；

（8）将集成PyPTO Toolkit的软件运行到非华为AI处理器；

（9）集成PyPTO Toolkit的软件通过修改、翻译等方式用于非华为AI处理器；

（10）删除、最小化、阻止或修改PyPTO Toolkit材料中华为或其供应商的任何通知；

（11）将PyPTO Toolkit包括在恶意、欺骗或非法的计划或产品中，或以任何违法的方式使用PyPTO Toolkit；

（12）修改、创建衍生作品、链接、集成或分发非开源的PyPTO Toolkit，使其任何部分成为开源软件；

（13）以源代码的形式独立分发或与其他软件集成分发PyPTO Toolkit中非开源软件；

（14）将基于本协议获得的PyPTO Toolkit用于针对华为或华为客户的知识产权侵权分析、取证；

（15）未经华为书面同意公开PyPTO Toolkit相关数据，包括但不限于性能评估数据；

（16）使用批量下载工具，爬虫工具等下载PyPTO Toolkit；

4.2 您不得用PyPTO Toolkit及华为的品牌为您开发的软件或提供的服务提供质量保证。您对使用您开发的软件或提供的服务的客户全权负责与此有关的任何更新、支持义务或其他因分销您的产品或服务而产生的义务或责任，且您有义务在因您开发的软件或提供的服务所引发的争议或诉讼中为华为提供辩护，使其免受任何索赔、诉讼或费用支出（若有）。

4.3 本协议授权您的各项权利，除非获得华为的书面同意，否则不可转让。您只能在所有权变更、合并、收购、出售或转让您的全部或实质上全部业务或资产的同时，才可将您根据本协议收到的PyPTO Toolkit以及您在本协议下的所有权利转让给另一方（统称为“受让人”），但您将根据本协议收到的PyPTO Toolkit以及您在本协议下的所有权利转让给另一方，需要遵循以下约束：您必须通过向华为发送信函书面通知华为转让：（i）明确受让人和您的法律实体，（ii）明确要转让的 PyPTO Toolkit，（iii）证明您不保留 PyPTO Toolkit 或其部分的副本，（iv）证明受让人已书面同意受本协议所有条款和条件的约束。

### 5. 材料更新

华为可随时对PyPTO Toolkit进行更新。除非这些更新包含独立的许可条款，否则这些更新视为本协议中的 PyPTO Toolkit 的一部分，适用于本协议。您同意华为对PyPTO Toolkit的更新，不需要事先对您进行通知。尽管华为通常会保证PyPTO Toolkit 版本的兼容性，但不排除在一些情况下，华为对PyPTO Toolkit的更新会引入对PyPTO Toolkit未来版本的不兼容。

### 6. 所有权

PyPTO Toolkit及其所有副本的所有权归华为所有。PyPTO Toolkit受知识产权保护，包括但不限于著作权法和国际条约规定。您不得从材料中删除任何版权或其他专有声明。您同意不得未经授权的复制PyPTO Toolkit。除在本协议中明确授权您的权利外，本协议不授予您任何其他权利或许可；特别地，华为不授予您任何明示或暗示的华为专利、版权、商标或商业秘密权利。

### 7. 反馈

您同意根据您使用PyPTO Toolkit提供给华为的任何材料、信息、评论、建议或其他信息（统称“反馈意见”），您在此授予华为非独占、永久的、不可撤销、免费的版权许可，华为可以基于您提供的反馈意见复制、修改、创建衍生作品、公开展示、披露、分发、许可和分许可或其他任何方式，将反馈意见及其包含的所有数据、图像、声音、文本和其他内容，包括其衍生作品，用于任何商业或非商业目的，并用于任何方式的使用。如果您根据您使用 PyPTO Toolkit提供给华为的反馈意见与技术特性、功能相关，您在此授予华为非独占的、永久的、不可撤销的、免费的专利许可及分许可权利。

### 8. 保密义务

如果您与华为之间就使用PyPTO Toolkit没有签订独立的保密协议，本协议以下约定将适用您使用PyPTO Toolkit要遵从的保密条款。本协议中约定的PyPTO Toolkit是华为的保密信息，这些PyPTO Toolkit仅用于根据本协议进行使用的目的。您将以至少与您保护自己的保密信息相同的谨慎程度维护华为机密信息，并至少不低于合理程度。您将仅向需要了解并同意遵守保密条款的员工披露保密信息，您将对任何此类员工的违反本协议约定的行为负责。就本协议而言，员工将包括与您签署保密协议的您的下游分包商。

### 9. 责任限制与排除

在任何情况下，华为不对您根据本协议使用PyPTO Toolkit而产生或与之相关的任何直接、间接、附带、后果、特殊或其他损失或损害负责，包括但不限于，下列任何损失或损害（无论此类损失或损害是预见的、可预见的、已知的或其他的）：（i）收入损失；（ii）实际或预期利润损失；（ii）货币使用损失；（iv）预期节约的损失；（v）业务损失；（vi）机会损失；（vii）商誉损失；（viii）软件的使用损失；（ix）声誉损失；（x）损失、损害，或数据损坏；或（xi）任何间接、附带的特殊或间接损害损失。

### 10. 不保证

10.1 本协议中的PyPTO Toolkit，华为不提供任何明示、暗示的保证，包括但不限于关于适销性、适用于任何特定目的的保证或条件、不侵权等任何原因而产生的任何保证。

10.2 除法律另有明确规定外，华为不保证PyPTO Toolkit 中的软件（包括但不限于第三方软件或开源软件）无错误或不间断地运行，华为将积极响应并提供在 PyPTO Toolkit 生命周期内出现的影响产品使用的重大软件漏洞的缓解措施或修补方案，但不保证华为会测试、纠正所有错误。此外，由于不断出现新的入侵和攻击网络的技术，华为不保证 PyPTO Toolkit 或使用 PyPTO Toolkit 的任何设备、系统或网络不会受到入侵或攻击。

### 11. 期限和终止

11.1 本协议自您接受本协议之日起生效。如果您违反了本协议任何条款和条件，并且在华为书面通知后三十（30）天内，此类违约行为未得到纠正，华为可立即终止本协议，您将承担由此给华为造成的损失，该损失包含诉讼费和律师费。

11.2 如果您在本协议期间发起针对华为的诉讼或对第三方使用的PyPTO Toolkit本身提起诉讼，本协议在您发起诉讼之日起自动终止。

11.3 您将同意您为PyPTO Toolkit提供与本协议至少同等的保护，如果您的客户在销售、使用您开发的集成了PyPTO Toolkit 的软件的过程中，或者销售、使用安装了 PyPTO Toolkit 的华为AI处理器的过程中出现违反本协议约定的行为或其他侵犯PyPTO Toolkit知识产权的行为，您将及时采取措施制止上述行为。如果您未采取有效措施，华为可终止本协议。您将承担上述行为给华为造成的损失，该损失包含诉讼费和律师费。

11.4 您将同意，除您承担上述给华为造成的损失外，针对上述行为，华为还有权采取禁令的方式进行救济。

11.5 本协议终止后，您将立即返还或销毁PyPTO Toolkit及其所有副本。如果本协议终止，则在终止生效日期之前，您根据本协议分发的任何PyPTO Toolkit将在本协议的任何此类终止后继续有效。

11.6 本协议第 1、2、4、5、6、7、8、9、10、11、12 条将在本协议到期或终止后继续有效。

### 12. 审计

您同意，华为可在发出书面通知三十（30）日后，有权对您 PyPTO Toolkit 的使用情况进行审计。审计的重点为包含但不限于软件的功能、应用、备份、归档记录、安装数量、复制数量、分发数量等。华为有权指定第三方代理行使上述审计权利。您同意配合华为审计并提供合理的协助。您同意提供包括但不限于帐簿、报表、合同、技术支持文档、订单报告系统等给华为。

### 13. 出口管制

13.1 您同意，本协议中约定的 PyPTO Toolkit 只应用于运行在中华人民共和国境内的华为AI处理器；如果您是授权用户并且作为云服务提供商，您同意运行只向中华人民共和国境内提供 PyPTO Toolkit 所支持的服务。

13.2 您同意本协议中约定的 PyPTO Toolkit 的出口、再出口可能适用出口管制相关的法律。任何针对 PyPTO Toolkit 或集成 PyPTO Toolkit 的产品的出口、再出口均不得违反上述法律，也不得用于上述法律所禁止的任何目的。

### 14. 一般条款

14.1 本协议应根据中华人民共和国法律解释和管辖而不考虑其冲突法规范。本协议下产生的争议如双方不能友好协商解决，应由中国广东省深圳市有管辖权的法院管辖。

14.2 本协议的某一条款无效、非法或不可执行，双方应尽可能按照原有意图订立修改条款来替代该无效条款，协议中其余条款的效力和执行力不受该无效条款的影响。