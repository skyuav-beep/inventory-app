# Dev Dockerfile for the Inventory API service
FROM node:20-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "start:prod"]
