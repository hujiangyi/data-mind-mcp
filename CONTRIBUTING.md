# Contributing

## Language

Public user documentation must be available in English and Simplified
Chinese. Keep the two versions behaviorally equivalent.

## Commit messages

Use English commit messages with a conventional prefix:

```text
feat: add a new MCP tool
fix: preserve credential compatibility
docs: update the bilingual installation guide
test: cover administrator scope filtering
```

## Pull requests

- Explain the behavior change and security impact.
- Add or update tests for protocol and permission changes.
- Do not include credentials, private architecture documents, customer data,
  provider keys, or generated release archives.
- Run `npm ci`, `npm test`, and `npm run build` in
  `packages/datamind-mcp`.
