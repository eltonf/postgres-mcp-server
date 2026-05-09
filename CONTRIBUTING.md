# Contributing

Thanks for helping improve `postgres-mcp-server`.

## Development

```bash
npm install
npm run build
npm test
```

Keep PostgreSQL-specific catalog behavior in `src/postgres/*`. Shared behavior that could apply to future database-specific MCP servers belongs in `src/core/*`.

## Pull Requests

- Keep examples generic and public-safe.
- Add tests for query-safety, parser, access-control, or PostgreSQL catalog changes where practical.
- Do not commit real credentials, hostnames, customer data, private database names, or personal usernames.
