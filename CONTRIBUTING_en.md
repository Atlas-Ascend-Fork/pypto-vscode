## Contributing Guide

This project welcomes developers to experience and participate in contributions. Before participating in community contributions, refer to [cann-community](https://gitcode.com/cann/community) to understand the code of conduct, sign the CLA agreement, and learn the contribution process for the source code repository.

Developers must focus on the following points when preparing local code and submitting PRs:

1. When you submit a PR, follow the PR template to carefully fill in the business background, purpose, and solution of the PR.
2. If your modification is not a simple bug fix, but involves new features, new interfaces, new configuration parameters, or modification of code flows, you must first initiate a solution discussion through an Issue to avoid your code being rejected. If you are unsure whether your modification can be classified as a "simple bug fix", you can also submit an Issue for solution discussion.

The main contribution scenarios for developers include:

- **Bug fix**: If you find bugs in this project and want to fix them, create an Issue to report and track the processing. Follow the [提交Issue/处理Issue任务](https://gitcode.com/cann/community#%E6%8F%90%E4%BA%A4Issue%E5%A4%84%E7%90%86Issue%E4%BB%BB%E5%8A%A1) guide to create a `Bug-Report|缺陷反馈` Issue to describe the bug, then enter "/assign" or "/assign @yourself" in the comment box to assign the Issue to yourself for processing.
- **Code optimization**: If you have ideas for generalization enhancements or performance optimization for certain feature implementations in this project, and want to implement these optimizations, you are welcome to contribute. Follow the [提交Issue/处理Issue任务](https://gitcode.com/cann/community#%E6%8F%90%E4%BA%A4Issue%E5%A4%84%E7%90%86Issue%E4%BB%BB%E5%8A%A1) guide to create a `Requirement|需求建议` Issue to describe the optimization points and provide your design solution, then enter "/assign" or "/assign @yourself" in the comment box to assign the Issue to yourself for tracking the optimization.
- **Documentation correction**: If you find errors in the documentation of this project, create an Issue to report and fix them. Follow the [提交Issue/处理Issue任务](https://gitcode.com/cann/community#%E6%8F%90%E4%BA%A4Issue%E5%A4%84%E7%90%86Issue%E4%BB%BB%E5%8A%A1) guide to create a `Documentation|文档反馈` Issue to point out the documentation problems, then enter "/assign" or "/assign @yourself" in the comment box to assign the Issue to yourself to correct the documentation.
- **Help resolve Issues of others**: If you have a suitable solution for problems encountered by others in the community, comment in the Issue to communicate and help others solve their problems and pain points, and jointly optimize usability. If the Issue requires code modification, enter "/assign" or "/assign @yourself" in the Issue comment box to assign the Issue to yourself to track and assist in resolving the problem.

---

## Code Standards and Submission Checks

### Commit Message Standards

This project uses [commitlint](https://commitlint.js.org/) + [husky](https://typicode.github.io/husky/) to automatically validate the Commit Message format during submission. Developers **must** follow the standards below before submitting code.

Allowed types:

| type | Description |
| --- | --- |
| feat | New feature |
| fix | Bug fix |
| docs | Documentation changes |
| style | Code format (does not affect functionality) |
| refactor | Refactor (neither a new feature nor a bug fix) |
| perf | Performance optimization |
| test | Testing related |
| build | Build system or external dependency changes |
| release | Release related |
| chore | Other miscellaneous |
| revert | Revert commit |

Format: `type(scope): subject`

Constraints:
- type and subject cannot be empty
- The header has a maximum length of 88 characters

Samples:

```
feat(graph): support computation graph node search highlighting
fix(swimlane): fix node loss issue during swimlane diagram export
docs(readme): update installation instructions
```

### ESLint Code Check

This project uses ESLint for code style checks, covering both the backend (TypeScript extension host) and frontend (Vue Webview).

```bash
# Backend code check (in the vscode_plugins/pypto_toolkit directory)
npm run lint:check        # Check only
npm run lint              # Check and auto-fix

# Frontend code check (in the media/vue-project directory)
npm run lint:check        # Check only, 0 warning tolerance
npm run lint              # Check and auto-fix

# Type check
npm run check             # Backend + frontend type check
```

---

## Unit Testing

### Test Framework

Backend unit tests use [Vitest](https://vitest.dev/). Tests run in the Node environment and do not require the VSCode Extension Host.

### Directory Structure

```
vscode_plugins/pypto_toolkit/
├── vitest.config.mts          # Vitest config (test.alias points to vscode mock, setupFiles for global mocks)
├── test/
│   └── ut/                     # Backend unit test directory
│       ├── setup.ts            # Global mocks (vscode, i18next, and other node_modules packages)
│       ├── mocks/
│       │   └── vscode.ts       # vscode API mock (imported via test.alias)
│       └── command/
│           └── registerCommand.test.ts  # Command registration module tests
```

Test files follow the source code directory structure, e.g. `src/command/registerCommand.ts` corresponds to `test/ut/command/registerCommand.test.ts`.

### Mock Strategy

| Module Type | Mock Method | Description |
| --- | --- | --- |
| `vscode` | `test.alias` + `vi.mock` in `setup.ts` | vscode is a runtime-injected virtual module. `vitest.config.mts` uses `test.alias` to point to `test/ut/mocks/vscode.ts`, and `setup.ts` uses `vi.mock('vscode')` to define the content |
| `i18next` | `vi.mock` in `setup.ts` | Global mock, `t()` directly returns the key |
| Internal modules (`src/view`, `src/utils/file-system`, etc.) | Inline `vi.mock(import('...'))` in test files | Relative path modules cannot use alias; must be mocked individually in each test file |

### Commands

```bash
# Run backend unit tests
npm run test:ut

# Run backend unit tests with coverage report
npx vitest run test/ut --coverage
```

The coverage report shows Statements, Branches, Functions, and Lines coverage for all TypeScript files under `src/`, along with uncovered line numbers.

### Writing New Tests

1. Create a test file under `test/ut/` matching the source code directory structure, with a `.test.ts` extension
2. If the module under test depends on `vscode` API, directly `import { commands, window, Uri } from 'vscode'` — the global mock provides these
3. If the module under test depends on internal modules (e.g. `src/view`), use `vi.mock(import('../../../src/view'), () => ({...}))` at the top of the test file
4. Use `vi.hoisted` to create stable references shared between mock factories and test code

---

## Debug Startup

1. Install outer dependencies: `cd vscode_plugins/pypto_toolkit && npm install`;
2. Install vue-project dependencies: `cd media/vue-project && npm install`;
3. Open the `vscode_plugins/pypto_toolkit` directory in VSCode, press F5 to start debugging (select the `Run Extension` configuration), which will automatically execute `npm run watch` to compile and start the extension development host;

## Notes on vue-project Code Development

1. Use staticPath on window to concatenate static assets to ensure correct resource import during packaging and debugging `${staticPath}/static-assets/logo.svg`;

## Register and Use Custom Views

### Register Routes
For the configuration of /src/view/routes.ts, refer to the TypeScript type hints.

### Open a View

``` typescript
import { useView } from '/src/views';

const { editorView } = useView();
const uri = vscode.Uri.file('file path');
const webviewPanel = await editorView.open('view type', uri);
```

## Frontend and Backend Data Requests

### Backend Services

Service instance /src/core/request-server.ts

API implementation /src/services

``` typescript
// Start API service: src/extension.ts
const server = new ExtensionApiServer(services);
```
Add new modules to services in /src/services/index.ts

``` typescript
// src/services/index.ts
import * as controlFlow from './control-flow';
import * as workspace from './workspace';

export const services = {
  // Control flow
  controlFlow,
  // Workspace
  workspace,
};
```

### Frontend Requests

Request instance /media/vue-project/src/core/request.ts

Encapsulated request methods /media/vue-project/src/apis

``` typescript
import { request } from '../core/request.ts';

request.post('module/method', params).then((res) => {
  // Request response
});
```

## Dependency Reference Documentation

1. The current layout strategy used by elkJs is layered. For the related configuration documentation, refer to: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
2. sprotty usage documentation: https://sprotty.org/docs/learn/data-model/
