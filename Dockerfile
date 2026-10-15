FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Immagine finale: mantiene anche le devDependencies e i test, così
# `docker compose exec app npm test` funziona nel container.
FROM node:24-alpine
WORKDIR /app
# Il processo non gira come root.
RUN chown node:node /app
USER node
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node tsconfig.json jest.config.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node tests ./tests
COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
