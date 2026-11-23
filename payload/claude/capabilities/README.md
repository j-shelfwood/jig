# Capabilities

One file per external service an agent touches: `<service>.md`, copied from `_TEMPLATE.md`.

- The frontmatter is machine-readable. A small script (Joris calls his `doctor`) runs every `health` line at session start and prints only the failing rows, so the agent knows a service is down before it tries it.
- `## Use` holds the few commands that work, with what each must not do.
- `## Known failures` is the only place an access problem fixed by hand is recorded: exact error text, date, the fix. The next session that hits the same error finds it here instead of rediscovering it.
- Secrets appear by reference only (an env var name, a password-manager path). Never a value.
