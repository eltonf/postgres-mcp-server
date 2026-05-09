# Cursor

Create or update `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://app_user:password@localhost:5432/app_db",
        "SCHEMA_ONLY_MODE": "true"
      }
    }
  }
}
```

Restart Cursor after editing the config.

Try:

```text
Use postgres to show me the database tables.
```
