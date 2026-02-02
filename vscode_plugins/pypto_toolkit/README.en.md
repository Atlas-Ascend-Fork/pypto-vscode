# PyPTO Toolkit Plugin User Guide

PyPTO Toolkit is a PyPTO framework full process auxiliary tool that provides visualization of compilation, runtime status, and operator development workflow capabilities, enabling developers to quickly establish an understanding of the PyPTO framework and improve operator development and debugging optimization efficiency.

## Key Features

-**Control flow visualization:** Visualize the computational logic expressed based on the PyPTO framework, providing a mapping relationship view of the computational logic expression code, control flow diagram, and computational diagram.

-**Computation Graph:** Based on the basic graph structure of Tensor and Operation, it provides the ability to visualize the entire process from the original computational graph to the executable graph compilation process.

-**Swimlane Diagram:** Provides visual display of inter core, intra core flow, and statistical information, supporting dependency analysis of tasks and display of statistical report information from multiple dimensions (overall, single task, and box selection range).

-**Three column linkage view:** Supports real-time linkage between operator code, computation graph, and swimlane diagram, reducing the threshold for debugging and tuning using PyPTO framework and improving one-stop debugging and tuning efficiency.

## Compilation Result

- **Check compilation result**

    Click the icon in the VS Code sidebar, if the icon is not displayed, right-click in the sidebar and check `PyPTO Toolkit`.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20openSidebar.gif)

- **Search from compilation result**

    The output file name is in the format of `Run Type + Execution Date + Execution Time`.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.0%20sidebarSearch.gif)

## Control Flow

- **Open result overview**

    Select any result directory, expand it, and click `Result Overview`.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/openControlFlow.gif)

- **Search for nodes**

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/nodeSearch.gif)

- **Check PATH node detail**

    Click the icon in the upper right corner of the PATH card to view details.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/pathNodeDetail.gif)

## Computation Graph

- **Open Computation Graph**

    Right-click on the computation graph json file and select `PyPTO Toolkit: Open file`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/openCom.gif)

- **View Computation Graph**

    Support page dragging, thumbnail viewing, zooming to view nodes, and clicking to view node details

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/optCom.gif)
  
- **Node Search**

    Enter directly and press Enter, or click the search button for fuzzy search; click the search box to select the corresponding category for category search. Click on nodes to view json data details. Select full graph search to search content in other functions within the json

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comSearch.gif)

- **Subgraph Navigation**

    Double-click on call nodes to navigate to subgraphs. Call nodes are identified by an FX icon in the bottom right corner

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comToSubgraph.gif)

- **Health Report**

    Click the health report button in the upper right corner to search for the health report related json corresponding to the current file and display its content. You can quickly locate related nodes through the health report

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/healthReport.gif)
  
- **Layer Control**

    The button in the top right corner can open the layer control panel, which supports changing the layout direction and adjusting the node display mode, and control over the number of nodes displayed

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comGraphSetting.gif)

- **Link Locking**

    After selecting a node, right-clicking allows you to lock or display only the links related to that node. You can view the current path in a new tab and quickly jump to the previous and next nodes using shortcut keys.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/lockPath.gif)

- **Comparison Mode Activation**

    Right-click the calculation graph file and select "PyPTO Toolkit Advanced Operations" under it, then choose "PyPTO Toolkit Open Calculation Graph Difference Comparison". It will automatically select the associated comparison file in the same folder. If not found, you can manually select the file path for comparison.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/comgraphDiff.gif)
 
- **Node search enabled**

    Right-click the calculation graph file, select "Open Calculation Graph by Node Search Using PyPTO Toolkit" under the "Advanced Operations with PyPTO Toolkit" submenu, and open the calculation graph by searching for keywords and attributes of the nodes

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/compute/nodeSearch.gif)

- **Local Search**

    When the number of open file nodes exceeds 10000, you can choose to render all nodes or search for a specific node and render its related linked. It is recommended to use this feature as needed when file size is too large.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/localSearch.gif)

## Swimlane Diagram

