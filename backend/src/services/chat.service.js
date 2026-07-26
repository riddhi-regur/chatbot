import { getPrisma } from '../config/database.js';
import { generateChatResponse, checkOllamaHealth } from '../config/ollama.js';
import { detectIntent, extractEntities, buildPromptContext } from './nlu.service.js';
import { searchKnowledge } from './rag.service.js';
import * as appointmentService from './appointment.service.js';

const chatSessions = new Map();

export async function processMessage(visitorId, userMessage) {
  const prisma = getPrisma();

  let session = chatSessions.get(visitorId);
  if (!session) {
    const dbSession = await prisma.chatSession.create({
      data: { visitorId },
    });
    session = { dbSession, history: [] };
    chatSessions.set(visitorId, session);
  }

  await prisma.chatMessage.create({
    data: { sessionId: session.dbSession.id, role: 'user', content: userMessage },
  });

  const { intent, confidence } = detectIntent(userMessage);
  const entities = extractEntities(userMessage);

  await prisma.chatMessage.create({
    data: {
      sessionId: session.dbSession.id,
      role: 'assistant',
      content: `[intent:${intent}]`,
      intent,
    },
  });

  let response = '';

  if (session.bookingState) {
    response = await handleBookingIntent(visitorId, userMessage, entities, session);
  } else if (intent === 'book_appointment') {
    response = await handleBookingIntent(visitorId, userMessage, entities, session);
  } else if (intent === 'check_availability') {
    response = await handleAvailabilityIntent(entities);
  } else if (intent === 'cancel_appointment') {
    response = 'I can help you cancel your appointment. Could you please provide your name or phone number so I can look it up?';
  } else if (['service_inquiry', 'treatment_inquiry', 'doctor_inquiry', 'pricing', 'hours', 'contact'].includes(intent)) {
    response = await handleKnowledgeIntent(userMessage, intent, entities);
  } else {
    response = await handleGeneralIntent(userMessage, session);
  }

  session.history.push({ role: 'user', content: userMessage });
  session.history.push({ role: 'assistant', content: response });

  await prisma.chatMessage.create({
    data: {
      sessionId: session.dbSession.id,
      role: 'assistant',
      content: response,
      intent,
    },
  });

  return { response, intent, sessionId: session.dbSession.id };
}

async function handleBookingIntent(visitorId, message, entities, session) {
  const prisma = getPrisma();
  const bookingState = session.bookingState || {};

  if (!bookingState.patientName) {
    const nameMatch = message.match(/(?:i'm|i am|my name is|name)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    if (nameMatch) {
      session.bookingState = { ...bookingState, patientName: nameMatch[1] };
      return `Thank you, ${nameMatch[1]}! Which service would you like to book? Here are our services:\n\n${await getServicesList()}\n\nPlease tell me the service you need.`;
    }
    return 'I\'d be happy to help you book an appointment! What is your name?';
  }

  if (!bookingState.serviceId) {
    const services = await prisma.service.findMany({ where: { isActive: true } });
    const matched = services.find(s =>
      message.toLowerCase().includes(s.name.toLowerCase())
    );
    if (matched) {
      session.bookingState = { ...bookingState, serviceId: matched.id, serviceName: matched.name };
      return `Great choice! ${matched.name} - that takes about ${matched.durationMinutes} minutes.\n\nWhat date would you like? (e.g., tomorrow, 2024-01-15)`;
    }
    return `Which service would you like? Here are our services:\n\n${await getServicesList()}`;
  }

  if (!bookingState.date) {
    let date = null;
    const today = new Date();

    if (/today/i.test(message)) {
      date = today.toISOString().split('T')[0];
    } else if (/tomorrow/i.test(message)) {
      const tmr = new Date(today);
      tmr.setDate(tmr.getDate() + 1);
      date = tmr.toISOString().split('T')[0];
    } else {
      const dateMatch = message.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (dateMatch) {
        date = dateMatch[0];
      } else {
        const dateMatch2 = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dateMatch2) {
          date = `${dateMatch2[3]}-${dateMatch2[1].padStart(2, '0')}-${dateMatch2[2].padStart(2, '0')}`;
        }
      }
    }

    if (date) {
      session.bookingState = { ...bookingState, date };
      return `What time works for you on ${date}? Available slots:\n${await getAvailableSlotsText(1, date)}`;
    }
    return 'What date would you like the appointment? (e.g., tomorrow, 2024-01-15)';
  }

  if (!bookingState.time) {
    const timeMatch = message.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i) || message.match(/(\d{1,2})\s*(am|pm)/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const min = timeMatch[2] ? timeMatch[2] : '00';
      if (timeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;
      const time = `${hour}:${min}`;

      session.bookingState = { ...bookingState, time };
      return `Please confirm your booking:\n\n` +
        `- Patient: ${bookingState.patientName}\n` +
        `- Service: ${bookingState.serviceName}\n` +
        `- Date: ${bookingState.date}\n` +
        `- Time: ${time}\n\n` +
        `Type "confirm" to book, or "cancel" to start over.`;
    }
    return `Available time slots for ${bookingState.date}:\n${await getAvailableSlotsText(1, bookingState.date)}\n\nPlease pick a time.`;
  }

  if (/confirm|yes|book it/i.test(message)) {
    try {
      const services = await prisma.service.findMany({ where: { isActive: true } });
      const service = services.find(s => s.id === bookingState.serviceId);
      const doctorId = service?.doctorId || 1;

      const appointment = await appointmentService.createAppointment({
        patientName: bookingState.patientName,
        doctorId,
        serviceId: bookingState.serviceId,
        date: bookingState.date,
        time: bookingState.time,
      });

      session.bookingState = null;
      return `Your appointment has been booked!\n\n` +
        `Booking #${appointment.id}\n` +
        `Doctor: Dr. ${appointment.doctor.name}\n` +
        `Service: ${appointment.service.name}\n` +
        `Date: ${bookingState.date}\n` +
        `Time: ${bookingState.time}\n` +
        `Status: Booked\n\n` +
        `You will receive a confirmation once the clinic reviews your booking. Thank you!`;
    } catch (err) {
      return `Sorry, there was an issue booking: ${err.message}. Would you like to try a different time?`;
    }
  }

  if (/cancel|start over|restart/i.test(message)) {
    session.bookingState = null;
    return 'Booking cancelled. How can I help you?';
  }

  return 'Please type "confirm" to book or "cancel" to start over.';
}

