import * as appointmentService from '../services/appointment.service.js';
import { getPrisma } from '../config/database.js';

export async function getAppointments(req, res, next) {
  try {
    const { status, doctorId, date } = req.query;
    const appointments = await appointmentService.getAppointments({ status, doctorId, date });
    res.json(appointments);
  } catch (err) {
    next(err);
  }
}

export async function getAppointment(req, res, next) {
  try {
    const prisma = getPrisma();
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { doctor: true, service: true },
    });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function createAppointment(req, res, next) {
  try {
    const { patientName, patientEmail, patientPhone, doctorId, serviceId, date, time, notes } = req.body;
    if (!patientName || !doctorId || !serviceId || !date || !time) {
      return res.status(400).json({ error: 'patientName, doctorId, serviceId, date, and time required' });
    }
    const appointment = await appointmentService.createAppointment({
      patientName, patientEmail, patientPhone, doctorId, serviceId, date, time, notes,
    });
    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const appointment = await appointmentService.updateAppointmentStatus(
      parseInt(req.params.id),
      status
    );
    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

export async function getAvailability(req, res, next) {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ error: 'doctorId and date required' });
    }
    const result = await appointmentService.getAvailableSlots(parseInt(doctorId), date);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStats(req, res, next) {
  try {
    const prisma = getPrisma();
    const [total, booked, confirmed, completed] = await Promise.all([
      prisma.appointment.count(),
      prisma.appointment.count({ where: { status: 'booked' } }),
      prisma.appointment.count({ where: { status: 'confirmed' } }),
      prisma.appointment.count({ where: { status: 'completed' } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.appointment.count({
      where: { appointmentDate: { gte: today } },
    });

    const totalDoctors = await prisma.doctor.count({ where: { isActive: true } });
    const totalServices = await prisma.service.count({ where: { isActive: true } });

    res.json({ total, booked, confirmed, completed, todayCount, totalDoctors, totalServices });
  } catch (err) {
    next(err);
  }
}
