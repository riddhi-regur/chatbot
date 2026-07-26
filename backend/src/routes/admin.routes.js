import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getPrisma } from '../config/database.js';
import { checkOllamaHealth } from '../config/ollama.js';

const router = Router();

router.get('/dashboard', authMiddleware, async (req, res, next) => {
  try {
    const prisma = getPrisma();
    const [totalAppointments, todayAppointments, totalDoctors, totalServices, totalKB, chatSessions] = await Promise.all([
      prisma.appointment.count(),
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.doctor.count({ where: { isActive: true } }),
      prisma.service.count({ where: { isActive: true } }),
      prisma.knowledgeBase.count(),
      prisma.chatSession.count(),
    ]);

    const ollamaStatus = await checkOllamaHealth();

    res.json({
      totalAppointments,
      todayAppointments,
      totalDoctors,
      totalServices,
      totalKB,
      chatSessions,
      ollamaStatus,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
