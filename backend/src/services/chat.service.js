import { getPrisma } from "../config/database.js";
import { generateChatResponse, checkOllamaHealth } from "../config/ollama.js";
import {
  detectIntent,
  extractEntities,
  buildPromptContext,
} from "./nlu.service.js";
import { searchKnowledge } from "./rag.service.js";
import * as appointmentService from "./appointment.service.js";

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
    data: {
      sessionId: session.dbSession.id,
      role: "user",
      content: userMessage,
    },
  });

  const { intent, confidence } = detectIntent(userMessage);
  const entities = extractEntities(userMessage);

  await prisma.chatMessage.create({
    data: {
      sessionId: session.dbSession.id,
      role: "assistant",
      content: `[intent:${intent}]`,
      intent,
    },
  });

  let response = "";

  if (session.bookingState) {
    response = await handleBookingIntent(
      visitorId,
      userMessage,
      entities,
      session,
    );
  } else if (session.statusLookup) {
    session.statusLookup = false;
    response = await handleBookingStatusLookup(userMessage, visitorId);
  } else if (intent === "book_appointment") {
    response = await handleBookingIntent(
      visitorId,
      userMessage,
      entities,
      session,
    );
  } else if (intent === "booking_status") {
    response = await handleBookingStatusIntent(session);
  } else if (intent === "check_availability") {
    response = await handleAvailabilityIntent(entities);
  } else if (intent === "cancel_appointment") {
    response =
      "I can help you cancel your appointment. Could you please provide your name or phone number so I can look it up?";
  } else if (
    [
      "service_inquiry",
      "treatment_inquiry",
      "doctor_inquiry",
      "pricing",
      "hours",
      "contact",
    ].includes(intent)
  ) {
    response = await handleKnowledgeIntent(userMessage, intent, entities, session);
  } else {
    response = await handleGeneralIntent(userMessage, session);
  }

  session.history.push({ role: "user", content: userMessage });
  session.history.push({ role: "assistant", content: response });

  await prisma.chatMessage.create({
    data: {
      sessionId: session.dbSession.id,
      role: "assistant",
      content: response,
      intent,
    },
  });

  return { response, intent, sessionId: session.dbSession.id };
}

