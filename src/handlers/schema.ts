import { cache } from '../core/cache.js';
import { resolveDatabase, resolveSchema } from '../core/config.js';
import { SchemaResult, TableMetadata } from '../core/schema-types.js';
import { logger } from '../core/logger.js';
import {
  getColumns,
  getForeignKeys,
  getIndexes,
  getPrimaryKeys,
  getStatistics,
  listTables,
} from '../postgres/queries.js';
import { validateDatabaseObject } from './validation.js';

function byTable<T extends { tableName: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.tableName) || [];
    list.push(row);
    map.set(row.tableName, list);
  }
  return map;
}

async function buildMetadata(
  schema: string,
  tableNames?: string[],
  includeRelationships = true,
  includeStatistics = false,
): Promise<TableMetadata[]> {
  const tables = await listTables(schema, tableNames);
  const actualTableNames = tables.map((table) => table.tableName);

  const [columns, primaryKeys, foreignKeys, indexes, statistics] = await Promise.all([
    getColumns(schema, actualTableNames),
    getPrimaryKeys(schema, actualTableNames),
    includeRelationships ? getForeignKeys(schema, actualTableNames) : Promise.resolve([]),
    getIndexes(schema, actualTableNames),
    includeStatistics ? getStatistics(schema, actualTableNames) : Promise.resolve([]),
  ]);

  const columnsByTable = byTable(columns);
  const pksByTable = byTable(primaryKeys);
  const fksByTable = byTable(foreignKeys);
  const indexesByTable = byTable(indexes);
  const statsByTable = byTable(statistics);

  return tables.map((table) => {
    const metadata: TableMetadata = {
      schema: table.schemaName,
      name: table.tableName,
      type: table.tableType === 'VIEW' ? 'VIEW' : 'TABLE',
      columns: (columnsByTable.get(table.tableName) || []).map(({ tableName: _tableName, ...column }) => column),
      indexes: (indexesByTable.get(table.tableName) || []).map(({ tableName: _tableName, ...index }) => index),
    };

    const primaryKey = pksByTable.get(table.tableName)?.[0];
    if (primaryKey) {
      const { tableName: _tableName, ...pk } = primaryKey;
      metadata.primaryKey = pk;
    }

    if (includeRelationships) {
      metadata.foreignKeys = (fksByTable.get(table.tableName) || []).map(({ tableName: _tableName, ...fk }) => fk);
    }

    const stats = statsByTable.get(table.tableName)?.[0];
    if (includeStatistics && stats) {
      const { tableName: _tableName, ...tableStats } = stats;
      metadata.statistics = tableStats;
    }

    return metadata;
  });
}

export async function getSchema(args: {
  database?: string;
  tables?: string[];
  schema?: string;
  includeRelationships?: boolean;
  includeStatistics?: boolean;
}): Promise<SchemaResult> {
  const database = resolveDatabase(args.database);
  const schema = resolveSchema(args.schema);
  const { tables, includeRelationships = true, includeStatistics = false } = args;

  const cacheKey = `schema:${database}:${schema}:${tables?.join(',') || 'all'}:${includeRelationships}:${includeStatistics}`;
  const cached = cache.get<SchemaResult>(cacheKey);
  if (cached) return cached;

  if (tables?.length) {
    const validation = await Promise.all(tables.map((table) => validateDatabaseObject(database, table, schema)));
    const missing = validation.filter((result) => !result.valid);
    if (missing.length) throw new Error(missing.map((result) => result.message).join('\n'));
  }

  const result = { schema: await buildMetadata(schema, tables, includeRelationships, includeStatistics) };
  cache.set(cacheKey, result);
  logger.info(`Retrieved schema for ${result.schema.length} objects from ${database}.${schema}`);
  return result;
}

export async function getTableInfo(args: {
  database?: string;
  table: string;
  schema?: string;
}): Promise<TableMetadata> {
  const database = resolveDatabase(args.database);
  const schema = resolveSchema(args.schema);

  const validation = await validateDatabaseObject(database, args.table, schema);
  if (!validation.valid || !validation.table?.actualName) throw new Error(validation.message);

  const tableName = validation.table.actualName.split('.').pop() || args.table;
  const metadata = await buildMetadata(schema, [tableName], true, false);
  if (!metadata[0]) throw new Error(`Table '${args.table}' not found in database '${database}', schema '${schema}'`);
  return metadata[0];
}
