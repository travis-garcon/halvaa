# AGENTS.md

# Persistent Project Workflow & Handoff Rules

This project follows the global persistent workflow in `/root/AGENTS.md`.

## Required State

- Read `.agent-state.md` before substantive work.
- Append a new Work Phase for every new user request.
- Preserve all previous Work Phases.
- Keep the current phase TODO list, progress, logs, file changes, decisions,
  known issues, and next-agent instructions current throughout the work.
- Update `.agent-state.md` after important discoveries, each completed task,
  every file change, blockers, decisions, and before the final response.
- Do not create `HANDOFF.md` unless the user explicitly requests it.
- Read and update the existing `AI_AGENT_HANDOFF.md` only when it is relevant
  to the current work.

## Repository Safety

- The worktree may contain user or prior-agent changes. Never revert changes
  that are unrelated to the current request.
- Prefer existing project patterns and keep changes scoped.
- Verify frontend changes with typecheck/build and backend changes with the
  relevant test or compile commands.

## Required Files

The project root must always contain:

```text
AGENTS.md
.agent-state.md
```

