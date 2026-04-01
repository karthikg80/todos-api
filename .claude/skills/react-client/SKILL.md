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

The React client consumes the same REST API as the vanilla client and iOS app. `src/types.ts` is the source of truth for all API types.

When `src/types.ts` changes, check if React types/interfaces need matching updates.
