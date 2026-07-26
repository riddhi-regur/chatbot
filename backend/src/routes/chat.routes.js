import { Router } from 'express';
import { sendMessage, closeSession } from '../controllers/chat.controller.js';

const router = Router();

router.post('/send', sendMessage);
router.post('/close', closeSession);

export default router;
