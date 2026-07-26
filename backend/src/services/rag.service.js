import { embedText, isOllamaAvailable } from './embedding.service.js';
import { searchSimilar, isPgVectorAvailable } from '../config/pgvector.js';
import { getPrisma } from '../config/database.js';

export async function searchKnowledge(query, topK = 5) {
  const ollamaAvailable = await isOllamaAvailable();
  const vectorAvailable = isPgVectorAvailable();

  if (ollamaAvailable && vectorAvailable) {
    const queryEmbedding = await embedText(query);
    if (queryEmbedding) {
      try {
        const results = await searchSimilar(queryEmbedding, topK);
        if (results.length > 0) {
          return results.map(r => ({
            id: r.id,
            title: r.title,
            content: r.content,
            category: r.category,
            similarity: parseFloat(r.similarity),
          }));
        }
      } catch (err) {
        console.error('Vector search failed, falling back to tsvector:', err.message);
      }
    }
  }

  return await fallbackSearch(query, topK);
}

async function fallbackSearch(query, topK) {
  const prisma = getPrisma();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  if (words.length === 0) return [];

  const results = await prisma.$queryRaw`
    SELECT id, title, content, category, metadata,
           ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ${words.join(' ')})) AS rank
    FROM knowledge_base
    WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${words.join(' ')})
    ORDER BY rank DESC
    LIMIT ${topK}
  `;

  return results.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    similarity: parseFloat(r.rank || 0.5),
  }));
}

export async function indexKnowledgeBase(kbId, content) {
  const { embedAndStore } = await import('./embedding.service.js');
  await embedAndStore(kbId, content);
}
