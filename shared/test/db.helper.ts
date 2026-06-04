// #15/#18 test harness: spin a throwaway Postgres database per suite so runs are isolated
// and re-runnable against the verify-gate Postgres (docker compose -p pcl, port 55432).
// Each suite creates a uniquely-named db, applies migrations, and drops it on teardown.
import postgres from "postgres";
import { makeSql, type Sql } from "../src/db/client.ts";
import { applyMigrations } from "../src/db/migrate.ts";

const ADMIN_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/pcl";

function dbUrlFor(name: string): string {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${name}`;
  return u.toString();
}

// #15 create a fresh, uniquely-named database (admin connection to the base db).
export async function createThrowawayDb(prefix: string): Promise<{ name: string; url: string }> {
  const name = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`.toLowerCase();
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
  return { name, url: dbUrlFor(name) };
}

export async function dropThrowawayDb(name: string): Promise<void> {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  try {
    // terminate stragglers then drop.
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

// #15 convenience: a migrated client on a fresh db. Returns the client + a disposer.
export async function freshMigratedDb(prefix: string): Promise<{ sql: Sql; name: string; dispose: () => Promise<void> }> {
  const { name, url } = await createThrowawayDb(prefix);
  const sql = makeSql(url);
  await applyMigrations(sql);
  return {
    sql,
    name,
    dispose: async () => {
      await sql.end({ timeout: 5 });
      await dropThrowawayDb(name);
    },
  };
}
