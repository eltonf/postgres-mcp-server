import {
  ColumnMetadata,
  ForeignKeyMetadata,
  IndexMetadata,
  PrimaryKeyMetadata,
  StatisticsMetadata,
} from '../core/schema-types.js';
import { db } from './connection.js';
import { likePattern } from './identifiers.js';

interface TableRow {
  schemaName: string;
  tableName: string;
  tableType: 'BASE TABLE' | 'VIEW';
  createDate: Date | null;
  rowCount: number | null;
}

export interface TableSearchResult {
  schemaName: string;
  tableName: string;
  rowCount?: number;
  createDate?: Date | null;
}

export interface ObjectSearchResult {
  schemaName: string;
  tableName?: string;
  columnName?: string;
}

export interface Relationship {
  fromSchema: string;
  fromTable: string;
  fromColumn: string;
  toSchema: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
  deleteAction: string;
  updateAction: string;
}

export async function listTables(schema: string, tableNames?: string[]): Promise<TableRow[]> {
  const tableFilter = tableNames?.length ? 'AND t.table_name = ANY($2)' : '';
  const params = tableNames?.length ? [schema, tableNames] : [schema];
  return db.query<TableRow>(
    `
SELECT
  t.table_schema AS "schemaName",
  t.table_name AS "tableName",
  t.table_type AS "tableType",
  NULL::timestamp AS "createDate",
  COALESCE(c.reltuples::bigint, 0) AS "rowCount"
FROM information_schema.tables t
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = t.table_schema
LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = t.table_name
WHERE t.table_schema = $1
  AND t.table_type IN ('BASE TABLE', 'VIEW')
  ${tableFilter}
ORDER BY t.table_name
`,
    params,
  );
}

export async function getColumns(schema: string, tableNames?: string[]): Promise<(ColumnMetadata & { tableName: string })[]> {
  const tableFilter = tableNames?.length ? 'AND c.table_name = ANY($2)' : '';
  const params = tableNames?.length ? [schema, tableNames] : [schema];
  return db.query<ColumnMetadata & { tableName: string }>(
    `
SELECT
  c.column_name AS "name",
  c.ordinal_position AS "ordinal",
  CASE
    WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
    WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
    WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
    ELSE c.data_type
  END AS "dataType",
  (c.is_nullable = 'YES') AS "nullable",
  (c.is_identity = 'YES' OR c.column_default LIKE 'nextval(%') AS "isIdentity",
  (c.is_generated <> 'NEVER') AS "isComputed",
  c.column_default AS "defaultValue",
  d.description AS "description",
  EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = tc.constraint_schema
      AND kcu.constraint_name = tc.constraint_name
      AND kcu.table_schema = tc.table_schema
      AND kcu.table_name = tc.table_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = c.table_schema
      AND tc.table_name = c.table_name
      AND kcu.column_name = c.column_name
  ) AS "isPrimaryKey",
  EXISTS (
    SELECT 1
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_schema = c.table_schema
      AND kcu.table_name = c.table_name
      AND kcu.column_name = c.column_name
  ) AS "isForeignKey",
  c.table_name AS "tableName"
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = c.table_schema
LEFT JOIN pg_catalog.pg_class cls ON cls.relnamespace = n.oid AND cls.relname = c.table_name
LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
LEFT JOIN pg_catalog.pg_description d ON d.objoid = cls.oid AND d.objsubid = a.attnum
WHERE c.table_schema = $1
  ${tableFilter}
ORDER BY c.table_name, c.ordinal_position
`,
    params,
  );
}

export async function getPrimaryKeys(schema: string, tableNames?: string[]): Promise<(PrimaryKeyMetadata & { tableName: string })[]> {
  const tableFilter = tableNames?.length ? 'AND kcu.table_name = ANY($2)' : '';
  const params = tableNames?.length ? [schema, tableNames] : [schema];
  return db.query<PrimaryKeyMetadata & { tableName: string }>(
    `
SELECT
  kcu.table_name AS "tableName",
  tc.constraint_name AS "constraintName",
  string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS "columns"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
  AND kcu.constraint_name = tc.constraint_name
  AND kcu.table_schema = tc.table_schema
  AND kcu.table_name = tc.table_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = $1
  ${tableFilter}
GROUP BY kcu.table_name, tc.constraint_name
`,
    params,
  );
}

export async function getForeignKeys(schema: string, tableNames?: string[]): Promise<(ForeignKeyMetadata & { tableName: string })[]> {
  const tableFilter = tableNames?.length ? 'AND kcu.table_name = ANY($2)' : '';
  const params = tableNames?.length ? [schema, tableNames] : [schema];
  return db.query<ForeignKeyMetadata & { tableName: string }>(
    `
SELECT
  kcu.table_name AS "tableName",
  tc.constraint_name AS "constraintName",
  kcu.table_schema AS "fromSchema",
  kcu.table_name AS "fromTable",
  string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS "fromColumns",
  ccu.table_schema AS "toSchema",
  ccu.table_name AS "toTable",
  string_agg(ccu.column_name, ',' ORDER BY kcu.ordinal_position) AS "toColumns",
  rc.delete_rule AS "onDelete",
  rc.update_rule AS "onUpdate"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
  AND kcu.constraint_name = tc.constraint_name
  AND kcu.table_schema = tc.table_schema
  AND kcu.table_name = tc.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
  AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
  AND rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = $1
  ${tableFilter}
GROUP BY kcu.table_name, tc.constraint_name, kcu.table_schema, ccu.table_schema, ccu.table_name, rc.delete_rule, rc.update_rule
`,
    params,
  );
}

