# Testing

Run local checks:

```bash
npm install
npm run build
npm test
```

## Optional PostgreSQL Integration Test

Start a local PostgreSQL instance:

```bash
docker run --name postgres-mcp-test \
  -e POSTGRES_PASSWORD=postgres_password \
  -e POSTGRES_DB=app_db \
  -p 5432:5432 \
  -d postgres:16
```

Create sample role and tables:

```bash
docker exec -i postgres-mcp-test psql -U postgres -d app_db <<'SQL'
CREATE ROLE app_user LOGIN PASSWORD 'change_me';
GRANT CONNECT ON DATABASE app_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

CREATE TABLE customers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  name text,
  password_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE orders (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id),
  status text NOT NULL,
  total numeric(10, 2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO customers (email, name) VALUES
  ('ada@example.com', 'Ada'),
  ('grace@example.com', 'Grace');

INSERT INTO orders (customer_id, status, total) VALUES
  (1, 'paid', 42.50),
  (2, 'pending', 19.99);

GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
SQL
```

Configure `.env`:

```dotenv
DATABASE_URL=postgresql://app_user:change_me@localhost:5432/app_db
DB_SCHEMA=public
SCHEMA_ONLY_MODE=true
```

Then run:

```bash
npm run build
npm start
```

Use an MCP client to call `get_schema`, `find_tables`, `get_relationships`, and, when access control is configured, `execute_query`.
