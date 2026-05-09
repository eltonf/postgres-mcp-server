# Authentication

This server uses standard PostgreSQL username/password authentication through `pg`.

Recommended environment:

```dotenv
DATABASE_URL=postgresql://app_user:change_me@localhost:5432/app_db
DB_SCHEMA=public
DB_SSL=false
```

For managed providers such as Supabase that require TLS, use a URL with `sslmode=require` or set `DB_SSL=true`.

Recommended least-privilege grants:

```sql
CREATE ROLE app_user LOGIN PASSWORD 'change_me';
GRANT CONNECT ON DATABASE app_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_user;
```