async function handleBookingIntent(visitorId, message, entities, session) {
  const prisma = getPrisma();
  if (!session.bookingState) session.bookingState = {};
  const bookingState = session.bookingState;

  if (!bookingState.patientName) {
    const nameMatch = message.match(
      /(?:i'm|i am|my name is|name)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    );
    if (nameMatch) {
      session.bookingState = { ...bookingState, patientName: nameMatch[1] };
      return `Thank you, ${nameMatch[1]}! Which service would you like to book? Here are our services:\n\n${await getServicesList()}\n\nPlease tell me the service you need.`;
    }

    const bareName = message.trim().match(
      /^[A-Z][a-z]{1,30}$/,
    );
    if (bareName) {
      const name = bareName[0];
      session.bookingState = { ...bookingState, patientName: name };
      return `Thank you, ${name}! Which service would you like to book? Here are our services:\n\n${await getServicesList()}\n\nPlease tell me the service you need.`;
    }

    return "I'd be happy to help you book an appointment! What is your name?";
  }

  if (!bookingState.serviceId) {
    const services = await prisma.service.findMany({
      where: { isActive: true },
    });
    const msgLower = message.toLowerCase();
    const matched = services.find((s) => {
      const searchable = `${s.name} ${s.description || ''}`.toLowerCase();
      return searchable.includes(msgLower);
    });
    if (matched) {
      session.bookingState = {
        ...bookingState,
        serviceId: matched.id,
        serviceName: matched.name,
      };
      return `Great choice! ${matched.name} - that takes about ${matched.durationMinutes} minutes.\n\nWhat date would you like? (e.g., tomorrow, 2024-01-15)`;
    }
    return `Which service would you like? Here are our services:\n\n${await getServicesList()}`;
  }

  if (!bookingState.date) {
    let date = null;
    const today = new Date();

    if (/today/i.test(message)) {
      date = today.toISOString().split("T")[0];
    } else if (/tomorrow/i.test(message)) {
      const tmr = new Date(today);
      tmr.setDate(tmr.getDate() + 1);
      date = tmr.toISOString().split("T")[0];
    } else {
      const dateMatch = message.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (dateMatch) {
        date = dateMatch[0];
      } else {
        const dateMatch2 = message.match(
          /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
        );
        if (dateMatch2) {
          date = `${dateMatch2[3]}-${dateMatch2[1].padStart(2, "0")}-${dateMatch2[2].padStart(2, "0")}`;
        }
      }
    }

    if (date) {
      session.bookingState = { ...bookingState, date };
      return `What time works for you on ${date}? Available slots:\n${await getAvailableSlotsText(1, date)}`;
    }
    return "What date would you like the appointment? (e.g., tomorrow, 2024-01-15)";
  }

  if (!bookingState.time) {
    const timeMatch =
      message.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i) ||
      message.match(/(\d{1,2})\s*(am|pm)/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const min = timeMatch[2] ? timeMatch[2] : "00";
      if (timeMatch[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
      if (timeMatch[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
      const time = `${hour}:${min}`;

      session.bookingState = { ...bookingState, time };
      return "Thanks! One more thing — please provide your phone number so we can contact you regarding your appointment.";
    }
    return `Available time slots for ${bookingState.date}:\n${await getAvailableSlotsText(1, bookingState.date)}\n\nPlease pick a time.`;
  }

  if (!bookingState.patientPhone) {
    const phone = entities.phone || message.match(/\+?\d[\d\s\-().]{7,}\d/)?.[0];
    if (phone) {
      session.bookingState = { ...bookingState, patientPhone: phone };
      return (
        `Please confirm your booking:\n\n` +
        `- Patient: ${bookingState.patientName}\n` +
        `- Phone: ${phone}\n` +
        `- Service: ${bookingState.serviceName}\n` +
        `- Date: ${bookingState.date}\n` +
        `- Time: ${bookingState.time}\n\n` +
        `Type "confirm" to book, or "cancel" to start over.`
      );
    }
    return "Please provide your phone number (e.g., +1-555-0123) so we can contact you.";
  }

  if (/confirm|yes|book it/i.test(message)) {
    try {
      const services = await prisma.service.findMany({
        where: { isActive: true },
      });
      const service = services.find((s) => s.id === bookingState.serviceId);
      const doctorId = service?.doctorId || 1;

      const appointment = await appointmentService.createAppointment({
        patientName: bookingState.patientName,
        patientPhone: bookingState.patientPhone,
        doctorId,
        serviceId: bookingState.serviceId,
        date: bookingState.date,
        time: bookingState.time,
        visitorId,
      });

      session.bookingState = null;
      return (
        `Your appointment has been booked!\n\n` +
        `Booking #${appointment.id}\n` +
        `Patient: ${bookingState.patientName}\n` +
        `Phone: ${bookingState.patientPhone}\n` +
        `Doctor: ${appointment.doctor.name}\n` +
        `Service: ${appointment.service.name}\n` +
        `Date: ${bookingState.date}\n` +
        `Time: ${bookingState.time}\n` +
        `Status: Booked\n\n` +
        `You will receive a confirmation once the clinic reviews your booking. Thank you!`
      );
    } catch (err) {
      return `Sorry, there was an issue booking: ${err.message}. Would you like to try a different time?`;
    }
  }

  if (/cancel|start over|restart/i.test(message)) {
    session.bookingState = null;
    return "Booking cancelled. How can I help you?";
  }

  return 'Please type "confirm" to book or "cancel" to start over.';
}

async function handleAvailabilityIntent(entities) {
  const prisma = getPrisma();
  const doctors = await prisma.doctor.findMany({ where: { isActive: true } });

  if (entities.doctorName) {
    const doctor = doctors.find((d) =>
      d.name.toLowerCase().includes(entities.doctorName.toLowerCase()),
    );
    if (doctor) {
      const date = entities.date || new Date().toISOString().split("T")[0];
      return (
        `${doctor.name} (${doctor.specialization}) - Availability for ${date}:\n` +
        `${await getAvailableSlotsText(doctor.id, date)}`
      );
    }
    return `Doctor "${entities.doctorName}" not found. Our doctors:\n${doctors.map((d) => `- ${d.name} (${d.specialization})`).join("\n")}`;
  }

  return `Our doctors and their availability:\n${doctors
    .map(
      (d) =>
        `- ${d.name} (${d.specialization}) - Days: ${(d.availableDays || []).join(", ")}`,
    )
    .join("\n")}\n\nWould you like to check a specific doctor's availability?`;
}

async function handleBookingStatusIntent(session) {
  session.statusLookup = true;
  return "Could you please provide your name so I can look up your appointment status?";
}

async function handleBookingStatusLookup(name, visitorId) {
  const prisma = getPrisma();
  const appointments = await prisma.appointment.findMany({
    where: {
      patientName: { contains: name.trim(), mode: "insensitive" },
    },
    include: { doctor: true, service: true },
    orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
  });

  if (appointments.length === 0) {
    return `No appointments found for "${name}". Would you like to book a new appointment?`;
  }

  const upcoming = appointments.filter(
    (a) => new Date(a.appointmentDate) >= new Date(new Date().toDateString()),
  );
  const past = appointments.filter(
    (a) => new Date(a.appointmentDate) < new Date(new Date().toDateString()),
  );

  let response = `Here are the appointments for ${name}:\n\n`;

  if (upcoming.length > 0) {
    response += "**Upcoming:**\n";
    upcoming.forEach((a) => {
      const date = new Date(a.appointmentDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const time = new Date(a.appointmentTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      response += `• Booking #${a.id} — ${a.service.name} with ${a.doctor.name} on ${date} at ${time} [${a.status}]\n`;
    });
    response += "\n";
  }

  if (past.length > 0) {
    response += "**Past:**\n";
    past.forEach((a) => {
      const date = new Date(a.appointmentDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const time = new Date(a.appointmentTime).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      response += `• Booking #${a.id} — ${a.service.name} with ${a.doctor.name} on ${date} at ${time} [${a.status}]\n`;
    });
  }

  return response.trim();
}

async function handleKnowledgeIntent(message, intent, entities, session) {
  const results = await searchKnowledge(message, 3);

  if (results.length > 0) {
    const topResults = results.filter((r) => r.similarity > 0.2);
    if (topResults.length > 0) {
      return topResults.map((r) => r.content).join("\n\n");
    }
  }

  const prisma = getPrisma();

  if (intent === "service_inquiry" || intent === "treatment_inquiry") {
    return `Here are our services:\n${await getServicesList()}`;
  }
  if (intent === "doctor_inquiry") {
    const doctors = await prisma.doctor.findMany({ where: { isActive: true } });
    return `Our doctors:\n${doctors.map((d) => `- ${d.name} - ${d.specialization}`).join("\n")}`;
  }

  if (["contact", "hours", "pricing"].includes(intent)) {
    const ollamaAvailable = await checkOllamaHealth();
    if (ollamaAvailable) {
      const systemPrompt = buildPromptContext(
        intent,
        entities,
        results,
        session ? session.history.slice(-6) : [],
      );
      return await generateChatResponse([
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ]);
    }

    const keywords = {
      contact: ["phone", "email", "address", "location", "where", "parking"],
      hours: ["open", "close", "hours", "timing", "monday", "friday", "saturday", "sunday"],
      pricing: ["price", "cost", "payment", "insurance", "fee", "charge"],
    };
    const categoryMap = { contact: "general", hours: "general", pricing: "policy" };
    const kbEntries = await prisma.knowledgeBase.findMany({
      where: {
        category: categoryMap[intent],
        content: { contains: keywords[intent][0], mode: "insensitive" },
      },
      take: 3,
    });
    if (kbEntries.length > 0) {
      return kbEntries.map((e) => e.content).join("\n\n");
    }
  }

  const ollamaAvailable = await checkOllamaHealth();
  if (ollamaAvailable) {
    const systemPrompt = buildPromptContext(
      intent,
      entities,
      results,
      session ? session.history.slice(-6) : [],
    );
    return await generateChatResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]);
  }

  return "I'm not sure about that. Could you rephrase your question? I can help with services, doctors, appointments, and general clinic information.";
}

async function handleGeneralIntent(message, session) {
  const knowledgeResults = await searchKnowledge(message, 3);

  const ollamaAvailable = await checkOllamaHealth();
  if (ollamaAvailable) {
    const systemPrompt = buildPromptContext(
      "general",
      {},
      knowledgeResults,
      session.history.slice(-6),
    );
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];
    return await generateChatResponse(messages);
  }

  if (knowledgeResults.length > 0) {
    return knowledgeResults[0].content;
  }

  return "I can help you with:\n- Our services and treatments\n- Doctor information\n- Booking appointments\n- Checking availability\n- Clinic hours and contact info\n\nWhat would you like to know?";
}

async function getServicesList() {
  const prisma = getPrisma();
  const services = await prisma.service.findMany({
    where: { isActive: true },
    include: { doctor: true },
  });

  return services
    .map(
      (s) =>
        `- ${s.name}: ${s.description || "No description"} (${s.durationMinutes} min) - $${s.price || "N/A"} - ${s.doctor.name}`,
    )
    .join("\n");
}

async function getAvailableSlotsText(doctorId, date) {
  try {
    const result = await appointmentService.getAvailableSlots(doctorId, date);
    if (!result.available) return result.reason || "No slots available";
    const available = result.slots.filter((s) => s.available);
    return available.length > 0
      ? available.map((s) => s.time).join(", ")
      : "No available slots for this date.";
  } catch {
    return "Unable to check availability.";
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

export async function getHistory(visitorId) {
  const prisma = getPrisma();
  const sessions = await prisma.chatSession.findMany({
    where: { visitorId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, intent: true, createdAt: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  if (sessions.length === 0) return [];

  return sessions.flatMap((s) =>
    s.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      intent: m.intent,
      createdAt: m.createdAt,
    })),
  );
}

export async function getAllSessions({ page = 1, limit = 20, visitorId } = {}) {
  const prisma = getPrisma();
  const where = visitorId ? { visitorId: { contains: visitorId, mode: "insensitive" } } : {};

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, intent: true, createdAt: true },
        },
      },
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.chatSession.count({ where }),
  ]);

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      visitorId: s.visitorId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      messageCount: s.messages.length,
      intents: [...new Set(s.messages.map((m) => m.intent).filter(Boolean))],
      messages: s.messages,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function sendAppointmentNotification(visitorId, message) {
  const prisma = getPrisma();
  const sessions = await prisma.chatSession.findMany({
    where: { visitorId },
    orderBy: { startedAt: "desc" },
    take: 1,
  });
  if (sessions.length === 0) return null;

  const dbSession = sessions[0];
  const chatMessage = await prisma.chatMessage.create({
    data: {
      sessionId: dbSession.id,
      role: "assistant",
      content: message,
      intent: "notification",
    },
  });

  if (chatSessions.has(visitorId)) {
    const session = chatSessions.get(visitorId);
    session.history.push({ role: "assistant", content: message });
  }

  return chatMessage;
}