export async function getIndexes(schema: string, tableNames?: string[]): Promise<(IndexMetadata & { tableName: string })[]> {
  const tableFilter = tableNames?.length ? 'AND t.relname = ANY($2)' : '';
  const params = tableNames?.length ? [schema, tableNames] : [schema];
  return db.query<IndexMetadata & { tableName: string }>(
    `
SELECT
  t.relname AS "tableName",
  i.relname AS "name",
  am.amname AS "type",
  ix.indisunique AS "isUnique",
  ix.indisprimary AS "isPrimaryKey",
  COALESCE(string_agg(a.attname, ',' ORDER BY ord.ordinality), '') AS "columns"
FROM pg_catalog.pg_class t
JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
JOIN pg_catalog.pg_index ix ON ix.indrelid = t.oid
JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
JOIN pg_catalog.pg_am am ON am.oid = i.relam
LEFT JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = ord.attnum
WHERE n.nspname = $1
  ${tableFilter}
GROUP BY t.relname, i.relname, am.amname, ix.indisunique, ix.indisprimary
`,
    params,
  );
}

export async function getStatistics(schema: string, tableNames?: string[]): Promise<(StatisticsMetadata & { tableName: string })[]> {
  const tableFilter = tableNames?.length ? 'AND c.relname = ANY($2)' : '';
  const params = tableNames?.length ? [schema, tableNames] : [schema];
  return db.query<StatisticsMetadata & { tableName: string }>(
    `
SELECT
  c.relname AS "tableName",
  COALESCE(c.reltuples::bigint, 0) AS "rowCount",
  ROUND((pg_total_relation_size(c.oid) / 1024.0))::bigint AS "totalSizeKB",
  ROUND((pg_relation_size(c.oid) / 1024.0))::bigint AS "usedSizeKB"
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = $1
  AND c.relkind IN ('r', 'p', 'v', 'm')
  ${tableFilter}
`,
    params,
  );
}

export async function findTables(schema: string, pattern?: string, hasColumn?: string): Promise<TableSearchResult[]> {
  const params: unknown[] = [schema];
  const clauses: string[] = [];
  if (pattern) {
    params.push(likePattern(pattern));
    clauses.push(`t.table_name ILIKE $${params.length}`);
  }
  if (hasColumn) {
    params.push(likePattern(hasColumn));
    clauses.push(`c.column_name ILIKE $${params.length}`);
  }

  return db.query<TableSearchResult>(
    `
SELECT DISTINCT
  t.table_schema AS "schemaName",
  t.table_name AS "tableName",
  COALESCE(cls.reltuples::bigint, 0) AS "rowCount",
  NULL::timestamp AS "createDate"
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = t.table_schema
LEFT JOIN pg_catalog.pg_class cls ON cls.relnamespace = n.oid AND cls.relname = t.table_name
WHERE t.table_schema = $1
  AND t.table_type IN ('BASE TABLE', 'VIEW')
  ${clauses.length ? `AND ${clauses.join(' AND ')}` : ''}
ORDER BY t.table_name
LIMIT 100
`,
    params,
  );
}

export async function searchObjects(schema: string, search: string, type?: string): Promise<ObjectSearchResult[]> {
  const pattern = likePattern(search) || `%${search}%`;
  const includeTables = !type || type === 'table';
  const includeColumns = !type || type === 'column';
  const parts: string[] = [];

  if (includeTables) {
    parts.push(`
SELECT t.table_schema AS "schemaName", t.table_name AS "tableName", NULL::text AS "columnName"
FROM information_schema.tables t
WHERE t.table_schema = $1
  AND t.table_name ILIKE $2`);
  }

  if (includeColumns) {
    parts.push(`
SELECT c.table_schema AS "schemaName", c.table_name AS "tableName", c.column_name AS "columnName"
FROM information_schema.columns c
WHERE c.table_schema = $1
  AND c.column_name ILIKE $2`);
  }

  if (!parts.length) {
    return [];
  }

  return db.query<ObjectSearchResult>(
    `${parts.join('\nUNION ALL\n')}\nORDER BY "tableName", "columnName"\nLIMIT 100`,
    [schema, pattern],
  );
}

export async function getRelationships(schema: string): Promise<Relationship[]> {
  return db.query<Relationship>(
    `
SELECT
  kcu.table_schema AS "fromSchema",
  kcu.table_name AS "fromTable",
  kcu.column_name AS "fromColumn",
  ccu.table_schema AS "toSchema",
  ccu.table_name AS "toTable",
  ccu.column_name AS "toColumn",
  tc.constraint_name AS "constraintName",
  rc.delete_rule AS "deleteAction",
  rc.update_rule AS "updateAction"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
  AND kcu.constraint_name = tc.constraint_name
  AND kcu.table_schema = tc.table_schema
  AND kcu.table_name = tc.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
  AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
  AND rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_schema = $1
ORDER BY kcu.table_name, kcu.ordinal_position
`,
    [schema],
  );
}
