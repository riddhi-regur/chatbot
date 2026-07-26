import fetch from 'node-fetch';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3.2';

export async function checkOllamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function generateEmbedding(text) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embedding failed: ${res.status}`);
  }

  const data = await res.json();
  return data.embeddings[0];
}

export async function generateChatResponse(messages, options = {}) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.maxTokens || 512,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama chat failed: ${res.status}`);
  }

  const data = await res.json();
  return data.message.content;
}

export { OLLAMA_BASE_URL, EMBED_MODEL, CHAT_MODEL };
