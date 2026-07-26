import { Router } from 'express';
import { getDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor } from '../controllers/doctor.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', getDoctors);
router.get('/:id', getDoctor);
router.post('/', authMiddleware, createDoctor);
router.put('/:id', authMiddleware, updateDoctor);
router.delete('/:id', authMiddleware, deleteDoctor);

export default router;
