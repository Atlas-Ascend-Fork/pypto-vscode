# PyPTO Toolkit

## 调试启动

1. 安装外层依赖： `npm install vite -g && npm install`;
2. 安装vue-project依赖： `cd media/vue-project && npm install`;
3. 进入comGraphView.js和swimGraphView.js文件，解开本地调试方案的注释；
4. 启动vue项目：在根目录执行 `npm run dev:webview`；
5. 按F5启动调试；

## 项目结构

|-- .vscode
    |-- launch.json  # 调试器相关配置
|-- media  # webview前端相关内容
    |-- css
    |   |-- comGraph  # 计算图相关的css配置
    |-- js
    |   |-- comGraph  # 计算图相关的js代码
    |-- pages
    |   |-- comGraph  # 计算图的html文件
    |-- vue-project
    |   |-- vite.config.ts
    |   |-- src
    |   |   |-- App.vue  # webView页面入口，在此处获取vscode数据及事件，分发给不同图形
    |   |   |-- main.ts
    |   |   |-- components # 封装的图形组件及其子组件
    |   |   |   |-- swimGraph # 泳道图
    |   |   |   |   |-- swimGraph.vue
    |   |   |   |   |-- swimGraphComplete.vue
    |   |   |   |   |-- swimGraphUtils.ts # 泳道图公共方法
    |   |   |   |   |-- swimGraphDetail # 泳道图详情
    |   |   |   |       |-- swimGraphDetail.vue
    |   |   |   |   |-- swimGraphHeader # 泳道图的header区域
    |   |   |   |       |-- swimGraphHeader.vue
    |   |   |   |   |-- swimGraphProcesses # 泳道图的进程和线程区域
    |   |   |   |       |-- swimGraphProcesses.vue
    |   |   |   |       |-- swimGraphProcessHeader.vue #泳道图的进程头部
    |   |   |   |       |-- swimGraphThreadEvents.vue  #泳道图的线程标签
    |   |   |   |       |-- swimGraphThreadLabels.vue  #泳道图的线程事件
    |   |   |   |   |-- swimGraphTimeline # 泳道图的时间轴区域
    |   |   |   |       |-- swimGraphTimeline.vue
    |   |   |   |-- comGraph # 计算图
    |   |   |       |-- comGraph.vue
    |   |   |       |-- comGraphHeader.vue # 计算图的header区域
    |   |   |       |-- comGraphMinimap.vue # 计算图的缩略图组件
    |   |   |-- sprotty-graph # 计算图布局及渲染代码，依赖sprotty和elkJs
    |   |   |   |-- di.config.ts # 通过依赖注入配置图形（自定义节点，布局函数配置）
    |   |   |   |-- jsonGraph.ts # 将原始json数据转换为图形数据的类
    |   |   |   |-- main.ts # 布局算法的入口文件，执行useSprottyLoad函数返回初始化，定位，更新，操作等函数，所有函数封装后从此处导出
    |   |   |   |-- menu.ts # tip实现代码，暂未适配，后续tip在vue组件层实现
    |   |   |   |-- views.tsx # 图形自定义类，不同类型的节点样式在此处封装
    |   |   |   |-- style
    |   |   |       |-- diagram.css # 计算图节点的样式
    |   |   |-- static-assets # 静态资源位置
    |   |   |   |-- logo.svg
    |   |   |-- i18n  # 前端国际化配置
    |   |   |   |-- en.ts
    |   |   |   |-- index.ts
    |   |   |   |-- zh.ts
|-- src  # 插件后端内容
    |-- command  # 命令注册, 事件监听
    |   |-- registerCommand.ts  # 注册命令
    |-- view  # 视图层
    |   |-- comGraphView.ts  # 计算图后端代码
    |   |-- swimGraphView.ts  # 泳道图后端代码
    |-- extension.ts  # 插件入口文件
    |-- hismartliteEx.ts  # 全局变量配置
    |-- util.ts  # 工具类公共函数
|-- .elintrc.json  # eslint配置
|-- .eslintignore  # eslint忽略文件
|-- .gitignore  # git忽略文件
|-- .prettierc  # prettier插件的格式化配置
|-- .vscodeignore  # 打包时的忽略文件
|-- package.json  # 项目配置
|-- package.nls.json  # 国际化配置(英文)
|-- package.nls.zh-cn.jfon  # 国际化配置(中文)
|-- CHANGELOG.md  # 版本发布记录
|-- README.en.md  # 插件介绍(英文)
|-- README.md  # 插件介绍
|-- tsconfig.json  # ts语言设置
|-- commitlint.config.js  # commit规范校验

## vue-project代码开发注意点

1. 静态资源用window上的staticPath拼接，保障打包和调试的资源引入正确 `${staticPath}/static-assets/logo.svg`;

## 依赖参考文档

1. 当前elkJs使用布局策略为layered，相关配置文档： https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html;
2. sprotty使用文档： https://sprotty.org/docs/learn/data-model/；