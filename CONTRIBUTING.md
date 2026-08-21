## 贡献指南

本项目欢迎广大开发者体验并参与贡献。在参与社区贡献之前，请参见[cann-community](https://gitcode.com/cann/community)了解行为准则，进行CLA协议签署，了解源码仓的贡献流程。

开发者准备本地代码与提交PR时需要重点关注如下几点：

1. 提交PR时，请按照PR模板仔细填写本次PR的业务背景、目的、方案等信息。
2. 若您的修改不是简单的bug修复，而是涉及到新增特性、新增接口、新增配置参数或者修改代码流程等，请务必先通过Issue进行方案讨论，以避免您的代码被拒绝合入。若您不确定本次修改是否可被归为"简单的bug修复"，亦可通过提交Issue进行方案讨论。

开发者贡献场景主要包括：

- **Bug修复**：如果您在本项目中发现了某些Bug，希望对其进行修复，欢迎您新建Issue进行反馈和跟踪处理。您可以按照[提交Issue/处理Issue任务](https://gitcode.com/cann/community#%E6%8F%90%E4%BA%A4Issue%E5%A4%84%E7%90%86Issue%E4%BB%BB%E5%8A%A1)指引新建 `Bug-Report|缺陷反馈` 类Issue对Bug进行描述，然后在评论框中输入"/assign"或"/assign @yourself"，将该Issue分配给您进行处理。
- **代码优化**：如果您对本项目中某些功能实现有泛化性增强/性能优化思路，希望着手实现这些优化点，欢迎您进行优化贡献。您可以按照[提交Issue/处理Issue任务](https://gitcode.com/cann/community#%E6%8F%90%E4%BA%A4Issue%E5%A4%84%E7%90%86Issue%E4%BB%BB%E5%8A%A1)指引新建 `Requirement|需求建议` 类Issue对优化点进行说明，并提供您的设计方案，然后在评论框中输入"/assign"或"/assign @yourself"，将该Issue分配给您进行跟踪优化。
- **文档纠错**：如果您在本项目中发现某些文档描述错误，欢迎您新建Issue进行反馈和修复。您可以按照[提交Issue/处理Issue任务](https://gitcode.com/cann/community#%E6%8F%90%E4%BA%A4Issue%E5%A4%84%E7%90%86Issue%E4%BB%BB%E5%8A%A1)指引新建 `Documentation|文档反馈` 类Issue指出对应文档的问题，然后在评论框中输入"/assign"或"/assign @yourself"，将该Issue分配给您纠正对应文档描述。
- **帮助解决他人Issue**：如果社区中他人遇到的问题您有合适的解决方法，欢迎您在Issue中发表评论交流，帮助他人解决问题和痛点，共同优化易用性。如果对应Issue需要进行代码修改，您可以在Issue评论框中输入"/assign"或"/assign @yourself"，将该Issue分配给您，跟踪协助解决问题。

---

## 依赖安装

### 环境要求

| 工具 | 最低版本 | 说明 |
| --- | --- | --- |
| VSCode | >= 1.82.0 | 下载地址：https://code.visualstudio.com/download |
| Node.js | >= 22.13 | 建议使用 LTS 版本 |
| npm | >= 11.0.0 | 随 Node.js 安装 |

### 安装步骤

1. 安装外层依赖：`cd vscode_plugins/pypto_toolkit && npm install`；
2. 安装 vue-project 依赖：`cd media/vue-project && npm install`；

### 远程开发（Linux）

如需在 Linux 机器上远程开发调试，需要在本地 VSCode 中安装官方 [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) 插件，通过 SSH 连接到远程 Linux 机器后进行开发。

---

## 调试启动

用 VSCode 打开 `vscode_plugins/pypto_toolkit` 目录，按 F5 启动调试（选择 `Run Extension` 配置），将自动执行 `npm run watch` 编译并启动扩展开发宿主；

---

## 单元测试

### 测试框架

后端单元测试使用 [Vitest](https://vitest.dev/)，测试在 Node 环境中运行，不需要 VSCode Extension Host。

### 目录结构

```
vscode_plugins/pypto_toolkit/
├── vitest.config.mts          # Vitest 配置（test.alias 指向 vscode mock，setupFiles 全局 mock）
├── test/
│   └── ut/                     # 后端单元测试目录
│       ├── setup.ts            # 全局 mock（vscode、i18next 等 node_modules 包）
│       ├── mocks/
│       │   └── vscode.ts       # vscode API mock（通过 test.alias 引入）
│       └── command/
│           └── registerCommand.test.ts  # 命令注册模块测试
```

测试文件与源码目录结构对应，例如 `src/command/registerCommand.ts` 对应 `test/ut/command/registerCommand.test.ts`。

### Mock 策略

| 模块类型 | Mock 方式 | 说明 |
| --- | --- | --- |
| `vscode` | `test.alias` + `setup.ts` 中 `vi.mock` | vscode 是运行时注入的虚拟模块，通过 `vitest.config.mts` 的 `test.alias` 指向 `test/ut/mocks/vscode.ts`，`setup.ts` 中用 `vi.mock('vscode')` 定义具体内容 |
| `i18next` | `setup.ts` 中 `vi.mock` | 全局 mock，`t()` 直接返回 key |
| 内部模块（`src/view`、`src/utils/file-system` 等） | 测试文件中 `vi.mock(import('...'))` 内联 | 相对路径模块无法用 alias，需在测试文件中逐个 mock |

### 运行命令

```bash
# 运行后端单元测试
npm run test:ut

# 运行后端单元测试并生成覆盖率报告
npx vitest run test/ut --coverage
```

覆盖率报告显示 `src/` 下所有 TypeScript 文件的 Statements、Branches、Functions、Lines 覆盖率及未覆盖行号。

### 编写新测试

1. 在 `test/ut/` 下创建与源码目录结构对应的测试文件，文件名以 `.test.ts` 结尾
2. 如果测试模块依赖 `vscode` API，直接 `import { commands, window, Uri } from 'vscode'`，已由全局 mock 提供
3. 如果测试模块依赖内部模块（如 `src/view`），在测试文件顶部用 `vi.mock(import('../../../src/view'), () => ({...}))` 内联 mock
4. 使用 `vi.hoisted` 创建跨 mock 工厂和测试代码共享的稳定引用

---

## 代码规范与提交检查

### ESLint 代码检查

本项目使用 ESLint 进行代码风格检查，覆盖后端（TypeScript 扩展宿主）和前端（Vue Webview）两部分。

```bash
# 后端代码检查（在 vscode_plugins/pypto_toolkit 目录下）
npm run lint:check        # 仅检查
npm run lint              # 检查并自动修复

# 前端代码检查（在 media/vue-project 目录下）
npm run lint:check        # 仅检查，0 warning 容忍
npm run lint              # 检查并自动修复

# 类型检查
npm run check             # 后端 + 前端类型检查
```

### Commit Message 规范

本项目使用 [commitlint](https://commitlint.js.org/) + [husky](https://typicode.github.io/husky/) 在提交时自动校验 Commit Message 格式。开发者在提交代码前**必须**遵循以下规范。

允许的 type 类型：

| type | 说明 |
| --- | --- |
| feat | 新特性 |
| fix | Bug修复 |
| docs | 文档变更 |
| style | 代码格式（不影响功能） |
| refactor | 重构（既不是新增特性也不是修复Bug） |
| perf | 性能优化 |
| test | 测试相关 |
| build | 构建系统或外部依赖变更 |
| release | 发布相关 |
| chore | 其他杂项 |
| revert | 回退提交 |

格式：`type(scope): subject`

约束：
- type 和 subject 不能为空
- header 最大长度 88 字符

示例：

```
feat(graph): 支持计算图节点搜索高亮
fix(swimlane): 修复泳道图导出时节点丢失问题
docs(readme): 更新安装说明
```

---

## 依赖参考文档

1. 当前elkJs使用布局策略为layered，相关配置文档： https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
2. sprotty使用文档： https://sprotty.org/docs/learn/data-model/
