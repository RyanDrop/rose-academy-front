# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM nginx:stable-alpine
RUN apk upgrade --no-cache

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist/rose-academy-front/browser /usr/share/nginx/html

EXPOSE 3000