import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const count = await prisma.user.count();
  await prisma.$disconnect();

  // Exit code 0 = database is empty
  process.exit(count === 0 ? 0 : 1);
} catch (err) {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
}
