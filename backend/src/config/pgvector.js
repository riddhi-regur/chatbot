import pg from 'pg';

const { Pool } = pg;

let pool;
let pgvectorAvailable = false;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function initPgVector() {
  const client = getPool();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_embeddings (
        id SERIAL PRIMARY KEY,
        kb_id INTEGER REFERENCES knowledge_base(id) ON DELETE CASCADE,
        embedding vector(768),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vector
      ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)
    `).catch(() => {});
    pgvectorAvailable = true;
    console.log('pgvector initialized successfully');
  } catch {
    pgvectorAvailable = false;
    console.log('pgvector not available - using tsvector full-text search fallback');
  }
}

export function isPgVectorAvailable() {
  return pgvectorAvailable;
}

export async function storeEmbedding(kbId, embedding) {
  if (!pgvectorAvailable) return;
  const client = getPool();
  const vectorStr = `[${embedding.join(',')}]`;
  await client.query(
    'INSERT INTO knowledge_embeddings (kb_id, embedding) VALUES ($1, $2)',
    [kbId, vectorStr]
  );
}

export async function searchSimilar(queryEmbedding, topK = 5) {
  if (!pgvectorAvailable) return [];
  const client = getPool();
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const result = await client.query(
    `SELECT kb.id, kb.title, kb.content, kb.category, kb.metadata,
            1 - (ke.embedding <=> $1::vector) AS similarity
     FROM knowledge_embeddings ke
     JOIN knowledge_base kb ON kb.id = ke.kb_id
     ORDER BY ke.embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, topK]
  );
  return result.rows;
}

export async function deleteEmbedding(kbId) {
  if (!pgvectorAvailable) return;
  const client = getPool();
  await client.query('DELETE FROM knowledge_embeddings WHERE kb_id = $1', [kbId]);
}
