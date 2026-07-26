import { generateEmbedding, checkOllamaHealth } from '../config/ollama.js';

let ollamaAvailable = null;

export async function isOllamaAvailable() {
  if (ollamaAvailable === null) {
    ollamaAvailable = await checkOllamaHealth();
    if (!ollamaAvailable) {
      console.warn('Ollama not available - RAG features will use fallback');
    }
  }
  return ollamaAvailable;
}

export async function embedText(text) {
  const available = await isOllamaAvailable();
  if (!available) {
    return null;
  }
  return await generateEmbedding(text);
}

export async function embedAndStore(kbId, text) {
  const embedding = await embedText(text);
  if (!embedding) return null;

  const { storeEmbedding } = await import('../config/pgvector.js');
  await storeEmbedding(kbId, embedding);
  return embedding;
}

export async function removeEmbedding(kbId) {
  const { deleteEmbedding } = await import('../config/pgvector.js');
  await deleteEmbedding(kbId);
}