- **Open Swimlane Diagram**

    Right-click on the swimlane diagram json file and select `PyPTO Toolkit: Open file`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/openSwimGraph.gif)
  
- **View Node Details**

    Click on the node to view its details in the lower panel

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/swimGraphNodeDetail.gif)

- **Node Search**

    Inputting the node name in the search box allows for a fuzzy search of the node

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/swimSearch.gif)

- **Jump to Computation Graph**

    Support jumping to computation graph based on `rootHash` and `leafHash`

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/swimToCom.gif)

- **Swim Graph Export**

    Support export swim graph to png image file

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/exportSwimGraph.gif)

- **Add observation line**

    Clicking on the second axis can add observation lines, and clicking on an observation line can delete or modify it

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/addFlag.gif)

- **PMU performance panel**

    Click the report button in the upper left corner to view the PMU performance.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.0/swim/pmu.gif)

- **Core utilization statistics**

    Click the metric mode button in the upper left corner, or use the mouse to select nodes to view core utilization statistics.

    ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/2.0.2/coreUti.gif)

- **Shortcut Key List**

  | Shortcut | Function Description |
  | --- | --- |
  | Mouse Wheel | **Vertical** movement |
  | Left Mouse Button + CTRL | **Horizontal** movement |
  | Mouse Wheel + CTRL | Zoom |
  | Left Mouse Button + ALT | Manual distance measurement |
  | w / s (configurable in settings page) | Zoom in / Zoom out |
  | a / d (configurable in settings page) | Horizontal movement |

## Three-Panel Linked View

The three-panel linked view simultaneously displays code, a computational graph, and a swimlane diagram within a single page. These three panels are linked through semantic tags, allowing users to click on any panel to synchronously highlight corresponding content across all three views. This helps developers quickly understand the entire process—from the code implementation, to its representation in the computational graph, and finally to its performance characteristics as shown in the on-board swimlane diagram.

- **Opening the Three-Panel Linked View**

  Right-click on a C++ or Python file and select "PyPTO Toolkit: Open linkage mode" to open the three-panel linked view.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeView.gif)

- **Lock Mode**

  Click the lock button in any of the three panels to enable Lock Mode. In this mode, the highlighting state remains fixed and will not change. To exit Lock Mode, click the unlock button in any panel.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.1threeViewLock.gif)

## Other Helper Features

