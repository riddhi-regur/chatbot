import { Router } from 'express';
import { getAppointments, getAppointment, createAppointment, updateStatus, getAvailability, getStats } from '../controllers/appointment.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, getAppointments);
router.get('/stats', authMiddleware, getStats);
router.get('/availability', getAvailability);
router.get('/:id', authMiddleware, getAppointment);
router.post('/', createAppointment);
router.patch('/:id/status', authMiddleware, updateStatus);

export default router;
