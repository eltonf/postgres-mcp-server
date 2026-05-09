import { resolveDatabase, resolveSchema } from '../core/config.js';
import { logger } from '../core/logger.js';
import {
  findTables as findPostgresTables,
  searchObjects as searchPostgresObjects,
  ObjectSearchResult,
  TableSearchResult,
} from '../postgres/queries.js';

export async function findTables(args: {
  database?: string;
  pattern?: string;
  hasColumn?: string;
  schema?: string;
}): Promise<TableSearchResult[]> {
  const database = resolveDatabase(args.database);
  const schema = resolveSchema(args.schema);
  const tables = await findPostgresTables(schema, args.pattern, args.hasColumn);
  logger.info(`Found ${tables.length} tables matching criteria in ${database}.${schema}`);
  return tables;
}

export async function searchObjects(args: {
  database?: string;
  search: string;
  schema?: string;
  type?: string;
}): Promise<ObjectSearchResult[]> {
  const database = resolveDatabase(args.database);
  const schema = resolveSchema(args.schema);
  const results = await searchPostgresObjects(schema, args.search, args.type);
  logger.info(`Found ${results.length} matches for '${args.search}' in ${database}.${schema}`);
  return results;
}
