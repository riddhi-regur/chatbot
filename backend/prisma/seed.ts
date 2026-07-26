import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: {
      email: 'admin@clinic.com',
      passwordHash,
      name: 'Admin',
      role: 'admin',
    },
  });
  console.log('Admin user created: admin@clinic.com / admin123');

  const doctor1 = await prisma.doctor.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Dr. Sarah Johnson',
      specialization: 'General Dentistry',
      email: 'sarah.johnson@clinic.com',
      phone: '+1-555-0101',
      availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      availableHours: { start: '09:00', end: '17:00' },
    },
  });

  const doctor2 = await prisma.doctor.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Dr. Michael Chen',
      specialization: 'Orthodontics',
      email: 'michael.chen@clinic.com',
      phone: '+1-555-0102',
      availableDays: ['monday', 'wednesday', 'friday'],
      availableHours: { start: '10:00', end: '18:00' },
    },
  });

  const doctor3 = await prisma.doctor.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Dr. Emily Rodriguez',
      specialization: 'Pediatric Dentistry',
      email: 'emily.rodriguez@clinic.com',
      phone: '+1-555-0103',
      availableDays: ['tuesday', 'thursday', 'saturday'],
      availableHours: { start: '08:00', end: '16:00' },
    },
  });

  const services = [
    { name: 'General Checkup', description: 'Comprehensive dental examination including X-rays and oral cancer screening', durationMinutes: 30, price: 150, doctorId: doctor1.id },
    { name: 'Teeth Cleaning', description: 'Professional dental cleaning and polishing to remove plaque and tartar', durationMinutes: 45, price: 120, doctorId: doctor1.id },
    { name: 'Root Canal Treatment', description: 'Endodontic treatment to save infected or damaged tooth pulp', durationMinutes: 90, price: 800, doctorId: doctor1.id },
    { name: 'Teeth Whitening', description: 'Professional teeth whitening treatment for a brighter smile', durationMinutes: 60, price: 350, doctorId: doctor1.id },
    { name: 'Dental Filling', description: 'Composite or amalgam fillings for cavities and tooth decay', durationMinutes: 45, price: 200, doctorId: doctor1.id },
    { name: 'Braces Consultation', description: 'Initial consultation for orthodontic braces treatment', durationMinutes: 30, price: 100, doctorId: doctor2.id },
    { name: 'Braces Installation', description: 'Metal or ceramic braces installation for teeth alignment', durationMinutes: 120, price: 3500, doctorId: doctor2.id },
    { name: 'Braces Adjustment', description: 'Regular braces adjustment and monitoring appointment', durationMinutes: 30, price: 150, doctorId: doctor2.id },
    { name: 'Invisalign Consultation', description: 'Consultation for clear aligner Invisalign treatment', durationMinutes: 30, price: 100, doctorId: doctor2.id },
    { name: 'Pediatric Checkup', description: 'Dental checkup specifically designed for children', durationMinutes: 30, price: 100, doctorId: doctor3.id },
    { name: 'Pediatric Cleaning', description: 'Gentle teeth cleaning for kids with preventive fluoride treatment', durationMinutes: 30, price: 80, doctorId: doctor3.id },
    { name: 'Sealants', description: 'Dental sealants to protect childrens teeth from decay', durationMinutes: 20, price: 60, doctorId: doctor3.id },
  ];

  for (const service of services) {
    await prisma.service.create({ data: service });
  }
  console.log(`${services.length} services created`);

  const kbItems = [
    { title: 'Clinic Hours', content: 'Our clinic is open Monday to Friday from 9:00 AM to 5:00 PM. Saturday hours are 8:00 AM to 2:00 PM (Pediatric only). We are closed on Sundays and public holidays.', category: 'general' },
    { title: 'Emergency Services', content: 'For dental emergencies outside office hours, please call our emergency line at +1-555-9999. We offer 24/7 emergency dental services for severe toothaches, broken teeth, and dental trauma.', category: 'general' },
    { title: 'Insurance', content: 'We accept most major dental insurance plans including Delta Dental, Cigna, Aetna, and MetLife. Please bring your insurance card to your appointment. We also offer payment plans for uninsured patients.', category: 'policy' },
    { title: 'Cancellation Policy', content: 'We require at least 24 hours notice for appointment cancellations. Late cancellations or no-shows may incur a fee of $50. Please call us as soon as possible if you need to reschedule.', category: 'policy' },
    { title: 'General Checkup Process', content: 'During a general checkup, our dentist will examine your teeth, gums, and mouth. We take X-rays to detect hidden issues, screen for oral cancer, and provide a personalized treatment plan. Regular checkups every 6 months are recommended.', category: 'service' },
    { title: 'Teeth Cleaning Benefits', content: 'Professional teeth cleaning removes hardened plaque that brushing cannot. It helps prevent gum disease, cavities, and bad breath. We recommend professional cleaning every 6 months for optimal oral health.', category: 'service' },
    { title: 'Root Canal Treatment', content: 'Root canal treatment saves severely damaged or infected teeth. The procedure involves removing infected pulp, cleaning the canal, and sealing it. Modern root canals are virtually painless and take about 60-90 minutes. Recovery takes 1-2 days.', category: 'treatment' },
    { title: 'Teeth Whitening Options', content: 'We offer in-office professional whitening (results in one visit) and take-home whitening kits. In-office treatment uses LED light activation for dramatic results in about 60 minutes. Results last 1-3 years with proper care.', category: 'treatment' },
    { title: 'Braces Treatment Timeline', content: 'Orthodontic treatment with braces typically takes 18-24 months. We offer metal braces, ceramic braces, and Invisalign. Initial consultation includes digital scanning and a customized treatment plan. Regular adjustments are needed every 4-6 weeks.', category: 'treatment' },
    { title: 'Pediatric Dentistry', content: 'Our pediatric dentist specializes in dental care for children from age 1 to 17. We provide a child-friendly environment with gentle treatments, preventive care, sealants, and early orthodontic assessment.', category: 'service' },
    { title: 'Payment Options', content: 'We accept cash, credit/debit cards, and dental insurance. We also offer 0% interest payment plans through CareCredit for treatments over $500. Contact our billing department for more details.', category: 'general' },
    { title: 'Location and Parking', content: 'We are located at 123 Health Avenue, Suite 200, Medical District. Free parking is available in the building garage. We are also accessible by public bus routes 15, 22, and 45.', category: 'general' },
    { title: 'Digital X-Rays', content: 'We use digital X-ray technology which produces 90% less radiation than traditional X-rays. Results are available instantly on screen for immediate discussion with your dentist.', category: 'service' },
    { title: 'Dental Implants', content: 'Dental implants are a permanent solution for missing teeth. The titanium implant is surgically placed into the jawbone and acts as an artificial tooth root. The process takes 3-6 months for complete healing before the crown is attached.', category: 'treatment' },
    { title: 'Gum Disease Treatment', content: 'We treat all stages of gum disease from gingivitis to periodontitis. Treatments include deep cleaning (scaling and root planing), antibiotic therapy, and surgical procedures for advanced cases.', category: 'treatment' },
  ];

  for (const item of kbItems) {
    await prisma.knowledgeBase.create({ data: item });
  }
  console.log(`${kbItems.length} knowledge base items created`);

  const today = new Date();
  const appointments = [
    { patientName: 'John Smith', patientEmail: 'john@email.com', patientPhone: '+1-555-1234', doctorId: doctor1.id, serviceId: 1, appointmentDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()), appointmentTime: new Date(1970, 0, 1, 9, 30), status: 'completed' },
    { patientName: 'Maria Garcia', patientEmail: 'maria@email.com', patientPhone: '+1-555-5678', doctorId: doctor1.id, serviceId: 2, appointmentDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()), appointmentTime: new Date(1970, 0, 1, 10, 30), status: 'confirmed' },
    { patientName: 'David Wilson', patientEmail: 'david@email.com', patientPhone: '+1-555-9012', doctorId: doctor2.id, serviceId: 7, appointmentDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1), appointmentTime: new Date(1970, 0, 1, 11, 0), status: 'booked' },
    { patientName: 'Lisa Anderson', patientEmail: 'lisa@email.com', patientPhone: '+1-555-3456', doctorId: doctor3.id, serviceId: 10, appointmentDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2), appointmentTime: new Date(1970, 0, 1, 9, 0), status: 'booked' },
  ];

  for (const appt of appointments) {
    await prisma.appointment.create({ data: appt });
  }
  console.log(`${appointments.length} sample appointments created`);

  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
