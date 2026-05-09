import { resolveDatabase, resolveSchema } from '../core/config.js';
import { logger } from '../core/logger.js';
import { db } from '../postgres/connection.js';

export interface ValidationResult {
  exists: boolean;
  actualName?: string;
  suggestions?: string[];
  message: string;
}

export interface DatabaseValidation extends ValidationResult {
  databases?: string[];
}

export interface SchemaValidation extends ValidationResult {
  schemas?: string[];
}

export interface TableValidation extends ValidationResult {
  tables?: Array<{ schema: string; table: string; fullName: string; type?: string; rowCount?: number | null }>;
}

export async function validateDatabase(database?: string): Promise<DatabaseValidation> {
  const actualName = resolveDatabase(database);
  return {
    exists: true,
    actualName,
    message: database && database !== actualName
      ? `Database found (case mismatch): '${actualName}' (you provided '${database}')`
      : `Database '${actualName}' is configured for this server`,
  };
}

export async function validateSchema(database: string | undefined, schema?: string): Promise<SchemaValidation> {
  const actualDatabase = resolveDatabase(database);
  const actualSchema = resolveSchema(schema);
  const rows = await db.query<any>(
    `SELECT schema_name AS "schemaName" FROM information_schema.schemata WHERE schema_name = $1`,
    [actualSchema],
  );
  if (rows.length) {
    return { exists: true, actualName: actualSchema, message: `Schema '${actualSchema}' exists in database '${actualDatabase}'` };
  }

  const allSchemas = await db.query<any>(
    `SELECT schema_name AS "schemaName" FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name`,
  );
  return {
    exists: false,
    schemas: allSchemas.map((row) => row.schemaName),
    suggestions: allSchemas.slice(0, 5).map((row) => row.schemaName),
    message: `Schema '${actualSchema}' not found in database '${actualDatabase}'.`,
  };
}

export async function validateTable(
  database: string | undefined,
  table: string,
  schema?: string,
): Promise<TableValidation> {
  const actualDatabase = resolveDatabase(database);
  const actualSchema = resolveSchema(schema);

  try {
    const matches = await db.query<any>(
      `
SELECT
  t.table_schema AS "schemaName",
  t.table_name AS "tableName",
  t.table_schema || '.' || t.table_name AS "fullName",
  t.table_type AS "objectType",
  COALESCE(c.reltuples::bigint, 0) AS "rowCount"
FROM information_schema.tables t
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = t.table_schema
LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = t.table_name
WHERE t.table_schema = $1
  AND LOWER(t.table_name) = LOWER($2)
  AND t.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY t.table_name
`,
      [actualSchema, table],
    );

    if (matches.length === 1) {
      const match = matches[0];
      return {
        exists: true,
        actualName: match.fullName,
        message: match.tableName === table
          ? `Table '${match.fullName}' exists in database '${actualDatabase}'`
          : `Table found (case mismatch): '${match.fullName}' (you provided '${table}')`,
      };
    }

    const suggestions = await db.query<any>(
      `
SELECT
  t.table_schema AS "schemaName",
  t.table_name AS "tableName",
  t.table_schema || '.' || t.table_name AS "fullName",
  t.table_type AS "objectType",
  COALESCE(c.reltuples::bigint, 0) AS "rowCount"
FROM information_schema.tables t
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = t.table_schema
LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = t.table_name
WHERE t.table_schema = $1
  AND t.table_name ILIKE '%' || $2 || '%'
  AND t.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY t.table_name
LIMIT 10
`,
      [actualSchema, table],
    );

    const tables = suggestions.map((row) => ({
      schema: row.schemaName,
      table: row.tableName,
      fullName: row.fullName,
      type: row.objectType,
      rowCount: row.rowCount,
    }));

    return {
      exists: false,
      tables,
      suggestions: tables.slice(0, 5).map((row) => row.fullName),
      message: tables.length
        ? `Table '${table}' not found in database '${actualDatabase}', schema '${actualSchema}'. Did you mean: ${tables.slice(0, 5).map((row) => row.fullName).join(', ')}?`
        : `Table '${table}' not found in database '${actualDatabase}', schema '${actualSchema}'. No similar tables found.`,
    };
  } catch (error) {
    logger.error('Table validation failed:', error);
    throw error;
  }
}

export async function validateDatabaseObject(
  database?: string,
  table?: string,
  schema?: string,
): Promise<{
  valid: boolean;
  database: DatabaseValidation;
  schema?: SchemaValidation;
  table?: TableValidation;
  message: string;
}> {
  const databaseValidation = await validateDatabase(database);
  const schemaValidation = await validateSchema(databaseValidation.actualName, schema);

  if (!schemaValidation.exists) {
    return { valid: false, database: databaseValidation, schema: schemaValidation, message: schemaValidation.message };
  }

  if (table) {
    const tableValidation = await validateTable(databaseValidation.actualName, table, schemaValidation.actualName);
    if (!tableValidation.exists) {
      return { valid: false, database: databaseValidation, schema: schemaValidation, table: tableValidation, message: tableValidation.message };
    }
    return { valid: true, database: databaseValidation, schema: schemaValidation, table: tableValidation, message: `Validation successful: ${tableValidation.actualName}` };
  }

  return { valid: true, database: databaseValidation, schema: schemaValidation, message: 'Validation successful' };
}
