FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/src ./src
COPY widget ./widget
COPY backend/start.sh ./
RUN chmod +x start.sh
EXPOSE 4001

CMD ["sh", "start.sh"]
