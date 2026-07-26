import { getPrisma } from '../config/database.js';
import { indexKnowledgeBase } from '../services/rag.service.js';
import { removeEmbedding } from '../services/embedding.service.js';

export async function getKnowledgeItems(req, res, next) {
  try {
    const prisma = getPrisma();
    const { category } = req.query;
    const where = category ? { category } : {};
    const items = await prisma.knowledgeBase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function getKnowledgeItem(req, res, next) {
  try {
    const prisma = getPrisma();
    const item = await prisma.knowledgeBase.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function createKnowledgeItem(req, res, next) {
  try {
    const prisma = getPrisma();
    const { title, content, category, metadata } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });

    const item = await prisma.knowledgeBase.create({
      data: { title, content, category, metadata },
    });

    try {
      await indexKnowledgeBase(item.id, `${title || ''} ${content}`);
    } catch (e) {
      console.error('Embedding failed (non-critical):', e.message);
    }

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function updateKnowledgeItem(req, res, next) {
  try {
    const prisma = getPrisma();
    const { title, content, category, metadata } = req.body;
    const item = await prisma.knowledgeBase.update({
      where: { id: parseInt(req.params.id) },
      data: { title, content, category, metadata },
    });

    try {
      await removeEmbedding(item.id);
      await indexKnowledgeBase(item.id, `${title || ''} ${content}`);
    } catch (e) {
      console.error('Re-indexing failed (non-critical):', e.message);
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function deleteKnowledgeItem(req, res, next) {
  try {
    const prisma = getPrisma();
    const id = parseInt(req.params.id);
    await removeEmbedding(id);
    await prisma.knowledgeBase.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
