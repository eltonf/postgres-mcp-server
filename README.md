# PostgreSQL MCP Server

An open-source Model Context Protocol (MCP) server for PostgreSQL schema introspection and guarded read-only queries. It helps MCP clients discover schemas, tables, columns, indexes, relationships, and safe queryable data from one configured PostgreSQL database.

Works with standard PostgreSQL providers, including Supabase-hosted Postgres.

## Features

- Schema tools for tables, views, columns, primary keys, foreign keys, indexes, and approximate table statistics
- PostgreSQL schema support with `DB_SCHEMA` defaulting to `public`
- Table and column search with simple `*` and `?` wildcards
- Relationship discovery for join-path exploration
- Optional read-only `execute_query` tool with SELECT-only validation, access control, and automatic `LIMIT`
- Internal `src/core` boundary for code that can later be shared with other database-specific MCP servers

## Requirements

- Node.js 18+
- PostgreSQL 13+ or a compatible hosted Postgres service
- A PostgreSQL role with read access to the configured database/schema

## Setup

Fast path for users installing from npm:

```bash
npx -y /postgres-mcp-server init
```

Then edit `.env` and check the connection:

```bash
npx -y /postgres-mcp-server doctor
```

Local development from this repository:

```bash
npm install
cp .env.example .env
npm run build
npm start
```

Configure `.env`:

```dotenv
DATABASE_URL=postgresql://app_user:app_user_password@localhost:5432/app_db
DB_SCHEMA=public
SCHEMA_ONLY_MODE=true
```

You can also use individual `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SSL` variables. Individual variables override `DATABASE_URL`.

This server connects to one configured database per process. Tool inputs may include `database` for compatibility, but it must match the configured database. Tool inputs may include `schema`; otherwise `DB_SCHEMA` or `public` is used.

## Least-Privilege PostgreSQL User

```sql
CREATE ROLE app_user LOGIN PASSWORD 'app_user_password';
GRANT CONNECT ON DATABASE app_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_user;
```

Use a stronger host restriction and password in production.

## MCP Client Example

Client-specific docs:

- [Claude Code](docs/clients/claude-code.md)
- [Claude Desktop](docs/clients/claude-desktop.md)
- [Codex](docs/clients/codex.md)
- [OpenCode](docs/clients/opencode.md)
- [Cursor](docs/clients/cursor.md)
- [VS Code](docs/clients/vscode.md)

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "/postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "postgresql://app_user:app_user_password@localhost:5432/app_db",
        "DB_SCHEMA": "public",
        "SCHEMA_ONLY_MODE": "true"
      }
    }
  }
}
```

To enable `execute_query`, set `SCHEMA_ONLY_MODE=false` and provide `QUERY_ACCESS_CONFIG`.

## Access Control

`execute_query` is blocked unless `QUERY_ACCESS_CONFIG` points to a JSON policy file. Example:

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
              }
            }
          }
        }
      }
    }
  }
}
```

## Tools

- `get_schema`
- `get_table_info`
- `find_tables`
- `search_objects`
- `get_relationships`
- `validate_objects`
- `get_accessible_schema`
- `get_accessible_table_info`
- `execute_query` when schema-only mode is disabled

Example prompts:

- "Show me the schema for the customers and orders tables."
- "Find tables with a column matching `*email*`."
- "Show relationships from orders to customers."
- "Run `SELECT id, email FROM customers ORDER BY id LIMIT 20`."

## Development

```bash
npm run build
npm test
npm run lint
```

The first implementation is PostgreSQL-specific. Shared logic lives under `src/core` so future database-specific repos can extract or reuse it without carrying PostgreSQL catalog code.
