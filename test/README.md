# GM Memory Tests

The GM memory feature has three test layers with separate responsibilities.

## Vitest

Location: `media/vue-project/src/components/memoryUsage/__tests__/`

Vitest covers deterministic data processing, conflict detection, generated chart options, tensor tabs, filtering, zoom calculations, cleanup, and Webview API calls.

Run the focused suite from the extension directory:

```bash
npm run test:memory
```

The unit fixture is `memory-unit-fixture.ts`. It is intentionally small and programmatic so individual edge cases can be changed without maintaining a large JSON file.

## Playwright

Location: `test/e2e/`

Playwright covers browser-only behavior: Canvas rendering, representative tensor and conflict selection, filtering and zoom interaction, responsive layout, screenshots, and runtime health.

The suite uses `test/fixtures/memory_usage_visualization.json`. This is a moderate, intentionally designed fixture and is not a production trace. Its filename matches the extension command contract. The production-sized documentation dataset is not required by tests and must not be added as a test dependency.

Install the managed browser once:

```bash
npx playwright install chromium
```

Run the browser suite:

```bash
npm run test:gm-e2e
```

## VS Code Smoke Test

Location: `src/test/gm-memory/`

The Extension Host test covers extension activation, command registration, fixture loading, custom editor creation, Webview readiness, and closing the tab. It does not duplicate detailed browser interactions.

Run it with a clean build:

```bash
npm run test:gm-smoke
```

## Full Suite

Run all three layers with one Webview build:

```bash
npm test
```

The project intentionally does not commit npm lockfiles. Use `npm install`, not `npm ci`.
