FROM nginx:alpine


COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf


EXPOSE 80



# ============ BUILD ============
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

# ============ PRODUCTION ============
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js .

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "server.js"]