async function handleAvailabilityIntent(entities) {
  const prisma = getPrisma();
  const doctors = await prisma.doctor.findMany({ where: { isActive: true } });

  if (entities.doctorName) {
    const doctor = doctors.find(d =>
      d.name.toLowerCase().includes(entities.doctorName.toLowerCase())
    );
    if (doctor) {
      const date = entities.date || new Date().toISOString().split('T')[0];
      return `Dr. ${doctor.name} (${doctor.specialization}) - Availability for ${date}:\n` +
        `${await getAvailableSlotsText(doctor.id, date)}`;
    }
    return `Doctor "${entities.doctorName}" not found. Our doctors:\n${doctors.map(d => `- Dr. ${d.name} (${d.specialization})`).join('\n')}`;
  }

  return `Our doctors and their availability:\n${doctors.map(d =>
    `- Dr. ${d.name} (${d.specialization}) - Days: ${(d.availableDays || []).join(', ')}`
  ).join('\n')}\n\nWould you like to check a specific doctor's availability?`;
}

async function handleKnowledgeIntent(message, intent, entities) {
  const results = await searchKnowledge(message, 3);

  if (results.length > 0) {
    const topResults = results.filter(r => r.similarity > 0.2);
    if (topResults.length > 0) {
      return topResults.map(r => r.content).join('\n\n');
    }
  }

  const prisma = getPrisma();

  if (intent === 'service_inquiry' || intent === 'treatment_inquiry') {
    return `Here are our services:\n${await getServicesList()}`;
  }
  if (intent === 'doctor_inquiry') {
    const doctors = await prisma.doctor.findMany({ where: { isActive: true } });
    return `Our doctors:\n${doctors.map(d => `- Dr. ${d.name} - ${d.specialization}`).join('\n')}`;
  }

  return 'I\'m not sure about that. Could you rephrase your question? I can help with services, doctors, appointments, and general clinic information.';
}

async function handleGeneralIntent(message, session) {
  const knowledgeResults = await searchKnowledge(message, 3);

  const ollamaAvailable = await checkOllamaHealth();
  if (ollamaAvailable && knowledgeResults.length > 0) {
    const systemPrompt = buildPromptContext('general', {}, knowledgeResults, session.history.slice(-6));
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];
    return await generateChatResponse(messages);
  }

  if (knowledgeResults.length > 0) {
    return knowledgeResults[0].content;
  }

  return 'I can help you with:\n- Our services and treatments\n- Doctor information\n- Booking appointments\n- Checking availability\n- Clinic hours and contact info\n\nWhat would you like to know?';
}

async function getServicesList() {
  const prisma = getPrisma();
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { doctor: true },
  });

  return services.map(s =>
    `- ${s.name}: ${s.description || 'No description'} (${s.durationMinutes} min) - $${s.price || 'N/A'} - ${s.doctor.name}`
  ).join('\n');
}

async function getAvailableSlotsText(doctorId, date) {
  try {
    const result = await appointmentService.getAvailableSlots(doctorId, date);
    if (!result.available) return result.reason || 'No slots available';
    const available = result.slots.filter(s => s.available);
    return available.length > 0
      ? available.map(s => s.time).join(', ')
      : 'No available slots for this date.';
  } catch {
    return 'Unable to check availability.';
  }
}

export async function endSession(visitorId) {
  const prisma = getPrisma();
  const session = chatSessions.get(visitorId);
  if (session) {
    await prisma.chatSession.update({
      where: { id: session.dbSession.id },
      data: { endedAt: new Date() },
    });
    chatSessions.delete(visitorId);
  }
}
