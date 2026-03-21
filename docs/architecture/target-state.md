# Target Architecture

## Frontend target structure

```
client/
├── app.js                          ← Thin: imports bootstrap + calls init()
├── bootstrap/
│   ├── initApp.js                  ← Top-level app initialization
│   ├── initShell.js                ← Shell/layout (header, nav, theme)
│   └── initGlobalListeners.js      ← Global event listeners, keyboard shortcuts
├── platform/
│   ├── events/
│   │   ├── eventBus.js             ← Pub-sub (existing, moved here)
│   │   └── eventTypes.js           ← Canonical event name constants
│   ├── state/
│   │   ├── createStore.js          ← Reusable store factory
│   │   └── createSelector.js       ← Derived state helpers
│   ├── dom/
│   │   ├── query.js                ← DOM query utilities (from domSelectors.js)
│   │   └── events.js               ← Event delegation helpers
│   └── http/
│       └── apiClient.js            ← Centralized API client (from utils/)
├── features/
│   ├── todos/
│   │   ├── initTodosFeature.js     ← Owns todo listeners/subscriptions
│   │   ├── todoActions.js          ← State mutations (extracted from stateActions.js)
│   │   ├── todoSelectors.js        ← Derived state (filtered todos, etc.)
│   │   ├── todoApi.js              ← API calls (from todosService.js)
│   │   └── views/
│   │       ├── todoListView.js     ← List rendering (from filterLogic.js)
│   │       └── todoItemView.js     ← Row rendering + patches (from todosViewPatches.js)
│   ├── projects/
│   │   ├── initProjectsFeature.js
│   │   ├── projectActions.js
│   │   ├── projectSelectors.js
│   │   ├── projectApi.js
│   │   └── views/
│   ├── drawer/
│   │   ├── initDrawerFeature.js
│   │   ├── drawerStore.js
│   │   ├── drawerActions.js
│   │   └── views/
│   ├── command-palette/
│   │   ├── initCommandPaletteFeature.js
│   │   └── commandPaletteView.js
│   ├── agent/
│   │   ├── initAgentFeature.js
│   │   ├── agentActions.js
│   │   ├── agentApi.js
│   │   └── agentPolling.js
│   ├── assistant/
│   │   ├── initAssistantFeature.js
│   │   └── assistantApi.js
│   └── capture/
│       ├── initCaptureFeature.js
│       └── captureApi.js
├── shared/
│   ├── components/
│   └── constants/
└── utils/                          ← Existing (no change)
```

## Backend target structure

```
src/
├── app.ts                          ← Express assembly (existing, thinner)
├── server.ts                       ← Entry point (existing)
├── config.ts                       ← Environment config (existing)
├── domains/
│   ├── core/
│   │   ├── todos/
│   │   │   ├── todoService.ts
│   │   │   ├── todoRepository.ts
│   │   │   └── todoValidators.ts
│   │   ├── projects/
│   │   │   ├── projectService.ts
│   │   │   └── projectRepository.ts
│   │   └── users/
│   │       ├── authService.ts
│   │       └── userRepository.ts
│   ├── assistant/
│   │   ├── suggestions/
│   │   ├── chat/
│   │   └── prompts/
│   ├── agent/
│   │   ├── runs/
│   │   │   ├── agentRunService.ts
│   │   │   └── agentRunRepository.ts
│   │   ├── actions/
│   │   │   ├── coreActionHandler.ts
│   │   │   ├── assistantActionHandler.ts
│   │   │   └── agentActionHandler.ts
│   │   ├── audits/
│   │   └── executor.ts             ← Thin dispatcher (< 500 lines)
│   └── mcp/
│       ├── sessions/
│       ├── tools/
│       └── transport/
├── infra/
│   ├── db/
│   │   └── prisma.ts
│   ├── queue/                      ← If BullMQ adopted (pending ADR-005)
│   ├── logging/
│   │   └── logger.ts
│   ├── metrics/
│   │   └── metrics.ts
│   └── config/
│       └── env.ts
├── routes/                         ← Existing (unchanged)
├── middleware/                      ← Existing (unchanged)
├── workers/
│   └── agentWorker.ts              ← If local worker adopted (pending ADR-005)
└── interfaces/                     ← Existing (unchanged)
```

## Conventions

### Event naming

Format: `{domain}.{entity}.{past-tense-verb}` or `{domain}.{action}`

```
todo.created        todo.updated        todo.deleted        todo.completed
project.selected    project.created     project.deleted
drawer.opened       drawer.closed
capture.created
agent.run.requested agent.run.started   agent.run.completed agent.run.failed
```

### State mutation rules

1. State changes happen through named actions (`applyDomainAction`, `applyUiAction`, etc.)
2. Direct `state.X = value` is allowed **within** the action function only
3. Views read from selectors, not directly from `state`
4. Cross-feature communication goes through EventBus, not direct function calls
5. Direct function calls are allowed **within** a feature module

### Frontend module ownership

| Owner | Modules |
|-------|---------|
| Todos feature | todoActions, todoSelectors, todoApi, todoListView, todoItemView |
| Projects feature | projectActions, projectSelectors, projectApi, projectViews |
| Drawer feature | drawerStore, drawerActions, drawerViews |
| Shell | bootstrap/*, platform/*, command palette, shortcuts, responsive layout |
| AI/Assistant | aiWorkspace, onCreateAssist, taskDrawerAssist, homeAiService |
| Agent | agentApi, agentPolling, agentStore |

### Backend domain ownership

| Domain | Services |
|--------|----------|
| Core (todos, projects, users) | todoService, projectService, authService, headingService |
| Assistant | aiService, aiSuggestionStore, aiApplyService, aiNormalizationService, decisionAssist* |
| Agent | agentExecutor, agentJobRunService, agentAuditService, agentIdempotencyService, agentMetricsService |
| MCP | mcpOAuthService, mcpClientService, mcpAuth, mcpToolCatalog |
| Infra | prismaClient, rateLimitMiddleware, errorHandling, config |
