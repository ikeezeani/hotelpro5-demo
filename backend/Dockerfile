# HotelPro 5.0 — Backend API image
FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Logs directory used by winston (utils/logger.js)
RUN mkdir -p logs

RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
