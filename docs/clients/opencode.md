# OpenCode

Add a local MCP server to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "postgres": {
      "type": "local",
      "command": ["npx", "-y", "postgres-mcp-server"],
      "enabled": true,
      "environment": {
        "DATABASE_URL": "postgresql://app_user:password@localhost:5432/app_db",
        "SCHEMA_ONLY_MODE": "true"
      }
    }
  }
}
```

For read-query support, add:

```json
{
  "SCHEMA_ONLY_MODE": "false",
  "QUERY_ACCESS_CONFIG": "/absolute/path/to/query-access.json"
}
```

Try:

```text
Use the postgres tool to show relationships from orders.
```
