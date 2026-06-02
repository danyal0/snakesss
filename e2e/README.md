# Snakesss E2E (Playwright)

Exhaustive UI validation for the web client and admin panel.

## Quick start

```bash
npm install
npx playwright install chromium firefox webkit

# Chromium CI suite (default)
npm run test:e2e

# All browser × device projects
npm run test:e2e:all

# Update pixel baselines (Chromium)
npm run test:e2e:update
```

## Architecture

| Piece | Purpose |
|-------|---------|
| `playwright.config.ts` | Multi-browser (Chromium, Firefox, WebKit), iPhone Pro, iPad, desktop HD |
| `apps/server/src/E2ETestAPI.ts` | Test-only REST (`E2E_TEST=1`): reset, seed, rooms, force-phase |
| `apps/web/src/testHarness.ts` | `window.__SNAKESS_TEST__` — store, motion, idle, DOM audit |
| `e2e/fixtures/` | Room bootstrap, page objects, state reset |
| `e2e/utils/` | Pixel compare, network throttle, animation sync, reporting |
| `e2e/baselines/` | Screenshot baselines per project |

## Coverage map

- **Pixel**: Home, admin, leaderboard, create-room form (strict ≤1px where stable)
- **Interactions**: Clicks, keyboard, lobby tabs, gestures
- **Lifecycle**: Refresh, idle, visibility
- **Flows**: Player, manager, spectator, admin
- **Dead UI**: DOM vs interaction audit via test harness
- **Errors**: Disconnect, validation, invalid routes

Reports: `e2e/report/summary.json`, `interaction-heatmap.json`, HTML report in `e2e/report/html/`.
