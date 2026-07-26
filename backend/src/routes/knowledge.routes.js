import { Router } from 'express';
import { getKnowledgeItems, getKnowledgeItem, createKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem } from '../controllers/knowledge.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, getKnowledgeItems);
router.get('/:id', authMiddleware, getKnowledgeItem);
router.post('/', authMiddleware, createKnowledgeItem);
router.put('/:id', authMiddleware, updateKnowledgeItem);
router.delete('/:id', authMiddleware, deleteKnowledgeItem);

export default router;
