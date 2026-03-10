// =============================================================================
// asyncLifecycle.js — Small helper to normalize async UI request lifecycles.
// =============================================================================

export async function runAsyncLifecycle({
  start,
  run,
  success,
  failure,
  finalize,
  rethrow = false,
} = {}) {
  start?.();
  try {
    const result = await run?.();
    await success?.(result);
    return result;
  } catch (error) {
    await failure?.(error);
    if (rethrow) {
      throw error;
    }
    return null;
  } finally {
    await finalize?.();
  }
}
