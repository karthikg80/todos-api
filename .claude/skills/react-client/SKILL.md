---
name: react-client
description: Conventions for the React web client in client-react/
---

# React Client Conventions

## Stack

- Vite + React + TypeScript
- Separate `package.json` from root project

## Commands

```bash
cd client-react
npm run dev     # Development server
npm run build   # Production build (tsc -b && vite build)
```

## Shared Contract

The React client consumes transport DTOs, not backend domain types. Per [ADR-006](../../../docs/adr/006-transport-contract-source-of-truth.md), transport DTOs are defined by Zod schemas in `src/transport/` (backend); their inferred TS types are what the React client imports. `src/types.ts` is canonical for backend domain types only (uses `Date` objects that never cross the wire).

When the shared contract changes, check if the React transport types need matching updates. Until Story 1.2 lands, `client-react/src/types/index.ts` still holds duplicated hand-written transport types.
