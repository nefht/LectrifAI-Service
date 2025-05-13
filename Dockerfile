FROM node:20.11.1

# Cài đặt LibreOffice
RUN apt-get update && apt-get install -y libreoffice && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
