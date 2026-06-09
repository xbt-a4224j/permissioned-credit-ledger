// Indexer resume cursor · #16
// getCursor/setCursor persist the last fully-processed block so a restart resumes from there
// (the Fuji-flakiness landmine: a dropped connection must be recoverable, not corrupting).
// Stored in the single-row indexer_cursor table (0005). Defaults to block 0 (full backfill).
import type { Sql } from "@pcl/shared";

export async function getCursor(sql: Sql): Promise<bigint> {
  const rows = await sql<{ block_number: bigint }[]>`select block_number from indexer_cursor where id = 1`;
  return rows[0]?.block_number ?? 0n;
}

// #16 advance the cursor (monotonic — never rewind below the current high-water mark unless
// explicitly resetting). Called after a backfill window + after each live event commits.
export async function setCursor(sql: Sql, blockNumber: bigint): Promise<void> {
  await sql`
    insert into indexer_cursor (id, block_number, updated_at) values (1, ${blockNumber.toString()}, now())
    on conflict (id) do update set block_number = excluded.block_number, updated_at = now()
  `;
}
