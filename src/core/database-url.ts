export interface DatabaseUrlConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export function parseDatabaseUrl(value: string): DatabaseUrlConfig {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must start with postgresql://');
  }

  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name) {
    throw new Error(
      'DATABASE_URL must include a database name, for example postgresql://user:pass@host:5432/app_db',
    );
  }

  const sslMode = url.searchParams.get('sslmode');

  return {
    host: url.hostname || 'localhost',
    port: url.port ? Number.parseInt(url.port, 10) : 5432,
    name,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl:
      url.searchParams.get('ssl') === 'true' ||
      sslMode === 'require' ||
      sslMode === 'verify-ca' ||
      sslMode === 'verify-full',
  };
}

export function maskDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) {
      url.password = '********';
    }
    return url.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
}
