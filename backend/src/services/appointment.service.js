import { getPrisma } from '../config/database.js';

export async function getAvailableSlots(doctorId, date) {
  const prisma = getPrisma();
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });

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

  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h}:${String(m).padStart(2, '0')}`;
      slots.push({ time, available: !bookedTimes.includes(time) });
    }
  }

  return { available: true, slots };
}

export async function createAppointment(data) {
  const prisma = getPrisma();

  const existing = await prisma.appointment.findFirst({
    where: {
      doctorId: data.doctorId,
      appointmentDate: new Date(data.date),
      appointmentTime: new Date(`1970-01-01T${data.time}`),
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
      appointmentTime: new Date(`1970-01-01T${data.time}`),
      status: 'booked',
      notes: data.notes || null,
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
