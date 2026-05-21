# Playwright base image includes Chromium (required for crawler.js)
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY crawler.js ./

ENV NODE_ENV=production
ENV API_ONLY=true
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
