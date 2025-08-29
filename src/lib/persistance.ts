// lib/persistence.ts
import { getPool } from "./vectorstore";
import type { IngestDoc } from "./graphs/indexGraph";

const TABLE = "rag_docs";

export async function ensureTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id TEXT PRIMARY KEY,
      ns TEXT[] NOT NULL,
      text TEXT NOT NULL,
      url TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS ${TABLE}_ns_idx ON ${TABLE} USING GIN (ns);`);
}

export async function saveDocsToPg(docs: IngestDoc[], ns: readonly string[]) {
  if (!docs.length) return;
  const pool = getPool();
  await ensureTable();

  const values: any[] = [];
  const tuples = docs
    .map((d, i) => {
      values.push(d.id, ns, d.text, d.url ?? null, JSON.stringify(d.metadata ?? {}));
      const o = i * 5;
      return `($${o + 1}, $${o + 2}::text[], $${o + 3}, $${o + 4}, $${o + 5}::jsonb)`;
    })
    .join(",");

  await pool.query(
    `INSERT INTO ${TABLE} (id, ns, text, url, metadata)
     VALUES ${tuples}
     ON CONFLICT (id)
     DO UPDATE SET text = EXCLUDED.text, url = EXCLUDED.url, metadata = EXCLUDED.metadata`,
    values
  );
}

export type PersistedDoc = IngestDoc & { ns: string[] };

export async function loadAllDocsFromPg(filterNs?: readonly string[]): Promise<PersistedDoc[]> {
  const pool = getPool();
  await ensureTable();

  const res = filterNs?.length
    ? await pool.query(
      `SELECT id, ns, text, url, metadata FROM ${TABLE} WHERE ns @> $1::text[]`,
      [filterNs]
    )
    : await pool.query(`SELECT id, ns, text, url, metadata FROM ${TABLE}`);

  return res.rows.map((r) => ({
    id: r.id,
    text: r.text,
    url: r.url ?? undefined,
    metadata: r.metadata ?? {},
    ns: r.ns
  }));
}
