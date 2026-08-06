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
    const existing = await prisma.chatSession.findFirst({
      where: { visitorId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    const dbSession =
      existing ||
      (await prisma.chatSession.create({
        data: { visitorId },
      }));
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

  // await prisma.chatMessage.create({
  //   data: {
  //     sessionId: session.dbSession.id,
  //     role: "assistant",
  //     content: `[intent:${intent}]`,
  //     intent,
  //   },
  // });

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
    response = await handleBookingStatusLookup(userMessage, visitorId, session);
  } else if (intent === "book_appointment") {
    response = await handleBookingIntent(
      visitorId,
      userMessage,
      entities,
      session,
    );
  } else if (intent === "booking_status") {
    response = await handleBookingStatusIntent(session, visitorId, userMessage);
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
    response = await handleKnowledgeIntent(
      userMessage,
      intent,
      entities,
      session,
    );
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

const NAME_STOPWORDS = /\b(today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

async function handleBookingIntent(visitorId, message, entities, session) {
  const prisma = getPrisma();
  if (!session.bookingState) session.bookingState = {};
  const bookingState = session.bookingState;

  if (!bookingState.patientName) {
    const nameMatch = message.match(
      /(?:i'm|i am|my name is|name)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    );
    const forMatch = message.match(/\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    const bareName = message.trim().match(/^[A-Za-z]{2,30}$/);
    const name =
      nameMatch?.[1] ||
      (forMatch && !NAME_STOPWORDS.test(forMatch[1]) ? forMatch[1] : null) ||
      (bareName && !NAME_STOPWORDS.test(bareName[0])
        ? bareName[0].replace(/^\w/, (c) => c.toUpperCase())
        : null);

    if (name) {
      session.bookingState = { ...bookingState, patientName: name };

      if (/\bsame\b/i.test(message)) {
        const prev = await getLastServiceForVisitor(visitorId);
        if (prev) {
          session.bookingState = {
            ...bookingState,
            patientName: name,
            serviceId: prev.serviceId,
            serviceName: prev.serviceName,
          };
          return `Great choice! ${prev.serviceName} - same service as your last appointment.\n\nWhat date would you like? (e.g., tomorrow, 2024-01-15)`;
        }
      }

      return `Thank you, ${name}! Which service would you like to book? Here are our services:\n\n${await getServicesList()}\n\nPlease tell me the service you need.`;
    }

    return "I'd be happy to help you book an appointment! What is your name?";
  }

  if (!bookingState.serviceId) {
    if (/\bsame\b/i.test(message)) {
      const prev = await getLastServiceForVisitor(visitorId);
      if (prev) {
        session.bookingState = {
          ...bookingState,
          serviceId: prev.serviceId,
          serviceName: prev.serviceName,
        };
        return `Great choice! ${prev.serviceName} - same service as your last appointment.\n\nWhat date would you like? (e.g., tomorrow, 2024-01-15)`;
      }
    }

    const services = await prisma.service.findMany({
      where: { isActive: true },
    });
    const msgLower = message.toLowerCase();
    const matched = services.find((s) => {
      const searchable = `${s.name} ${s.description || ""}`.toLowerCase();
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

    const userText = session.history
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ")
      .toLowerCase();
    const historyMatch = services.find((s) =>
      userText.includes(s.name.toLowerCase()),
    );
    if (historyMatch) {
      session.bookingState = {
        ...bookingState,
        serviceId: historyMatch.id,
        serviceName: historyMatch.name,
      };
      return `Great choice! ${historyMatch.name} - that takes about ${historyMatch.durationMinutes} minutes.\n\nWhat date would you like? (e.g., tomorrow, 2024-01-15)`;
    }

    return `Which service would you like? Here are our services:\n\n${await getServicesList()}`;
  }

  if (/change|different|wrong|not this|go back|switch/i.test(message)) {
    const services = await prisma.service.findMany({
      where: { isActive: true },
    });
    const msgLower = message.toLowerCase();
    const newService = services.find((s) => {
      const searchable = `${s.name} ${s.description || ""}`.toLowerCase();
      return searchable.includes(msgLower);
    });
    if (newService && newService.id !== bookingState.serviceId) {
      session.bookingState = {
        ...bookingState,
        serviceId: newService.id,
        serviceName: newService.name,
      };
      return `Switched to ${newService.name} - that takes about ${newService.durationMinutes} minutes.\n\nWhat date would you like? (e.g., tomorrow, 2024-01-15)`;
    }
    session.bookingState = {
      ...bookingState,
      serviceId: undefined,
      serviceName: undefined,
    };
    return `Which service would you like? Here are our services:\n\n${await getServicesList()}`;
  }

  if (!bookingState.date) {
    if (/change|different|wrong|not this|go back|switch/i.test(message)) {
      session.bookingState = {
        ...bookingState,
        date: undefined,
        time: undefined,
        patientPhone: undefined,
      };
      return `Which service would you like? Here are our services:\n\n${await getServicesList()}`;
    }

    const date = parseDateFromMessage(message);
    const time = parseTimeFromMessage(message);

    if (date) {
      const updated = { ...bookingState, date };
      session.bookingState = updated;

      if (time) {
        if (time.hour < 9 || time.hour >= 17) {
          return `Please pick a time between 9:00 and 16:30.\n\nAvailable slots for ${date}:\n${await getAvailableSlotsText(1, date)}`;
        }
        const timeStr = `${time.hour}:${time.min}`;
        session.bookingState = { ...updated, time: timeStr };
        if (!bookingState.patientPhone) {
          return "Thanks! One more thing — please provide your phone number so we can contact you regarding your appointment.";
        }
        return (
          `Please confirm your booking:\n\n` +
          `- Patient: ${bookingState.patientName}\n` +
          `- Phone: ${bookingState.patientPhone}\n` +
          `- Service: ${bookingState.serviceName}\n` +
          `- Date: ${date}\n` +
          `- Time: ${timeStr}\n\n` +
          `Type "confirm" to book, or "cancel" to start over.`
        );
      }

      return `What time works for you on ${date}? Available slots:\n${await getAvailableSlotsText(1, date)}`;
    }
    return "What date would you like the appointment? (e.g., tomorrow, 2024-01-15, monday)";
  }

  if (!bookingState.time) {
    const time = parseTimeFromMessage(message);
    if (time) {
      if (time.hour < 9 || time.hour >= 17) {
        return `Please pick a time between 9:00 and 16:30.\n\nAvailable slots for ${bookingState.date}:\n${await getAvailableSlotsText(1, bookingState.date)}`;
      }
      const timeStr = `${time.hour}:${time.min}`;
      session.bookingState = { ...bookingState, time: timeStr };
      return "Thanks! One more thing — please provide your phone number so we can contact you regarding your appointment.";
    }
    return `Available time slots for ${bookingState.date}:\n${await getAvailableSlotsText(1, bookingState.date)}\n\nPlease pick a time.`;
  }

  if (!bookingState.patientPhone) {
    if (
      /change service|switch service|different service|not root canal|not checkup|not cleaning/i.test(
        message,
      )
    ) {
      session.bookingState = {
        ...bookingState,
        serviceId: undefined,
        serviceName: undefined,
        date: undefined,
        time: undefined,
        patientPhone: undefined,
      };
      return `Which service would you like? Here are our services:\n\n${await getServicesList()}`;
    }

    const phone =
      entities.phone || message.match(/\+?\d[\d\s\-().]{7,}\d/)?.[0];
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

  if (/\b(change|edit|fix|different|wrong|not this|go back)\b/i.test(message)) {
    const services = await prisma.service.findMany({
      where: { isActive: true },
    });
    const msgLower = message.toLowerCase();
    const newService = services.find((s) => {
      const searchable = `${s.name} ${s.description || ""}`.toLowerCase();
      return searchable.includes(msgLower);
    });
    if (newService) {
      session.bookingState = {
        ...bookingState,
        serviceId: newService.id,
        serviceName: newService.name,
        date: undefined,
        time: undefined,
        patientPhone: undefined,
      };
      return `Switched to ${newService.name} - that takes about ${newService.durationMinutes} minutes.\n\nWhat date would you like? (e.g., tomorrow, 2024-01-15)`;
    }
    session.bookingState = {
      ...bookingState,
      serviceId: undefined,
      serviceName: undefined,
      date: undefined,
      time: undefined,
      patientPhone: undefined,
    };
    return `Which service would you like? Here are our services:\n\n${await getServicesList()}`;
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

async function getLastServiceForVisitor(visitorId) {
  const prisma = getPrisma();
  const last = await prisma.appointment.findFirst({
    where: { visitorId },
    orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
    include: { service: true },
  });
  if (!last?.service) return null;
  return { serviceId: last.serviceId, serviceName: last.service.name };
}

const WEEKDAY_NAMES = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

function fuzzyWeekday(msg) {
  const words = msg.match(/[a-z]{3,}/g) || [];
  for (const word of words) {
    for (const name of Object.keys(WEEKDAY_NAMES)) {
      if (levenshtein(word, name) <= 1) return name;
    }
  }
  return null;
}

function parseDateFromMessage(message) {
  const msg = message.toLowerCase();
  const today = new Date();

  if (/\btoday\b/.test(msg)) return toDateString(today);
  if (/\btomorrow\b/.test(msg)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return toDateString(t);
  }

  const dayMatch = msg.match(
    /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (dayMatch) {
    const target = WEEKDAY_NAMES[dayMatch[2]];
    const current = today.getDay();
    let diff = (target - current + 7) % 7;
    if (diff === 0) diff = 7;
    if (dayMatch[1]) diff += 7;
    const t = new Date(today);
    t.setDate(t.getDate() + diff);
    return toDateString(t);
  }

  const fuzzy = fuzzyWeekday(msg);
  if (fuzzy) {
    const target = WEEKDAY_NAMES[fuzzy];
    const current = today.getDay();
    let diff = (target - current + 7) % 7;
    if (diff === 0) diff = 7;
    const t = new Date(today);
    t.setDate(t.getDate() + diff);
    return toDateString(t);
  }

  if (/\bnext\s+week\b/.test(msg)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 7);
    return toDateString(t);
  }

  const dateMatch = message.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateMatch) return dateMatch[0];

  const dateMatch2 = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dateMatch2) {
    return `${dateMatch2[3]}-${dateMatch2[1].padStart(2, "0")}-${dateMatch2[2].padStart(2, "0")}`;
  }

  return null;
}

function parseTimeFromMessage(message) {
  const m = message.match(/(\d{1,2}):(\d{1,2})\s*(am|pm)?/i);
  if (m) {
    let hour = parseInt(m[1]);
    const min = m[2].padStart(2, "0");
    if (m[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (m[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
    return { hour, min };
  }

  const m2 = message.match(/(\d{1,2})\s*(am|pm)\b/i);
  if (m2) {
    let hour = parseInt(m2[1]);
    if (m2[2]?.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (m2[2]?.toLowerCase() === "am" && hour === 12) hour = 0;
    return { hour, min: "00" };
  }

  const m3 = message.match(/^(\d{1,2})$/);
  if (m3) return { hour: parseInt(m3[1]), min: "00" };

  return null;
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

async function handleBookingStatusIntent(session, visitorId, message) {
  const prisma = getPrisma();
  const rows = await prisma.appointment.findMany({
    where: { visitorId },
    select: { patientName: true },
  });

  const names = [
    ...new Set(rows.map((r) => r.patientName?.trim()).filter(Boolean)),
  ];

  if (names.length === 1) {
    const appointments = await getAppointmentsForName(names[0], visitorId);
    return buildAppointmentsResponse(names[0], appointments);
  }

  if (names.length > 1) {
    const lower = (message || "").toLowerCase();
    if (/\b(both|all|every|any)\b/i.test(lower)) {
      const appointments = await getAppointmentsForNames(names, visitorId);
      return buildAppointmentsResponse(names, appointments);
    }
    const mentioned = names.find((n) => lower.includes(n.toLowerCase()));
    if (mentioned) {
      const appointments = await getAppointmentsForName(mentioned, visitorId);
      return buildAppointmentsResponse(mentioned, appointments);
    }
    session.statusLookupNames = names;
  }

  session.statusLookup = true;
  session.statusLookupStep = "name";
  session.statusLookupName = null;

  if (names.length === 0) {
    return "Could you please provide the name you booked under?";
  }

  return `I found bookings under multiple names (${names.join(", ")}). Which name would you like me to check?`;
}

async function handleBookingStatusLookup(message, visitorId, session) {
  if (session.statusLookupStep === "phone") {
    const phone = extractPhone(message);
    if (!phone) {
      session.statusLookup = true;
      session.statusLookupStep = "phone";
      return "Please provide the phone number used for the booking (e.g., +1-555-0123).";
    }
    const name = session.statusLookupName;
    const appointments = await getAppointmentsByNameAndPhone(name, phone);
    if (appointments.length === 0) {
      session.statusLookup = false;
      session.statusLookupStep = null;
      session.statusLookupName = null;
      session.statusLookupNames = null;
      return `No appointments found for "${name}" with that phone number. Would you like to book a new appointment?`;
    }
    session.statusLookup = false;
    session.statusLookupStep = null;
    session.statusLookupName = null;
    session.statusLookupNames = null;
    return buildAppointmentsResponse(appointments[0].patientName, appointments);
  }

  const knownNames = session.statusLookupNames;
  const lower = message.toLowerCase();
  if (knownNames?.length && /\b(both|all|every|any)\b/i.test(lower)) {
    const appointments = await getAppointmentsForNames(knownNames, visitorId);
    if (appointments.length > 0) {
      session.statusLookup = false;
      session.statusLookupStep = null;
      session.statusLookupName = null;
      session.statusLookupNames = null;
      return buildAppointmentsResponse(knownNames, appointments);
    }
  }

  const name = extractPatientName(message);
  const scoped = await getAppointmentsForName(name, visitorId);
  if (scoped.length > 0) {
    session.statusLookup = false;
    session.statusLookupStep = null;
    session.statusLookupName = null;
    session.statusLookupNames = null;
    return buildAppointmentsResponse(name, scoped);
  }

  session.statusLookup = true;
  session.statusLookupStep = "phone";
  session.statusLookupName = name;
  return `I couldn't find a booking under "${name}" on this device. To verify, please provide the phone number used for the booking.`;
}

async function getAppointmentsForName(name, visitorId) {
  const prisma = getPrisma();
  return await prisma.appointment.findMany({
    where: {
      patientName: { contains: name, mode: "insensitive" },
      visitorId,
    },
    include: { doctor: true, service: true },
    orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
  });
}

async function getAppointmentsForNames(names, visitorId) {
  const prisma = getPrisma();
  return await prisma.appointment.findMany({
    where: {
      patientName: { in: names },
      visitorId,
    },
    include: { doctor: true, service: true },
    orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
  });
}

async function getAppointmentsByNameAndPhone(name, phone) {
  const prisma = getPrisma();
  const normalized = normalizePhone(phone);
  const matches = await prisma.appointment.findMany({
    where: { patientName: { contains: name, mode: "insensitive" } },
    include: { doctor: true, service: true },
    orderBy: [{ appointmentDate: "desc" }, { appointmentTime: "desc" }],
  });
  return matches.filter(
    (a) => a.patientPhone && normalizePhone(a.patientPhone) === normalized,
  );
}

function extractPatientName(message) {
  const cleaned = message
    .replace(
      /\b(?:my name is|my name's|i am|i'm|name is)\b/i,
      "",
    )
    .replace(/[^A-Za-z\s]+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : message.trim();
}

function extractPhone(message) {
  const match = message.match(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  );
  return match ? match[0] : null;
}

function normalizePhone(phone) {
  return String(phone).replace(/\D/g, "");
}

function buildAppointmentsResponse(names, appointments) {
  const nameList = Array.isArray(names) ? names : [names];

  if (appointments.length === 0) {
    return `No appointments found for "${nameList.join(", ")}". Would you like to book a new appointment?`;
  }

  const today = new Date(new Date().toDateString());
  const parts = [];

  for (const name of nameList) {
    const mine = appointments.filter(
      (a) => a.patientName.toLowerCase() === name.toLowerCase(),
    );
    if (mine.length === 0) {
      parts.push(`No appointments found for "${name}".`);
      continue;
    }

    const upcoming = mine.filter(
      (a) => new Date(a.appointmentDate) >= today,
    );
    const past = mine.filter((a) => new Date(a.appointmentDate) < today);

    let block = `Here are the appointments for ${mine[0].patientName}:\n\n`;

    if (upcoming.length > 0) {
      block += "**Upcoming:**\n";
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
        block += `• Booking #${a.id} — ${a.service.name} with ${a.doctor.name} on ${date} at ${time} [${a.status}]\n`;
      });
      block += "\n";
    }

    if (past.length > 0) {
      block += "**Past:**\n";
      past.forEach((a) => {
        const date = new Date(a.appointmentDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const time = new Date(a.appointmentTime).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
        block += `• Booking #${a.id} — ${a.service.name} with ${a.doctor.name} on ${date} at ${time} [${a.status}]\n`;
      });
    }

    parts.push(block.trim());
  }

  return parts.join("\n\n");
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
      hours: [
        "open",
        "close",
        "hours",
        "timing",
        "monday",
        "friday",
        "saturday",
        "sunday",
      ],
      pricing: ["price", "cost", "payment", "insurance", "fee", "charge"],
    };
    const categoryMap = {
      contact: "general",
      hours: "general",
      pricing: "policy",
    };
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
  const trimmed = message.trim();
  const visitorId = session?.dbSession?.visitorId;
  if (visitorId && /^[A-Za-z]{2,30}$/.test(trimmed)) {
    const prisma = getPrisma();
    const found = await prisma.appointment.findFirst({
      where: {
        visitorId,
        patientName: { contains: trimmed, mode: "insensitive" },
      },
    });
    if (found) {
      const appointments = await getAppointmentsForName(
        found.patientName,
        visitorId,
      );
      return buildAppointmentsResponse(found.patientName, appointments);
    }
  }

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
        select: {
          id: true,
          role: true,
          content: true,
          intent: true,
          createdAt: true,
        },
      },
    },
    orderBy: { startedAt: "asc" },
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
  const where = visitorId
    ? { visitorId: { contains: visitorId, mode: "insensitive" } }
    : {};

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            intent: true,
            createdAt: true,
          },
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
