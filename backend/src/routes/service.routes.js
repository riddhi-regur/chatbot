import { Router } from 'express';
import { getServices, getService, createService, updateService, deleteService } from '../controllers/service.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', getServices);
router.get('/:id', getService);
router.post('/', authMiddleware, createService);
router.put('/:id', authMiddleware, updateService);
router.delete('/:id', authMiddleware, deleteService);

export default router;
