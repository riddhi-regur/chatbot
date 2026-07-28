const INTENT_PATTERNS = {
  service_inquiry: [
    /what services/i, /services offered/i, /what do you offer/i,
    /treatments available/i, /treatments offered/i, /what treatment/i,
    /do you have/i, /do you provide/i, /do you do/i,
  ],
  doctor_inquiry: [
    /who are the doctors/i, /your doctors/i, /which doctor/i,
    /meet the doctor/i, /about the doctor/i, /dr\./i, /doctor/i,
    /physician/i, /specialist/i,
  ],
  book_appointment: [
    /book.*appointment/i, /schedule.*appointment/i, /make.*appointment/i,
    /want to book/i, /want to schedule/i, /set up.*appointment/i,
    /need.*appointment/i, /fix.*appointment/i, /appointment book/i,
    /i want to see/i, /i need to see/i, /visit/i,
    /i want (?:a|an|the|to)\b/i, /i need (?:a|an|the|to)\b/i,
    /i'd like/i, /looking for/i,
  ],
  check_availability: [
    /available/i, /availability/i, /when is/i, /open/i, /openings/i,
    /free slot/i, /free time/i, /next available/i,
  ],
  cancel_appointment: [
    /cancel.*appointment/i, /cancel booking/i, /reschedule/i,
    /change.*appointment/i, /modify.*appointment/i,
  ],
  pricing: [
    /how much/i, /price/i, /cost/i, /fee/i, /charges/i, /payment/i,
    /insurance/i,
  ],
  hours: [
    /hours/i, /timing/i, /open.*close/i, /working hours/i,
    /when.*open/i, /when.*close/i, /operating hours/i,
  ],
  contact: [
    /phone/i, /call/i, /email/i, /address/i, /location/i, /where/i, /map/i,
  ],
};

const ENTITY_PATTERNS = {
  doctorName: /(?:dr\.?\s*|doctor\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  date: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})|tomorrow|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|today|next\s+week/i,
  time: /(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm)/i,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  email: /[\w.-]+@[\w.-]+\.\w+/,
};

export function detectIntent(text) {
  const scores = {};

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    scores[intent] = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        scores[intent]++;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    return { intent: 'general', confidence: 0.5 };
  }

  const topIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const confidence = Math.min(topIntent[1] / 3, 1.0);

  return { intent: topIntent[0], confidence };
}

export function extractEntities(text) {
  const entities = {};

  for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      entities[type] = match[0];
    }
  }

  return entities;
}

export function buildPromptContext(intent, entities, knowledgeResults, conversationHistory = []) {
  const historyStr = conversationHistory
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const knowledgeStr = knowledgeResults
    .map(r => `[${r.category}] ${r.title || ''}: ${r.content}`)
    .join('\n\n');

  const systemPrompt = `You are a helpful clinic assistant for a medical clinic. You help patients with:
- Answering questions about services and treatments
- Providing information about doctors and specialists
- Booking appointments
- Checking availability
- Answering general clinic questions

Rules:
- Be professional, friendly, and concise
- Always confirm details before booking an appointment
- If you don't know something, say so honestly
- Ask for missing information politely
- When booking, collect: patient name, phone/email, preferred doctor, service, date, time

Detected intent: ${intent}
Extracted entities: ${JSON.stringify(entities)}

Knowledge base context:
${knowledgeStr || 'No specific knowledge base results found.'}

${historyStr ? `Conversation history:\n${historyStr}\n` : ''}`;

  return systemPrompt;
}
