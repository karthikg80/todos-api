# React Client

Vite + React + TypeScript.

## Commands

```bash
npm run dev     # Development server
npm run build   # Production build (tsc -b && vite build)
```

## Shared Contract

Consumes the same REST API as the vanilla client and iOS app. `src/types.ts` (in repo root) is the source of truth. When API types change, check if React types/interfaces need matching updates.
