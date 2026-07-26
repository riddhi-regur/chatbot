import { getPrisma } from '../config/database.js';

export async function getServices(req, res, next) {
  try {
    const prisma = getPrisma();
    const services = await prisma.service.findMany({
      include: { doctor: true },
      orderBy: { name: 'asc' },
    });
    res.json(services);
  } catch (err) {
    next(err);
  }
}

export async function getService(req, res, next) {
  try {
    const prisma = getPrisma();
    const service = await prisma.service.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { doctor: true },
    });
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    next(err);
  }
}

export async function createService(req, res, next) {
  try {
    const prisma = getPrisma();
    const { name, description, durationMinutes, price, doctorId } = req.body;
    if (!name || !doctorId) {
      return res.status(400).json({ error: 'Name and doctorId required' });
    }
    const service = await prisma.service.create({
      data: { name, description, durationMinutes, price, doctorId },
      include: { doctor: true },
    });
    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
}

export async function updateService(req, res, next) {
  try {
    const prisma = getPrisma();
    const { name, description, durationMinutes, price, doctorId, isActive } = req.body;
    const service = await prisma.service.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description, durationMinutes, price, doctorId, isActive },
      include: { doctor: true },
    });
    res.json(service);
  } catch (err) {
    next(err);
  }
}

export async function deleteService(req, res, next) {
  try {
    const prisma = getPrisma();
    await prisma.service.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
