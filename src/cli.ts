#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { maskDatabaseUrl } from './core/database-url.js';

const DEFAULT_DATABASE_URL = 'postgresql://app_user:app_user_password@localhost:5432/app_db';

function usage(): void {
  console.log(`postgres-mcp-server

Usage:
  postgres-mcp-server                 Start the MCP stdio server
  postgres-mcp-server serve           Start the MCP stdio server
  postgres-mcp-server doctor          Check configuration and database connectivity
  postgres-mcp-server init [--force]  Create starter .env, query-access.json, and client snippets

Environment:
  DATABASE_URL=postgresql://user:password@host:5432/database
`);
}

function writeFileIfMissing(filePath: string, content: string, force: boolean): 'created' | 'skipped' {
  if (fs.existsSync(filePath) && !force) return 'skipped';
  fs.writeFileSync(filePath, content);
  return 'created';
}

function envTemplate(): string {
  return `# One-line setup. Individual DB_* variables may override parts of this URL.
DATABASE_URL=${DEFAULT_DATABASE_URL}

# PostgreSQL schema to inspect by default.
DB_SCHEMA=public

# Safer first-run default: schema tools only. Set false to enable execute_query.
SCHEMA_ONLY_MODE=true

# Required only when SCHEMA_ONLY_MODE=false.
# QUERY_ACCESS_CONFIG=${path.resolve('query-access.json')}

MAX_QUERY_ROWS=100
QUERY_TIMEOUT_MS=30000
MCP_SERVER_NAME=postgres-mcp-server
MCP_SERVER_VERSION=1.0.0
LOG_LEVEL=info
LOG_FILE=mcp-server.log
`;
}

function queryAccessTemplate(): string {
  return JSON.stringify({
    requireExplicitColumns: true,
    databases: {
      app_db: {
        schemas: {
          public: {
            tables: {
              mode: 'whitelist',
              list: ['customers', 'orders', 'products', 'order_items'],
              columnAccess: {
                customers: { mode: 'exclusion', columns: ['password_hash', 'api_token'] },
              },
            },
          },
        },
      },
    },
  }, null, 2) + '\n';
}

function clientSnippetsTemplate(): string {
  return `# postgres-mcp-server client snippets

Replace the sample DATABASE_URL with your real PostgreSQL connection string.

## Claude Code

\`\`\`bash
claude mcp add --transport stdio postgres \\
  --env DATABASE_URL=${DEFAULT_DATABASE_URL} \\
  --env DB_SCHEMA=public \\
  -- npx -y /postgres-mcp-server
\`\`\`

## Codex

\`\`\`bash
codex mcp add postgres \\
  --env DATABASE_URL=${DEFAULT_DATABASE_URL} \\
  --env DB_SCHEMA=public \\
  -- npx -y /postgres-mcp-server
\`\`\`

## Claude Desktop

\`\`\`json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "/postgres-mcp-server"],
      "env": {
        "DATABASE_URL": "${DEFAULT_DATABASE_URL}",
        "DB_SCHEMA": "public"
      }
    }
  }
}
\`\`\`

## OpenCode

\`\`\`json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "postgres": {
      "type": "local",
      "command": ["npx", "-y", "/postgres-mcp-server"],
      "enabled": true,
      "environment": {
        "DATABASE_URL": "${DEFAULT_DATABASE_URL}",
        "DB_SCHEMA": "public"
      }
    }
  }
}
\`\`\`
`;
}

async function runInit(args: string[]): Promise<void> {
  const force = args.includes('--force');
  const files = [
    ['.env', envTemplate()],
    ['query-access.json', queryAccessTemplate()],
    ['postgres-mcp-clients.md', clientSnippetsTemplate()],
  ] as const;

  for (const [file, content] of files) {
    const status = writeFileIfMissing(path.resolve(file), content, force);
    console.log(`${status === 'created' ? 'created' : 'skipped'} ${file}`);
  }

  console.log('\nNext steps:');
  console.log('1. Edit .env with your PostgreSQL credentials.');
  console.log('2. Run: postgres-mcp-server doctor');
  console.log('3. Add one of the snippets from postgres-mcp-clients.md to your MCP client.');
}

async function runDoctor(): Promise<void> {
  console.log('postgres-mcp-server doctor\n');

  try {
    const { appConfig, resolveSchema } = await import('./core/config.js');
    const { db } = await import('./postgres/connection.js');
    const schema = resolveSchema();

    console.log(`server: ${appConfig.server.name} v${appConfig.server.version}`);
    console.log(`database: ${appConfig.db.user}@${appConfig.db.host}:${appConfig.db.port}/${appConfig.db.name}`);
    console.log(`schema: ${schema}`);
    console.log(`ssl: ${appConfig.db.ssl ? 'enabled' : 'disabled'}`);
    console.log(`schema-only mode: ${appConfig.server.schemaOnlyMode ? 'enabled' : 'disabled'}`);
    if (process.env.DATABASE_URL) console.log(`DATABASE_URL: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);

    const versionRows = await db.query<any>('SELECT version() AS version');
    console.log(`postgres: ${versionRows[0]?.version || 'connected'}`);

    const tableRows = await db.query<any>(
      `SELECT COUNT(*) AS "tableCount"
FROM information_schema.tables
WHERE table_schema = $1
  AND table_type IN ('BASE TABLE', 'VIEW')`,
      [schema],
    );
    console.log(`tables/views visible: ${tableRows[0]?.tableCount ?? 0}`);

    if (!appConfig.server.schemaOnlyMode) {
      if (process.env.QUERY_ACCESS_CONFIG) {
        const { loadAccessControlConfig } = await import('./core/security/access-control.js');
        loadAccessControlConfig();
        console.log('query access config: ok');
      } else {
        console.log('query access config: missing; execute_query will be blocked');
      }
    }

    await db.close();
    console.log('\nDoctor passed.');
  } catch (error) {
    console.error('Doctor failed.');
    console.error(error instanceof Error ? error.message || error.stack || String(error) : JSON.stringify(error));
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const [command = 'serve', ...args] = process.argv.slice(2);

  switch (command) {
    case 'serve':
      await import('./index.js');
      break;
    case 'doctor':
      await runDoctor();
      break;
    case 'init':
      await runInit(args);
      break;
    case '--help':
    case '-h':
    case 'help':
      usage();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      usage();
      process.exitCode = 1;
  }
}

main();