- **Close all pages opened by PyPTO Toolkit**

  When you have multiple pages open, you can use the `PyPTO Toolkit: Close all tool page` menu to instantly close all pages opened by the plugin.

  ![image](https://ascend-cann.obs.cn-north-4.myhuaweicloud.com/devkit/images/1.0.3%20allTabsOneClose.gif)

## Feedback Channel

  If you have any questions or suggestions, please submit an issue:[https://gitcode.com/sunmaxwell/pypto-toolkit/issues](https://gitcode.com/sunmaxwell/pypto-toolkit/issues)

## Disclaimer

### 1. Scope of Application

This License Agreement (hereinafter “this Agreement”) governs the non-exclusive use of the PyPTO Toolkit (hereinafter “PyPTO Toolkit”) on Huawei AI processors within the territory of the People’s Republic of China between you and any company you are authorized to represent (collectively referred to as “you” or “your”) and Huawei Technologies Co., Ltd. and its affiliates (collectively referred to as “Huawei”).
You may download, install, and use (hereinafter “accept”) the PyPTO Toolkit in accordance with this Agreement only after agreeing to its terms. If you do not agree to this Agreement or lack the capacity to enter into this Agreement as described herein, you must not download, install, or use the PyPTO Toolkit.
This Agreement does not apply to open-source software contained in the PyPTO Toolkit. For the avoidance of doubt, open-source and third-party software included in the PyPTO Toolkit may be governed by separate license terms. In the event of any conflict between the provisions of this Agreement and any third-party license terms, the third-party license terms shall prevail only to the extent necessary to resolve the conflict.

### 2. Definitions

2.1 “PyPTO Toolkit” means the PyPTO Toolkit software, documentation, and updates thereof developed and maintained by Huawei, published on the webpage where this Agreement is located, and intended exclusively for use on Huawei AI processors.

2.2 “CANN” means Compute Architecture for Neural Networks, the end-to-cloud consistent heterogeneous computing architecture launched by Huawei for artificial intelligence.

2.3 “User” means an individual or entity that has entered into this Agreement with Huawei to download and use the PyPTO Toolkit.

2.4 “Object Code” means computer-executable program code in binary form.

2.5 “Source Code” means software code written in accordance with programming language specifications, uncompiled, and readable by humans.

2.6 “Open-Source Software” means any Source Code or Object Code subject to an “Open Source License.” Software provided in Source Code form but not publicly distributed in the PyPTO Toolkit is not Open-Source Software. An “Open-Source License” means a type of software license that allows users to freely use, modify, and redistribute the software and its source code, while complying with certain conditions set by the license.

2.7 Huawei AI Processors mean AI chipsets (i) branded with "Ascend", "Kirin", "Yueying" or other brands owned or controlled by Huawei; or (ii) manufactured (including have manufactured), supplied (including have supplied) or designed (including have designed) by Huawei.

### 3. Scope of License

Subject to your full compliance with all terms of this Agreement during its term, Huawei grants you, as a User, a non-exclusive license to:

(1) download and install the PyPTO Toolkit;

(2) develop software exclusively for use on Huawei AI processors based on the PyPTO Toolkit;

(3) compile software exclusively for use on Huawei AI processors based on the PyPTO Toolkit;

(4) test software exclusively for use on Huawei AI processors based on the PyPTO Toolkit;

(5) diagnose software exclusively for use on Huawei AI processors based on the PyPTO Toolkit;

(6) use software exclusively for use on Huawei AI processors in other ways based on the PyPTO Toolkit.

### 4. Use Restrictions

4.1 Except as expressly permitted in this Agreement, you shall not:

(1) use, copy, disclose, distribute, or publicly display the PyPTO Toolkit;

(2) share, publish, rent, or lease the PyPTO Toolkit to any third party;

(3) assign your rights or obligations under this Agreement or transfer the PyPTO Toolkit;

(4) modify, adapt, or translate the PyPTO Toolkit, in whole or in part;

(5) reverse engineer, decompile, disassemble, or attempt to derive the Source Code of the PyPTO Toolkit by any other means;

(6) circumvent or breach any technological restriction in the PyPTO Toolkit;

(7) use the PyPTO Toolkit on non-Huawei AI processors;

(8) run software that incorporates the PyPTO Toolkit on non-Huawei AI processors;

(9) modify or translate software incorporating the PyPTO Toolkit for use on non-Huawei AI processors;

(10) remove, obscure, block, or modify any notice of Huawei or its suppliers contained in the PyPTO Toolkit materials;

(11) include the PyPTO Toolkit in any malicious, deceptive, or unlawful plan or product, or use it in any unlawful manner;

(12) modify, create derivative works of, link to, integrate, or distribute non-open-source portions of the PyPTO Toolkit in such a way that any part becomes Open-Source Software;

(13) distribute non-open-source portions of the PyPTO Toolkit independently in Source Code form or integrated with other software;

(14) use the PyPTO Toolkit obtained under this Agreement for intellectual property infringement analysis or forensic purposes against Huawei or Huawei’s customers;

(15) disclose PyPTO Toolkit-related data (including but not limited to performance benchmark data) publicly without Huawei’s prior written consent;

(16) use batch download tools, crawlers, or similar means to download the PyPTO Toolkit.

4.2 You may not use the PyPTO Toolkit or any Huawei brand to provide any quality warranty or guarantee for software you develop or services you provide. You assume full responsibility to your customers for any updates, support obligations, or other obligations or liabilities arising from the distribution of your products or services, and you shall defend Huawei against any claims, lawsuits, or expenses arising from disputes or litigation related to the software you develop or services you provide.

4.3 The rights granted to you under this Agreement are non-transferable without Huawei’s prior written consent. You may transfer the PyPTO Toolkit received under this Agreement and all your rights hereunder only in connection with a change of ownership, merger, acquisition, sale, or transfer of all or substantially all of your business or assets to another party (collectively “Transferee”), provided that you:
(i) notify Huawei in writing by letter of the transfer, identifying (a) the Transferee and your legal entity, (b) the specific PyPTO Toolkit being transferred, (c) that you retain no copies of the PyPTO Toolkit or any portion thereof, and (d) that the Transferee has agreed in writing to be bound by all terms and conditions of this Agreement.

### 5. Updates

Huawei may update the PyPTO Toolkit at any time. Unless such updates are accompanied by separate license terms, they shall be deemed part of the PyPTO Toolkit under this Agreement. You agree that Huawei is not required to notify you in advance of any update. While Huawei generally seeks to maintain version compatibility, Huawei does not guarantee that updates will be backward compatible in all cases.

### 6. Ownership

All right, title, and interest in and to the PyPTO Toolkit and all copies thereof remain vested in Huawei. The PyPTO Toolkit is protected by copyright laws and international treaty provisions. You shall not remove any copyright or other proprietary notices from the materials. You agree not to reproduce the PyPTO Toolkit except as expressly authorized herein. Except for the express rights granted to you in this Agreement, no other rights or licenses are granted to you hereunder, whether by implication, estoppel or otherwise. In particular, Huawei does not grant you any express or implied rights under any patents, copyrights, trademarks, or trade secrets of Huawei.

### 7. Feedback

Any materials, information, comments, suggestions, ideas, or other input that you provide to Huawei in connection with your use of the PyPTO Toolkit (collectively, “Feedback”) is provided on a non-confidential basis. You hereby grant Huawei a non-exclusive, perpetual, irrevocable, royalty-free, worldwide license to use, copy, modify, create derivative works of, publicly display, disclose, distribute, sublicense, and otherwise exploit the Feedback and all data, images, audio, text, and other content contained therein (including any derivative works) for any commercial or non-commercial purpose and in any manner whatsoever.
If such Feedback relates to features, functionality, or improvements, you further grant Huawei a non-exclusive, perpetual, irrevocable, royalty-free, worldwide patent license (including the right to sublicense) under any patents or patent applications owned or controlled by you that are necessarily infringed by implementing such Feedback.

### 8. Confidentiality

If no separate confidentiality agreement exists between you and Huawei regarding the use of the PyPTO Toolkit, the following provisions shall apply.
The PyPTO Toolkit constitutes confidential information of Huawei and may be used solely for the purposes expressly permitted under this Agreement. You shall protect Huawei’s confidential information with at least the same degree of care that you use to protect your own confidential information of a similar nature, but in no event less than reasonable care. You shall disclose confidential information only to your employees (including contractors and subcontractors who have executed confidentiality agreements with you) who have a legitimate need to know such information for the permitted purposes and who are bound by confidentiality obligations at least as protective as those contained herein. You shall be responsible for any breach of this Agreement by your employees, contractors, or subcontractors.

### 9. Limitation of Liability and Exclusion

To the maximum extent permitted by applicable law, in no event shall Huawei be liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages arising out of or in connection with your use of the PyPTO Toolkit under this Agreement, including but not limited to: (i) loss of revenue; (ii) loss of actual or anticipated profits; (iii) loss of use of money; (iv) loss of anticipated savings; (v) loss of business; (vi) loss of opportunity; (vii) loss of goodwill; (viii) loss of use of software; (ix) loss of reputation; (x) loss of, damage to, or corruption of data; or (xi) any other indirect, incidental, special, or consequential damages or losses — whether foreseeable, foreseen, known, or otherwise — even if H has been advised of the possibility of such damages.

### 10. No Warranty

10.1 THE PyPTO TOOLKIT IS PROVIDED “AS IS” WITHOUT WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, OR ANY OTHER WARRANTY ARISING BY STATUTE, COURSE OF DEALING, COURSE OF PERFORMANCE, USAGE OF TRADE, OR OTHERWISE.

10.2 Except to the extent prohibited by applicable law, Huawei does not warrant that the software in the PyPTO Toolkit (including any third-party or open-source software) will be error-free or operate without interruption. Huawei will use reasonable efforts to respond to and provide mitigation or patches for significant software vulnerabilities affecting product usability that are reported during the lifecycle of the PyPTO Toolkit, but does not warrant that Huawei will identify, test, or correct all defects. Furthermore, due to the evolving nature of intrusion and network attack techniques, Huawei does not warrant that the PyPTO Toolkit or any device, system, or network using the PyPTO Toolkit will be free from intrusion or attack.

### 11. Term and Termination

11.1 This Agreement commences upon your acceptance and continues until terminated. Huawei may terminate this Agreement immediately upon written notice if you fail to cure any material breach of this Agreement within thirty (30) days after receiving written notice thereof. You shall be liable for any losses caused to Huawei by such breach, including reasonable attorneys’ fees and litigation costs.

11.2 This Agreement shall automatically terminate upon your initiation of any lawsuit against Huawei or any lawsuit concerning the PyPTO Toolkit itself against any third party.

11.3 You agree to ensure that your customers provide at least the same level of protection to the PyPTO Toolkit as set forth in this Agreement. If any customer of yours violates this Agreement or infringes Huawei’s intellectual property rights in connection with the sale, use, or distribution of software developed by you that incorporates the PyPTO Toolkit, or in connection with the sale or use of Huawei AI processors containing the PyPTO Toolkit, you shall promptly take reasonable measures to stop such violation or infringement. If you fail to take effective measures, Huawei may terminate this Agreement. You shall be liable for any losses caused to Huawei as a result, including reasonable attorneys’ fees and litigation costs.

11.4 In addition to the foregoing liability, Huawei shall be entitled to seek injunctive relief with respect to any such violation or infringement.

11.5 Upon termination of this Agreement, you shall immediately return or destroy all copies of the PyPTO Toolkit and certify such destruction in writing upon Huawei’s request. Any valid distribution of the PyPTO Toolkit made by you prior to the effective date of termination shall remain unaffected by the termination.

11.6 Sections 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, and 14 shall survive any expiration or termination of this Agreement.

### 12. Audit

Upon thirty (30) days’ prior written notice, Huawei may audit your use of the PyPTO Toolkit to verify compliance with this Agreement. The audit may include, but is not limited to, examination of software functionality, applications, backup and archiving records, installation counts, copy counts, and distribution records. Huawei may designate a third-party auditor to conduct such audit on its behalf. You agree to cooperate fully with the audit and provide reasonable assistance, including access to relevant books, records, contracts, technical support documentation, order reports, and systems.

### 13. Export Control

13.1 You agree that the PyPTO Toolkit provided under this Agreement is intended solely for use on Huawei AI processors located within the territory of the People’s Republic of China. If you are an authorized user providing cloud services, you agree to offer services supported by the PyPTO Toolkit only to customers within the People’s Republic of China.

13.2 You acknowledge that the export or re-export of the PyPTO Toolkit or products incorporating the PyPTO Toolkit may be subject to export control laws and regulations. You shall not export or re-export the PyPTO Toolkit or any product incorporating it in violation of such laws or for any prohibited end-use.

### 14. General Provisions

14.1 This Agreement shall be governed by and construed in accordance with the laws of the People’s Republic of China, without regard to its conflict of laws principles. Any dispute arising out of or in connection with this Agreement that cannot be resolved through friendly negotiation shall be submitted to the exclusive jurisdiction of the competent people’s courts in Shenzhen, Guangdong Province, People’s Republic of China.

14.2 If any provision of this Agreement is held to be invalid, illegal, or unenforceable, the parties shall negotiate in good faith to replace such provision with a valid provision that most closely approximates the original intent. The remaining provisions shall continue in full force and effect.
