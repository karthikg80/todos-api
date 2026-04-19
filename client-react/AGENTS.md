# React Client

Vite + React + TypeScript.

## Commands

```bash
npm run dev     # Development server
npm run build   # Production build (tsc -b && vite build)
```

## Shared Contract

Consumes transport DTOs from the backend. Per [ADR-006](../docs/adr/006-transport-contract-source-of-truth.md), transport DTOs are defined by Zod schemas in root `src/transport/` and their inferred TS types are what this client imports. `src/types.ts` is canonical for backend domain types only — never consume it directly from the client (it uses `Date` objects that never cross the wire).

Until Story 1.2 lands, `client-react/src/types/index.ts` still holds duplicated hand-written transport types. When the shared contract changes, check if those need matching updates.
