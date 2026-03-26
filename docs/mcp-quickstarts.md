# MCP Connector Quickstarts

Connect your AI assistant to manage tasks conversationally. These quickstarts cover the most common workflows.

## Setup

### Claude Desktop

1. Open Claude Desktop settings
2. Add an MCP server with URL: `https://your-todos-instance.example.com/mcp`
3. Authorize with your Todos account when prompted
4. You're connected — try asking "What's due this week?"

### ChatGPT (via MCP plugin)

1. Install an MCP-compatible plugin in ChatGPT
2. Point it at your Todos MCP endpoint: `https://your-todos-instance.example.com/mcp`
3. Authorize when prompted
4. Start with "Show me my tasks"

---

## Quickstart 1: "What should I work on?"

Ask your assistant for today's priorities.

**Try saying:**
- "What should I work on today?"
- "What's my top priority right now?"
- "Show me what's due this week"

**What happens:** The assistant calls `list_today` and `decide_next_work` to rank your tasks by urgency, effort, and energy match. You get a prioritized list with reasons.

---

## Quickstart 2: "Capture this"

Quickly add tasks from conversation.

**Try saying:**
- "Add a task: call the dentist tomorrow at 2pm"
- "Remind me to review the Q3 budget by Friday"
- "Capture: research flight options for vacation"

**What happens:** The assistant calls `create_task` with parsed title, due date, and priority. For rough ideas, it calls `capture_inbox_item` instead — you can triage later.

---

## Quickstart 3: "Plan my day"

Get a time-boxed daily plan.

**Try saying:**
- "Plan my day"
- "What should my morning look like?"
- "Generate a plan for today — I have about 6 hours"

**What happens:** The assistant calls `plan_today` with your available time and energy level. You get a ranked task list with estimated durations and explanations for each recommendation.

---

## Quickstart 4: "Run my weekly review"

Structured review of your commitments.

**Try saying:**
- "Run my weekly review"
- "What got stuck this week?"
- "Show me stale tasks and missing next actions"

**What happens:** The assistant calls `weekly_review` in suggest mode. You get findings organized by category: stale tasks, projects without next actions, waiting items, and overdue work. You can then say "apply the recommendations" to act on them.

---

## Quickstart 5: "What's stale?"

Find forgotten tasks.

**Try saying:**
- "Show me tasks I haven't touched in two weeks"
- "What's been sitting too long?"
- "Find stale items"

**What happens:** The assistant calls `find_stale_items` to surface tasks and projects not updated recently. You can then triage: complete, defer, or drop each one.

---

## Quickstart 6: "Break this down"

Decompose a complex task.

**Try saying:**
- "Break down 'Launch marketing campaign' into subtasks"
- "Plan the steps for my home renovation project"
- "Help me decompose this task into actionable pieces"

**What happens:** The assistant calls `break_down_task` or `plan_project` to generate a step-by-step breakdown with estimated effort for each step.

---

## Tips

- **Be specific about time**: "I have 4 hours today" helps the planner generate better plans.
- **Mention energy**: "I'm low energy today" adjusts which tasks get recommended.
- **Use project names**: "Add this to the Marketing project" routes tasks correctly.
- **Ask for reasoning**: "Why is this task recommended?" triggers explanation output.

## Available Scopes

| Scope | What It Allows |
|-------|---------------|
| `tasks.read` | View tasks, search, list, get plans and reviews |
| `tasks.write` | Create, update, complete, delete tasks |
| `projects.read` | View projects and project health |
| `projects.write` | Create, update, delete projects |
