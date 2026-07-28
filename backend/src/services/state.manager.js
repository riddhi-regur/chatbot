import prisma from "../config/prisma.js";

export async function getState(sessionId) {
  let state = await prisma.conversationState.findUnique({
    where: {
      sessionId,
    },
  });

  if (!state) {
    state = await prisma.conversationState.create({
      data: {
        sessionId,
      },
    });
  }

  return state;
}

export async function updateState(sessionId, data) {
  return prisma.conversationState.update({
    where: {
      sessionId,
    },
    data,
  });
}

export async function clearState(sessionId) {
  return prisma.conversationState.update({
    where: {
      sessionId,
    },
    data: {
      currentIntent: null,
      bookingStep: null,
      collectedData: {},
      awaitingInput: false,
    },
  });
}
