# CLAUDE.md

This repository is `postgres-mcp-server`, a PostgreSQL-specific MCP server for schema introspection and guarded read-only queries.

## Architecture

- `src/index.ts` registers MCP tools and starts the stdio server.
- `src/core/*` contains reusable code intended for future extraction.
- `src/postgres/*` contains PostgreSQL-specific code:
  - `pg` connection pool
  - identifier helpers
  - `information_schema` and `pg_catalog` catalog queries
- `src/handlers/*` adapts MCP tool input/output to the PostgreSQL implementation.

## Design Notes

- One MCP server instance connects to one configured PostgreSQL database.
- `DB_SCHEMA` defaults to `public`; tool calls may override `schema`.
- `execute_query` accepts read-only `SELECT`/`WITH` queries, validates access control, and enforces `LIMIT`.
- Routine/function definition tools are intentionally deferred for v1.

## Development Commands

```bash
npm run build
npm test
npm start
```

Use neutral examples such as `app_db`, `customers`, `orders`, `products`, and `order_items`.
