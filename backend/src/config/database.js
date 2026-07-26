import { PrismaClient } from '@prisma/client';

let prisma;

export function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function initDatabase() {
  const db = getPrisma();
  try {
    await db.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('pgvector extension enabled');
  } catch {
    console.log('pgvector not available - using tsvector fallback for search');
  }
  console.log('Database connected successfully');
  return db;
}
