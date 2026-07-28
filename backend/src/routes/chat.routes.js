import { Router } from 'express';
import { sendMessage, closeSession, getChatHistory } from '../controllers/chat.controller.js';

const router = Router();

router.post('/send', sendMessage);
router.post('/close', closeSession);
router.get('/history', getChatHistory);

export default router;
