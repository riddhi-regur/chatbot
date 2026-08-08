import { getPrisma } from '../config/database.js';

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(date) {
  return toDateString(new Date(date)) === toDateString(new Date());
}

function toMinutes(time) {
  const [h, m] = String(time || '').split(':');
  return parseInt(h) * 60 + parseInt(m || 0);
}

function parseAppointmentTime(time) {
  const [h, m] = String(time || '').split(':');
  const hour = parseInt(h);
  const min = parseInt(m || 0);
  if (Number.isNaN(hour)) throw new Error('Invalid appointment time');
  return new Date(1970, 0, 1, hour, min);
}

export async function getAvailableSlots(doctorId, date) {
  const prisma = getPrisma();
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new Error('Doctor not found');

  const days = doctor.availableDays || [];
  if (!days.includes(dayOfWeek)) {
    return { available: false, reason: `Doctor not available on ${dayOfWeek}` };
  }

  const hours = doctor.availableHours || {};
  const startHour = parseInt(hours.start || '09');
  const endHour = parseInt(hours.end || '17');

  const existing = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate: new Date(date),
      status: { in: ['booked', 'confirmed'] },
    },
    select: { appointmentTime: true },
  });

  const bookedTimes = existing.map(a => {
    const t = new Date(a.appointmentTime);
    return `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
  });

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = isToday(date);

  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h}:${String(m).padStart(2, '0')}`;
      const withinGap = today && h * 60 + m < nowMinutes + 120;
      slots.push({ time, available: !bookedTimes.includes(time) && !withinGap });
    }
  }

  return { available: true, slots };
}

export async function createAppointment(data) {
  const prisma = getPrisma();

  if (
    isToday(data.date) &&
    toMinutes(data.time) < new Date().getHours() * 60 + new Date().getMinutes() + 120
  ) {
    throw new Error('That time is within 2 hours of now. Please pick a later slot.');
  }

  const existing = await prisma.appointment.findFirst({
    where: {
      doctorId: data.doctorId,
      appointmentDate: new Date(data.date),
      appointmentTime: parseAppointmentTime(data.time),
      status: { in: ['booked', 'confirmed'] },
    },
  });

  if (existing) {
    throw new Error('This time slot is already booked');
  }

  return await prisma.appointment.create({
    data: {
      patientName: data.patientName,
      patientEmail: data.patientEmail || null,
      patientPhone: data.patientPhone || null,
      doctorId: data.doctorId,
      serviceId: data.serviceId,
      appointmentDate: new Date(data.date),
      appointmentTime: parseAppointmentTime(data.time),
      status: 'booked',
      notes: data.notes || null,
      visitorId: data.visitorId || null,
    },
    include: {
      doctor: true,
      service: true,
    },
  });
}

export async function updateAppointmentStatus(appointmentId, status) {
  const prisma = getPrisma();
  const valid = ['booked', 'confirmed', 'completed', 'cancelled'];
  if (!valid.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${valid.join(', ')}`);
  }

  return await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
    include: { doctor: true, service: true },
  });
}

export async function getAppointments(filters = {}) {
  const prisma = getPrisma();
  const where = {};

  if (filters.status) where.status = filters.status;
  if (filters.doctorId) where.doctorId = parseInt(filters.doctorId);
  if (filters.date) {
    const d = new Date(filters.date);
    where.appointmentDate = d;
  }

  return await prisma.appointment.findMany({
    where,
    include: { doctor: true, service: true },
    orderBy: [
      { appointmentDate: 'asc' },
      { appointmentTime: 'asc' },
    ],
  });
}
