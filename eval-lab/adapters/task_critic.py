"""HTTP adapter with retry, timeout, and prompt override support."""
import os
import httpx
from typing import Optional

from schemas.task_critic import TaskCriticInput, TaskCriticOutput

API_BASE = os.getenv("TODOS_API_BASE", "http://localhost:3000")
API_TOKEN = os.getenv("TODOS_API_TOKEN", "")
TIMEOUT = 30.0
MAX_RETRIES = 1


async def call_task_critic(
    input: TaskCriticInput,
    prompt_override: Optional[str] = None,
) -> Optional[TaskCriticOutput]:
    """Call task critic endpoint. Returns None on failure."""
    payload = input.model_dump(by_alias=True, exclude_none=True)

    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    if prompt_override:
        headers["X-Eval-Prompt-Override"] = prompt_override

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.post(
                    f"{API_BASE}/ai/task-critic",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                return TaskCriticOutput.model_validate(resp.json())
        except (httpx.TimeoutException, httpx.NetworkError):
            if attempt == MAX_RETRIES:
                return None  # Caller scores as failure
        except httpx.HTTPStatusError:
            return None

    return None
