### Legacy vanilla JS client (archived)

- The original vanilla JavaScript web client lived in the `client/` directory.
- It has been **decommissioned** and is no longer built, tested, or deployed in any environment.
- The canonical and supported web client going forward is the **React app** in `client-react/`.
- Any remaining references to `client/` should be treated as **historical context only** and should not be extended for new features.
- When implementing new UI work, prefer `client-react/` (and iOS where applicable) and keep `src/types.ts` as the shared contract for API types.
