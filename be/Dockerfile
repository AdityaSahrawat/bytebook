FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npm run build
RUN npx prisma generate

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push && npm start"]
