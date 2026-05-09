import assert from 'node:assert/strict';
import test from 'node:test';
import { maskDatabaseUrl, parseDatabaseUrl } from './database-url.js';

test('parseDatabaseUrl parses PostgreSQL connection strings', () => {
  const result = parseDatabaseUrl('postgresql://app_user:s3cret@db.example.com:5433/app_db?sslmode=require');

  assert.deepEqual(result, {
    host: 'db.example.com',
    port: 5433,
    name: 'app_db',
    user: 'app_user',
    password: 's3cret',
    ssl: true,
  });
});

test('parseDatabaseUrl requires a PostgreSQL protocol and database name', () => {
  assert.throws(() => parseDatabaseUrl('mysql://user:pass@localhost/app_db'), /postgresql/i);
  assert.throws(() => parseDatabaseUrl('postgresql://user:pass@localhost'), /database name/);
});

test('maskDatabaseUrl hides passwords', () => {
  assert.equal(
    maskDatabaseUrl('postgresql://app_user:s3cret@localhost:5432/app_db'),
    'postgresql://app_user:********@localhost:5432/app_db',
  );
});
