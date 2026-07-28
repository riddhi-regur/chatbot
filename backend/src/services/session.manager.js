import prisma from "../config/prisma.js";

export async function getOrCreateSession(visitorId) {
  let session = await prisma.chatSession.findFirst({
    where: {
      visitorId,
      endedAt: null,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        visitorId,
      },
    });
  }

  return session;
}

export async function saveMessage(sessionId, role, content, intent = null) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role,
      content,
      intent,
    },
  });
}

export async function getConversationHistory(sessionId, limit = 20) {
  const messages = await prisma.chatMessage.findMany({
    where: {
      sessionId,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  return messages;
}

export async function closeSession(visitorId) {
  await prisma.chatSession.updateMany({
    where: {
      visitorId,
      endedAt: null,
    },
    data: {
      endedAt: new Date(),
    },
  });
}
