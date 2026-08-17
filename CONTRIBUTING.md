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

## 代码规范与提交检查

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

---

## 调试启动

1. 安装外层依赖：`cd vscode_plugins/pypto_toolkit && npm install`；
2. 安装 vue-project 依赖：`cd media/vue-project && npm install`；
3. 用 VSCode 打开 `vscode_plugins/pypto_toolkit` 目录，按 F5 启动调试（选择 `Run Extension` 配置），将自动执行 `npm run watch` 编译并启动扩展开发宿主；

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
