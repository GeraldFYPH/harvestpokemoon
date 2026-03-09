# Repository Instructions

For this repository, after completing any user-requested update, follow this default workflow unless the user explicitly says not to:

1. Make the requested changes.
2. Verify the result locally when feasible.
3. Check `git status`.
4. Stage only the relevant files.
5. Commit with a concise message.
6. Push to `origin main`.

Guardrails:
- Do not rewrite history unless the user explicitly requests it.
- Do not stage unrelated user changes.
- If push fails because of network restrictions or credentials, request approval and retry.
- If the user asks for changes without git activity, follow the user's instruction for that turn.
