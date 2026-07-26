import { getPrisma } from '../config/database.js';

export async function getDoctors(req, res, next) {
  try {
    const prisma = getPrisma();
    const doctors = await prisma.doctor.findMany({
      include: { services: true },
      orderBy: { name: 'asc' },
    });
    res.json(doctors);
  } catch (err) {
    next(err);
  }
}

export async function getDoctor(req, res, next) {
  try {
    const prisma = getPrisma();
    const doctor = await prisma.doctor.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { services: true },
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

export async function createDoctor(req, res, next) {
  try {
    const prisma = getPrisma();
    const { name, specialization, email, phone, availableDays, availableHours } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const doctor = await prisma.doctor.create({
      data: { name, specialization, email, phone, availableDays, availableHours },
    });
    res.status(201).json(doctor);
  } catch (err) {
    next(err);
  }
}

export async function updateDoctor(req, res, next) {
  try {
    const prisma = getPrisma();
    const doctor = await prisma.doctor.update({
      where: { id: parseInt(req.params.id) },
      data: req.body,
    });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

export async function deleteDoctor(req, res, next) {
  try {
    const prisma = getPrisma();
    await prisma.doctor.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
