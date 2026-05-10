# Claude Code

Add the server as a local stdio MCP:

```bash
claude mcp add --transport stdio postgres \
  --env DATABASE_URL=postgresql://app_user:app_user_password@localhost:5432/app_db \
  -- npx -y /postgres-mcp-server
```

For read-query support, also pass:

```bash
--env SCHEMA_ONLY_MODE=false \
--env QUERY_ACCESS_CONFIG=/absolute/path/to/query-access.json
```

Check status inside Claude Code:

```text
/mcp
```

Try:

```text
Use postgres to show me the tables in this database.
```
