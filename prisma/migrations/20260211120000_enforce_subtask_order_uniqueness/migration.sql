-- Normalize existing subtask order values to a deterministic 0..N-1 sequence per todo.
-- This prevents unique constraint failures when duplicate order values already exist.
WITH ranked AS (
  SELECT
    id,
    todo_id,
    ROW_NUMBER() OVER (
      PARTITION BY todo_id
      ORDER BY "order" ASC, created_at ASC, id ASC
    ) - 1 AS normalized_order
  FROM subtasks
)
UPDATE subtasks AS s
SET "order" = ranked.normalized_order
FROM ranked
WHERE s.id = ranked.id
  AND s."order" <> ranked.normalized_order;

-- Detect duplicate groups after normalization (for migration diagnostics).
-- This should return zero rows once normalization has run.
SELECT todo_id, "order", COUNT(*)
FROM subtasks
GROUP BY todo_id, "order"
HAVING COUNT(*) > 1;

-- Enforce unique subtask order per todo.
CREATE UNIQUE INDEX "subtasks_todo_id_order_key" ON "subtasks"("todo_id", "order");
