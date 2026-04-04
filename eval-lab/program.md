# Task Critic Quality Optimization

## Goal
Improve task critic quality by maximizing agreement with human ratings,
preserving score calibration across quality bands, and generating useful
concise suggestions.

## What You Can Edit
- `prompts/task_critic/candidate.txt` — the system prompt for task critic
- `agent.py` — only the prompt-loading and runner logic

## What You Cannot Edit
- `adapters/task_critic.py`
- `schemas/task_critic.py`
- `verifiers/task_critic.py`
- `tasks/task-critic-quality/` (benchmark cases)
- Any todos-api production source code

## How to Run
```bash
cd eval-lab
python agent.py
```

To test a candidate prompt:
```bash
EVAL_PROMPT=candidate python agent.py
```

## Success Criteria
- Establish baseline score first (run with `prompts/task_critic/baseline.txt`)
- Target: improve baseline by 15%+ within 10 iterations
- Must maintain score distribution across low/mid/high quality bands
- Suggestions must remain actionable and specific (not generic)

## Optimization Strategy
1. Read the current baseline prompt
2. Write a candidate prompt to `prompts/task_critic/candidate.txt`
3. Run: `EVAL_PROMPT=candidate python agent.py`
4. Compare final_score against baseline
5. Keep changes that improve score, discard regressions
6. Iterate until plateau

## Notes
- The task critic receives: title, optional description, optional due date, optional priority
- It returns: qualityScore (0-100), improvedTitle, improvedDescription, suggestions[]
- Human ratings range from 15-85 across the benchmark set
- Focus on improving the system prompt and suggestion quality first
- Do NOT optimize for a single case — the score is a composite across all cases
- The benchmark includes cases across categories: vague, well-defined, over-specified, edge-case
