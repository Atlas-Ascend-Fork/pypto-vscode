# PyPTO Toolkit

## 调试启动

1. 安装外层依赖：`cd vscode_plugins/pypto_toolkit && npm install`；
2. 安装 vue-project 依赖：`cd media/vue-project && npm install`；
3. 用 VSCode 打开 `vscode_plugins/pypto_toolkit` 目录，按 F5 启动调试（选择 `Run Extension` 配置），将自动执行 `npm run watch` 编译并启动扩展开发宿主；

## 项目结构

```
pypto-tools-pkg/                      # 仓库根目录
├── vscode_plugins/
│   └── pypto_toolkit/                # VSCode 扩展主模块
│       ├── .vscode/
│       │   └── launch.json           # 调试配置（Run Extension，preLaunchTask 为 npm: watch）
│       ├── media/                    # webview 前端资源
│       │   ├── images/               # 图标等静态图片
│       │   └── vue-project/          # Vue3 前端工程
│       │       ├── vite.config.ts
│       │       └── src/
│       │           ├── App.vue       # webview 入口，获取 vscode 数据及事件并分发给不同图形
│       │           ├── main.ts
│       │           ├── apis/         # 前端请求封装
│       │           ├── components/   # 图形组件及子组件
│       │           │   ├── comGraph/         # 计算图
│       │           │   ├── swimGraph/        # 泳道图（含 header / timeline / processes / detail 等子组件）
│       │           │   ├── controlFlowGraph/ # 控制流图
│       │           │   ├── diffComGraph/     # 计算图差异对比
│       │           │   ├── threeColumn/      # 三栏联动
│       │           │   ├── sideBar/          # 侧边栏
│       │           │   ├── welcome/          # 欢迎引导
│       │           │   ├── opCheck/          # 算子校验
│       │           │   ├── runConfig/        # 运行配置
│       │           │   ├── exportModal/      # 导出弹窗
│       │           │   ├── navbar/           # 顶部导航
│       │           │   ├── ui/               # 通用 UI 组件
│       │           │   ├── icons/            # 图标组件
│       │           │   └── util/             # 组件公共方法
│       │           ├── core/         # 前端请求实例（request.ts）
│       │           ├── sprotty-graph/ # 计算图布局及渲染，依赖 sprotty 和 elkjs
│       │           │   ├── di.config.ts     # 依赖注入配置（自定义节点、布局函数）
│       │           │   ├── jsonGraph.ts     # 原始 json 数据 → 图形数据
│       │           │   └── main.ts          # 布局算法入口，导出初始化/定位/更新等函数
│       │           ├── hooks/        # 组合式函数
│       │           ├── i18n/         # 前端国际化（en / zh / index）
│       │           ├── theme/        # 主题
│       │           ├── service/      # 前端业务服务
│       │           ├── utils/        # 前端工具方法
│       │           └── static-assets/ # 静态资源（logo.svg 等）
│       ├── scripts/                  # 构建脚本（clean-output / copy-wasm / check-env）
│       ├── src/                      # 插件后端（TypeScript）
│       │   ├── extension.ts          # 插件入口文件
│       │   ├── command/              # 命令注册、事件监听
│       │   │   └── registerCommand.ts
│       │   ├── view/                 # 视图层
│       │   │   ├── index.ts          # 视图入口（初始化和打开指定视图）
│       │   │   ├── routes.ts         # 视图路由
│       │   │   ├── graphView.ts      # 计算图后端
│       │   │   ├── swimGraphView.ts  # 泳道图后端
│       │   │   ├── threeColumnEntry.ts        # 三栏联动入口
│       │   │   ├── SidebarViewProvider.ts     # 侧边栏 webview
│       │   │   └── pyptoJitCodeLensProvider.ts # CodeLens 提供者
│       │   ├── core/                 # 插件端核心功能
│       │   │   ├── connector.ts      # 前后端通信
│       │   │   ├── request-server.ts # API 服务实例
│       │   │   ├── store/            # SQLite 缓存存储
│       │   │   ├── sqliteCache.ts    # 图数据持久化
│       │   │   └── editorView/       # 编辑区自定义 webview
│       │   ├── services/             # 业务服务
│       │   │   ├── control-flow/     # 控制流解析（PATH 解析/树构建）
│       │   │   ├── run-data/         # 运行数据
│       │   │   ├── schema-config/    # schema 配置
│       │   │   ├── welcome/          # 欢迎引导
│       │   │   └── index.ts          # 服务聚合导出
│       │   ├── handler/              # 消息处理（baseGraphMsgHandler / singleGraphHandler / diffGraphHandler 等）
│       │   ├── converter/            # 数据转换器
│       │   ├── types/                # 类型定义
│       │   ├── common/               # 公共常量与工具
│       │   ├── config/               # 配置
│       │   ├── utils/                # 后端工具方法
│       │   └── util.ts               # 工具类公共函数
│       ├── package.json              # 项目配置与脚本
│       ├── package.nls.json          # 国际化配置（英文）
│       ├── package.nls.zh-cn.json    # 国际化配置（中文）
│       ├── tsconfig.json             # TypeScript 配置
│       ├── commitlint.config.js      # commit 规范校验
│       └── CHANGELOG.md              # 版本发布记录
├── docs/                             # Sphinx 文档
├── LICENSE
├── README.md
├── README.en.md
└── CONTRIBUTING.md
```

## vue-project代码开发注意点

1. 静态资源用window上的staticPath拼接，保障打包和调试的资源引入正确 `${staticPath}/static-assets/logo.svg`;

## 注册和使用自定义视图

### 注册路由
/src/view/routes.ts 配置详见ts类型提示

### 打开视图

``` typescript
import { useView } from '/src/views';

const { editorView } = useView();
const uri = vscode.Uri.file('文件路径');
const webviewPanel = await editorView.open('视图类型', uri);
```

## 前后端数据请求

### 后端服务

服务实例 /src/core/request-server.ts

API实现 /src/services

``` typescript
// 启动API服务：src/extension.ts
const server = new ExtensionApiServer(services);
```
新增模块需要在/src/services/index.ts补充至services

``` typescript
// src/services/index.ts
import * as controlFlow from './control-flow';
import * as workspace from './workspace';

export const services = {
  // 控制流
  controlFlow,
  // 工作区
  workspace,
};
```

### 前端请求

请求实例 /media/vue-project/src/core/request.ts

封装请求方法 /media/vue-project/src/apis

``` typescript
import { request } from '../core/request.ts';

request.post('模块/方法', params).then((res) => {
  // 请求响应
});
```

## 依赖参考文档

1. 当前elkJs使用布局策略为layered，相关配置文档： https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
2. sprotty使用文档： https://sprotty.org/docs/learn/data-model/