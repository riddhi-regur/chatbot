import { processMessage, endSession } from '../services/chat.service.js';
import { v4 as uuidv4 } from 'uuid';

export async function sendMessage(req, res, next) {
  try {
    const { message, visitorId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const vid = visitorId || uuidv4();
    const result = await processMessage(vid, message);

    res.json({
      response: result.response,
      intent: result.intent,
      visitorId: vid,
      sessionId: result.sessionId,
    });
  } catch (err) {
    next(err);
  }
}

export async function closeSession(req, res, next) {
  try {
    const { visitorId } = req.body;
    if (visitorId) {
      await endSession(visitorId);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
