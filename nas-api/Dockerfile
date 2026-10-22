FROM node:20-alpine
# Chromium für den Kochbuch-PDF-Export (Schriften sind in assets/fonts eingebettet)
RUN apk add --no-cache chromium
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY tools ./tools
COPY assets ./assets
COPY db/schema.json ./db/schema.json
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]
