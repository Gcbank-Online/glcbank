FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

# Copy root SQL schema into container (docker-compose also mounts it, but keep a copy)
# Note: docker-compose mounts ./001_schema.sql into /usr/src/app/001_schema.sql so init-db can use it.
EXPOSE 3000

CMD ["sh", "-c", "node init-db.js && node index.js"]
