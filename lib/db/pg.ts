import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

declare global {
  // eslint-disable-next-line no-var
  var _pgSql: postgres.Sql | undefined;
}

function create(): postgres.Sql {
  return postgres(DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
    connection: { statement_timeout: 10000 },
    // NUMERIC (oid 1700) -> JS number, to match what the Mongo driver returned.
    types: {
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: unknown) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

// Reuse the pool across HMR reloads in dev to avoid exhausting connections.
export const sql: postgres.Sql =
  process.env.NODE_ENV === 'production'
    ? create()
    : (globalThis._pgSql ??= create());

export default sql;
