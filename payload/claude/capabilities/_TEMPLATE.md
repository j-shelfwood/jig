---
service: <<service-slug>>
reach: cli            # mcp | cli | api | browser | file | none
identity: <<which account the agent acts as>>
secret: <<env var name, or password-manager reference such as op://Vault/Item/field; never the value>>
scope: []             # what the identity may do, e.g. [read, write-own-repos]
unattended: true      # can a background agent use it without a human (biometric prompts make this false)
health: <<one shell line, exit 0 = green, e.g. gh auth status >/dev/null 2>&1>>
verified: <<YYYY-MM-DD the health line last passed>>
status: green         # green | yellow | red | planned
---
## Use
```bash
# the 3 to 5 commands agents actually need, each with a comment on what it does and what it must not do
```

## Known failures
| symptom | fix |
|---|---|
| <<exact error text, date, how often>> | <<what worked>> |
