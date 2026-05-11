# Query Access Setup

`execute_query` is disabled until `QUERY_ACCESS_CONFIG` points to a JSON access-control file. This is intentionally restrictive so schema introspection can be enabled separately from data reads.

## Example Policy

```json
{
  "requireExplicitColumns": true,
  "databases": {
    "app_db": {
      "schemas": {
        "public": {
          "tables": {
            "mode": "whitelist",
            "list": ["customers", "orders", "products", "order_items"],
            "columnAccess": {
              "customers": {
                "mode": "exclusion",
                "columns": ["password_hash", "api_token"]
              },
              "orders": {
                "mode": "inclusion",
                "columns": ["id", "customer_id", "status", "total", "created_at"]
              }
            }
          }
        }
      }
    }
  }
}
```

When `requireExplicitColumns` is `true`, `SELECT *` and `table.*` are rejected. Prefer queries such as:

```sql
SELECT id, email, created_at FROM customers ORDER BY id LIMIT 20;
```

## MCP Env Example

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@sigma4life/postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://app_user:app_user_password@localhost:5432/app_db",
        "DB_SCHEMA": "public",
        "SCHEMA_ONLY_MODE": "false",
        "QUERY_ACCESS_CONFIG": "/absolute/path/to/query-access.json"
      }
    }
  }
}
```
