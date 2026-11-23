# Machine context

<!-- Filled by the setup agent from its phase 0 inventory. Keep it under 20 lines: facts the agent would otherwise rediscover every session. -->

- Machine: <<HARDWARE>>, <<OS>>. Shell: <<SHELL>>, config in <<SHELL_CONFIG_PATH>>.
- Package managers, in order of preference: <<PACKAGE_MANAGERS>> (e.g. `brew` for CLI tools → `bun` for JS → `uv` for Python; never global `pip`).
- Scripts and tooling: <<SCRIPT_LANGUAGE>> by default (e.g. TypeScript on bun), not shell past a few lines.
- Runtimes and CLIs installed: <<RUNTIMES>>.
- Shell quirks agents trip over: <<SHELL_QUIRKS>> (e.g. on macOS: BSD `sed -i ''`, no `head -n -N`; zsh aborts on an unmatched glob).
- Paths: `<<PROJECTS>>/` (all code, one checkout per repo), `<<VAULT>>/` (Obsidian vault), <<OTHER_PATHS>>.
- Editors: <<EDITORS>>.
- `command not found` → install with <<FIRST_PACKAGE_MANAGER>>.
