import { Pool, QueryResultRow } from 'pg';
import { appConfig } from '../core/config.js';
import { logger } from '../core/logger.js';

class PostgresConnection {
  private static instance: PostgresConnection;
  private pool: Pool | null = null;

  private constructor() {}

  static getInstance(): PostgresConnection {
    if (!PostgresConnection.instance) {
      PostgresConnection.instance = new PostgresConnection();
    }
    return PostgresConnection.instance;
  }

  private createPool(): Pool {
    logger.info(`Creating PostgreSQL pool for ${appConfig.db.host}:${appConfig.db.port}/${appConfig.db.name}`);
    return new Pool({
      host: appConfig.db.host,
      port: appConfig.db.port,
      database: appConfig.db.name,
      user: appConfig.db.user,
      password: appConfig.db.password,
      ssl: appConfig.db.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: appConfig.query.timeoutMs,
    });
  }

  async connect(): Promise<Pool> {
    if (!this.pool) {
      this.pool = this.createPool();
      await this.pool.query('SELECT 1');
      logger.info('Connected to PostgreSQL successfully');
    }
    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: Record<string, unknown> | unknown[],
  ): Promise<T[]> {
    const pool = await this.connect();
    logger.debug(`Executing query: ${sql}`);
    const values = Array.isArray(params) ? params : Object.values(params || {});
    const result = await pool.query<T>(sql, values);
    return result.rows;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('PostgreSQL connection pool closed');
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }
}

export const db = PostgresConnection.getInstance();
