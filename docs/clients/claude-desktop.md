# Claude Desktop

Add this to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://app_user:app_user_password@localhost:5432/app_db",
        "SCHEMA_ONLY_MODE": "true"
      }
    }
  }
}
```

Restart Claude Desktop after editing the config.

For read-query support, set:

```json
{
  "SCHEMA_ONLY_MODE": "false",
  "QUERY_ACCESS_CONFIG": "/absolute/path/to/query-access.json"
}
```

Try:

```text
Show me the schema for customers and orders.
```
