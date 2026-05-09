# Codex

Add the server as a local stdio MCP:

```bash
codex mcp add postgres \
  --env DATABASE_URL=postgresql://app_user:app_user_password@localhost:5432/app_db \
  -- npx -y postgres-mcp-server
```

Verify:

```bash
codex mcp list
```

For read-query support, also pass:

```bash
--env SCHEMA_ONLY_MODE=false \
--env QUERY_ACCESS_CONFIG=/absolute/path/to/query-access.json
```

Try:

```text
Use postgres to find tables with an email column.
```
