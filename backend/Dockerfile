FROM node:22-alpine

WORKDIR /app/backend

COPY backend/package*.json ./

RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY database/migrations /app/database/migrations

RUN npm run build

ARG PORT=3000

ENV PORT=$PORT

EXPOSE $PORT

CMD ["npm", "start"]
