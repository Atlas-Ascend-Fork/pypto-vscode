# 项目知识库

**生成时间**: 2025-05-19
**Commit**: e11ae8a6
**分支**: mix

## 概览

PyPTO Toolkit - 华为PyPTO框架VSCode可视化插件。为AI算子开发者提供计算图、泳道图、控制流可视化及三栏联动调试能力。**核心语言栈: TypeScript + Vue.js**（非Python项目）。

## 结构

```
pypto-tools/
├── vscode_plugins/
│   └── pypto_toolkit/          # VSCode扩展主模块
│       ├── src/                # TypeScript源码 (100+文件)
│       │   ├── extension.ts    # 扩展入口
│       │   ├── view/           # 视图提供者
│       │   ├── services/       # 业务服务
│       │   ├── core/           # 核心存储
│       │   ├── handler/        # 消息处理
│       │   ├── converter/      # 数据转换器
│       │   └── types/          # 类型定义
│       ├── media/vue-project/  # Vue前端 (100+文件)
│       ├── package.json        # 扩展配置
│       └── tsconfig.json       # TypeScript配置
├── docs/                       # Sphinx文档
│   ├── Makefile                # 文档构建入口
│   ├── requirements.txt        # Sphinx依赖
│   └── zh/                     # 中文文档
│       ├── conf.py             # 文档构建配置
│       └── index.md            # 文档首页
└── README.md
```

## 查找指南

| 任务 | 位置 | 说明 |
|------|------|------|
| 扩展入口 | `vscode_plugins/pypto_toolkit/src/extension.ts` | activate()初始化服务/视图/命令 |
| 命令注册 | `vscode_plugins/pypto_toolkit/src/command/registerCommand.ts` | VSCode命令映射 |
| 计算图视图 | `vscode_plugins/pypto_toolkit/src/view/graphView.ts` | ComGraph渲染 |
| 泳道图视图 | `vscode_plugins/pypto_toolkit/src/view/swimGraphView.ts` | Swimlane渲染 |
| 三栏联动 | `vscode_plugins/pypto_toolkit/src/view/threeColumnEntry.ts` | 代码-计算图-泳道图联动 |
| 控制流服务 | `vscode_plugins/pypto_toolkit/src/services/control-flow/` | PATH解析/树构建 |
| SQLite缓存 | `vscode_plugins/pypto_toolkit/src/core/store/sql-store/` | 图数据持久化 |
| Vue前端 | `vscode_plugins/pypto_toolkit/media/vue-project/src/` | Webview组件 |
| 文档构建 | `docs/` | Sphinx文档 |

## 约定

### TypeScript
- **行宽**: 140字符 (ESLint + Prettier一致)
- **缩进**: 2空格
- **分号**: 必须
- **引号**: 单引号
- **尾逗号**: 全部 (ES5兼容)
- **装饰器**: 开启 (`experimentalDecorators`)

### Python (有限)
- 仅4个Python文件，无pyproject.toml
- **编码**: `# coding: utf-8`
- **文档**: Google/Numpy风格docstring
- **类型**: 使用类型注解
- **CLI**: argparse标准库

### 命名
- 文件: 小写+连字符 (`swim-graph-view.ts`)
- 类: PascalCase (`SwimGraphView`)
- 方法: camelCase (`loadMainData`)
- 常量: UPPER_SNAKE_CASE

## 反模式

### 避免全局State缓存
```typescript
// @deprecated 尽量避免使用state缓存，容易导致全局冲突
// media/vue-project/src/core/state.ts
```

### 子类必须覆盖
```typescript
// src/handler/baseGraphMsgHandler.ts
throw new Error('子类必须覆盖 loadMainData 方法');
throw new Error('子类必须覆盖 getGraphData 方法');
```

## 唯特风格

### 双构建系统
- npm scripts → TypeScript编译
- Vite → Vue webview热更新
- 同步执行: `npm run compile` 先Vue后TS

### 静态资源路径
```typescript
// Vue前端必须用window.staticPath拼接
const iconPath = `${window.staticPath}/icons/...`
```

### 模块懒加载
- 服务按需启动 (`startAllServices`)
- 视图延迟注册 (`initView`)
- SQLite缓存首次加载清理 (`globalState`)

## 命令

```bash
# 开发模式 (热更新)
cd vscode_plugins/pypto_toolkit && npm run watch

# 构建
npm run compile

# 文档构建
cd docs && make html
```

## 注意事项

- **非Python项目**: 名称误导，实为TS+Vue扩展
- **环境依赖**: 运行需CANN环境 + NPU设备
- **Git LFS**: 预发布时自动拉取 (`vscode:prepublish`)
- **版本检查**: 启动5秒后检测旧版本并自动卸载
- **缓存清理**: 新版本首次使用清空SQLite缓存
- **Webview调试**: 浏览器可见故障使用`webview-debugger`和`pypto-webview-debugging`，通过Vite、Playwright CLI、真实数据和模拟消息桥验证，不启动VS Code
- **命令接线验证**: 使用`webview-command-contract-testing`检查manifest、命令注册、URI参数和View Server配置；界面行为单独使用浏览器验证
- **界面验证**: GM内存Webview使用`test/fixtures/memory_usage_visualization.json`进行独立浏览器验证，并记录DOM、Canvas、截图、控制台和网络证据
- **GM内存快速测试**: 修改`memoryUsage/`后在扩展目录运行`npm run test:memory`
- **GM内存浏览器测试**: 运行`npx playwright install chromium`后使用`npm run test:gm-e2e`
- **GM内存扩展测试**: 修改命令、View Server或Webview接线后运行`npm run test:gm-smoke`
- **完整测试**: 在扩展目录运行`npm test`，依次执行Vitest、Playwright和VS Code Extension Host测试
- **依赖安装**: 项目不提交npm lockfile，使用`npm install`而不是`npm ci`
