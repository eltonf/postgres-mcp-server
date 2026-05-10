# VS Code

Create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "/postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://app_user:app_user_password@localhost:5432/app_db",
        "SCHEMA_ONLY_MODE": "true"
      }
    }
  }
}
```

Try:

```text
Use postgres to inspect the customers table.
```
